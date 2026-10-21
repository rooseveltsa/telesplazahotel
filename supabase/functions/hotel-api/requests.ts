import {z} from 'npm:zod@3.25.76';
import {sql} from './db.ts';
import {today} from './hotel-domain.ts';
import {text,period,guestFor,freeRooms,now,audit} from './reception-domain.ts';
import {stayQuote,saveNights,spreadTotal} from './rates.ts';
export async function requestsRoute(req:Request,user:any,hid:string){
 if(!(await sql`select id from hotels where id=${hid} and owner=${user.id}`).length)return Response.json({error:'Unidade sem acesso.'},{status:403});
 if(req.method==='GET')return Response.json({requests:await sql`select * from booking_requests where hotel_id=${hid} order by created desc limit 500`});
 const b=await req.json(),id=text(b.id),status=z.enum(['confirmed','cancelled']).parse(b.status);
 await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(hashtextextended(${hid},0))`;const [r]=await tx`select * from booking_requests where id=${id} and hotel_id=${hid} for update`;if(!r||r.reservation_id)throw new Error('Solicitação já processada. Atualize a lista.');
  if(!['pending','payment_failed','payment_review'].includes(r.status)&&!(r.status==='awaiting_payment'&&new Date(r.hold_until).getTime()<Date.now()))throw new Error('Aguarde o pagamento ou o vencimento da pré-reserva.');
  const paid=r.payment_status==='approved';if(status==='cancelled'&&paid)throw new Error('Pagamento recebido: acomode o hóspede para registrar o cancelamento e a devolução na reserva.');
  let reservation:string|null=null;
  if(status==='confirmed'){
   period(r.checkin,r.checkout);const room=(await freeRooms(tx,hid,r.checkin,r.checkout,r.guests,'',id)).find((q:any)=>q.id===b.room);if(!room)throw new Error('Quarto indisponível ou sem capacidade.');
   const quote=paid&&r.total?{rate:r.rate,total:r.total,nights:Array.isArray(r.quoted_nights)?r.quoted_nights:spreadTotal(r.checkin,r.checkout,r.total)}:await stayQuote(tx,room,r.checkin,r.checkout,r.guests);
   const gid=await guestFor(tx,hid,r.name,r.phone,'',r.guest_id??'');reservation=crypto.randomUUID();const [created]=await tx`insert into reservations(id,hotel_id,room_id,guest_id,name,phone,company,guests,checkin,checkout,rate,total,status,source,notes,created) values(${reservation},${hid},${room.id},${gid},${r.name},${r.phone},'',${r.guests},${r.checkin},${r.checkout},${quote.rate},${quote.total},'confirmed','Site',${r.notes},${now()}) returning *`;
   await saveNights(tx,created,quote.nights.map((n:any)=>({...n,room_id:room.id})));
   if(paid){if(!r.payment_id)throw new Error('Pagamento sem identificador para conferência.');await tx`insert into entries(id,hotel_id,reservation_id,kind,amount,description,method,due,paid,created,actor,payment_id) values(${crypto.randomUUID()},${hid},${reservation},'payment',${r.deposit_amount},'Sinal pago pelo site',${r.payment_method??'Pix'},${r.paid_at?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(r.paid_at)):today()},1,${now()},'Mercado Pago',${r.payment_id})`;}
   await tx`update booking_requests set guest_id=${gid},room_id=${room.id} where id=${id}`;
  }
  await tx`update booking_requests set status=${status},reservation_id=${reservation},hold_until=null where id=${id}`;await audit(tx,hid,user.email??user.id,status==='confirmed'?'Pedido do site acomodado':'Pedido do site cancelado',id);
 });return Response.json({message:status==='confirmed'?'Reserva criada e sinal vinculado, quando recebido.':'Solicitação cancelada.'});
}
