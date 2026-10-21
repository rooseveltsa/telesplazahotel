import {freeRooms,guestFor,audit} from './reception-domain.ts';
import {stayQuote,saveNights,spreadTotal} from './rates.ts';
import {z} from 'npm:zod@3.25.76';
import {sql} from './db.ts';
import {nights,roomRate,validateBookingStart,validDay,today} from './hotel-domain.ts';

const mpToken=()=>Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')??'';
const publicKey=()=>Deno.env.get('MERCADOPAGO_PUBLIC_KEY')??'';
const webhookSecret=()=>Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')??'';
const uuid=z.string().uuid();
const text=(v:unknown,max=200)=>z.string().trim().min(1).max(max).parse(v);
const digits=(v:unknown)=>text(v,30).replace(/\D/g,'');
const same=(a:string,b:string)=>{if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0};
const hex=async(secret:string,value:string)=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');

async function mercado(path:string,init:RequestInit={}){
 const token=mpToken();if(!token)throw new Error('Pagamento on-line em configuração. Continue pelo atendimento da recepção.');
 const headers=new Headers(init.headers);headers.set('Authorization','Bearer '+token);headers.set('Content-Type','application/json');
 const response=await fetch('https://api.mercadopago.com'+path,{...init,headers});const data=await response.json();
 if(!response.ok)throw new Error('O Mercado Pago não conseguiu processar esta tentativa. Confira os dados e tente novamente.');return data;
}

function methodLabel(payment:any){const id=String(payment.payment_method_id??'');if(id==='pix')return 'Pix';return String(payment.payment_type_id??'').includes('debit')?'Cartão de débito':'Cartão de crédito'}

export async function reconcile(payment:any){
 const requestId=uuid.parse(String(payment.external_reference??'')),paymentId=String(payment.id),status=String(payment.status??'');
 await sql.begin(async tx=>{const [lookup]=await tx`select hotel_id from booking_requests where id=${requestId}`;if(!lookup)return;await tx`select pg_advisory_xact_lock(hashtextextended(${lookup.hotel_id},0))`;const [r]=await tx`select * from booking_requests where id=${requestId} for update`;if(!r)return;
  if(Math.round(Number(payment.transaction_amount)*100)!==Number(r.deposit_amount))throw new Error('Valor de pagamento divergente.');
  if(status!=='approved'){if(r.payment_status==='approved'){if(['refunded','charged_back'].includes(status))await audit(tx,r.hotel_id,'Mercado Pago','Pagamento '+status+' — conferir financeiro da reserva',r.reservation_id??requestId);return;}await tx`update booking_requests set payment_id=${paymentId},payment_status=${status},payment_method=${methodLabel(payment)},status=${['rejected','cancelled','refunded','charged_back'].includes(status)?'payment_failed':r.status},hold_until=${['rejected','cancelled'].includes(status)?null:r.hold_until} where id=${requestId}`;return;}
  if(r.reservation_id){await tx`update booking_requests set payment_id=${paymentId},payment_status='approved',payment_method=${methodLabel(payment)},status='confirmed',hold_until=null where id=${requestId}`;return;}
  const candidates=(await freeRooms(tx,r.hotel_id,r.checkin,r.checkout,r.guests,'',requestId)).filter((q:any)=>q.category===r.category);
  const room=candidates.find((q:any)=>q.id===r.room_id)??candidates[0];
  if(!room){await tx`update booking_requests set payment_id=${paymentId},payment_status='approved',payment_method=${methodLabel(payment)},paid_at=coalesce(paid_at,now()),status='payment_review',hold_until=null where id=${requestId}`;await audit(tx,r.hotel_id,'Mercado Pago','Pagamento aprovado — verificar quarto ou devolução',requestId);return;}
  if(room.id!==r.room_id){await audit(tx,r.hotel_id,'Mercado Pago','Pagamento acomodado em outro quarto da mesma categoria',requestId);r.room_id=room.id;}
  const reservation=crypto.randomUUID(),now=new Date().toISOString(),method=methodLabel(payment);let guestId=r.guest_id as string|null;
  if(!guestId)guestId=await guestFor(tx,r.hotel_id,r.name,r.phone);
  const [created]=await tx`insert into reservations(id,hotel_id,room_id,guest_id,name,phone,company,guests,checkin,checkout,rate,total,status,source,notes,created) values(${reservation},${r.hotel_id},${r.room_id},${guestId},${r.name},${r.phone},'',${r.guests},${r.checkin},${r.checkout},${r.rate},${r.total},'confirmed','Site',${r.notes},${now}) returning *`;
  await saveNights(tx,created,(Array.isArray(r.quoted_nights)?r.quoted_nights:spreadTotal(r.checkin,r.checkout,r.total)).map((n:any)=>({...n,room_id:r.room_id})));
  await tx`insert into entries(id,hotel_id,reservation_id,kind,amount,description,method,due,paid,created,actor,payment_id) select ${crypto.randomUUID()},${r.hotel_id},${reservation},'payment',${r.deposit_amount},'Sinal da hospedagem',${method},${today()},1,${now},'Mercado Pago',${paymentId} where not exists(select 1 from entries where payment_id=${paymentId})`;
  await tx`update booking_requests set room_id=${r.room_id},paid_at=coalesce(paid_at,now()),reservation_id=${reservation},guest_id=${guestId},payment_id=${paymentId},payment_status='approved',payment_method=${method},status='confirmed',hold_until=null where id=${requestId}`;
  await tx`insert into audit(hotel_id,actor,action,entity,created) values(${r.hotel_id},'Mercado Pago','Reserva confirmada por pagamento on-line',${reservation},${now})`;
 });
}

export async function checkout(body:any){
 if(!publicKey()||!mpToken())throw new Error('Pagamento on-line em configuração. Continue pelo atendimento da recepção.');
 const id=uuid.parse(body.id),name=text(body.name,120),phone=text(body.phone,30),category=text(body.category,40),guests=z.coerce.number().int().min(1).max(4).parse(body.guests),notes=z.string().max(1000).parse(body.notes??''),checkin=text(body.checkin,10),checkout=text(body.checkout,10);if(digits(phone).length<10)throw new Error('Informe um telefone com DDD.');validateBookingStart(checkin);if(!validDay(checkin)||!validDay(checkout)||nights(checkin,checkout)<1||nights(checkin,checkout)>365)throw new Error('Confira as datas da estadia.');
 let response:any;await sql.begin(async tx=>{const [config]=await tx`select hotel_id,deposit_nights from portal_config where id=1`;if(!config)throw new Error('Reservas on-line indisponíveis.');await tx`select pg_advisory_xact_lock(hashtextextended(${config.hotel_id},0))`;
  const [prior]=await tx`select * from booking_requests where id=${id} for update`;if(prior&&prior.status==='awaiting_payment'&&new Date(prior.hold_until)>new Date()){response={requestId:id,amount:Number(prior.deposit_amount)/100,total:Number(prior.total)/100,total_cents:Number(prior.total),deposit_amount:Number(prior.deposit_amount),publicKey:publicKey(),expiresAt:prior.hold_until};return;}
  if(prior&&prior.status!=='pending')throw new Error('Esta tentativa já foi processada. Faça uma nova consulta.');
  const rooms=(await freeRooms(tx,config.hotel_id,checkin,checkout,guests,'',id)).filter((q:any)=>q.category===category);const room=rooms[0];if(!room)throw new Error('A disponibilidade mudou. Consulte novamente.');
  const quote=await stayQuote(tx,room,checkin,checkout,guests),{rate,total}=quote,deposit=quote.deposit,holdUntil=new Date(Date.now()+15*60_000).toISOString();
  const guestId=await guestFor(tx,config.hotel_id,name,phone);
  await tx`insert into booking_requests(id,hotel_id,name,phone,checkin,checkout,guests,category,notes,status,created,room_id,rate,total,deposit_amount,hold_until,guest_id,quoted_nights) values(${id},${config.hotel_id},${name},${phone},${checkin},${checkout},${guests},${category},${notes},'awaiting_payment',${new Date().toISOString()},${room.id},${rate},${total},${deposit},${holdUntil},${guestId},(${JSON.stringify(quote.nights)}::text)::jsonb) on conflict(id) do update set name=excluded.name,phone=excluded.phone,checkin=excluded.checkin,checkout=excluded.checkout,guests=excluded.guests,category=excluded.category,notes=excluded.notes,status='awaiting_payment',room_id=excluded.room_id,rate=excluded.rate,total=excluded.total,deposit_amount=excluded.deposit_amount,hold_until=excluded.hold_until,guest_id=excluded.guest_id,quoted_nights=excluded.quoted_nights where booking_requests.status='pending'`;
  response={requestId:id,amount:deposit/100,total:total/100,total_cents:total,deposit_amount:deposit,publicKey:publicKey(),expiresAt:holdUntil};
 });return response;
}

export async function pay(body:any){
 const requestId=uuid.parse(body.requestId),form=body.formData??{};const [r]=await sql`select * from booking_requests where id=${requestId} and status='awaiting_payment' and hold_until>now()`;if(!r)throw new Error('O tempo para pagamento terminou. Consulte novamente.');
 const paymentMethod=text(form.payment_method_id,40),isPix=paymentMethod==='pix',expiration=new Date(Date.now()+30*60_000).toISOString();if(isPix)await sql`update booking_requests set hold_until=${expiration} where id=${requestId}`;
 const payer:any={email:z.string().email().parse(form.payer?.email??form.payer?.email),first_name:String(r.name).split(' ')[0]};if(form.payer?.identification?.number)payer.identification={type:text(form.payer.identification.type,10),number:text(form.payer.identification.number,30)};
 await sql`update booking_requests set email=${payer.email} where id=${requestId}`;
 const payload:any={transaction_amount:Number(r.deposit_amount)/100,description:`Sinal de hospedagem Teles Plaza Hotel`,payment_method_id:paymentMethod,payer,external_reference:requestId,binary_mode:!isPix,additional_info:{items:[{id:requestId,title:'Sinal de hospedagem',quantity:1,unit_price:Number(r.deposit_amount)/100}]}};
 if(isPix)payload.date_of_expiration=expiration;
 if(!isPix){payload.token=text(form.token,300);payload.installments=1;if(form.issuer_id)payload.issuer_id=String(form.issuer_id)}
 const payment=await mercado('/v1/payments',{method:'POST',headers:{'X-Idempotency-Key':requestId},body:JSON.stringify(payload)});await reconcile(payment);
 const [settled]=await sql`select status from booking_requests where id=${requestId}`;
 return {total:Number(r.deposit_amount),reservationStatus:settled?.status,pix:payment.point_of_interaction?.transaction_data?.qr_code?{code:payment.point_of_interaction.transaction_data.qr_code,image:payment.point_of_interaction.transaction_data.qr_code_base64}:undefined,status:payment.status,statusDetail:payment.status_detail,requestId,qrCode:payment.point_of_interaction?.transaction_data?.qr_code,qrCodeBase64:payment.point_of_interaction?.transaction_data?.qr_code_base64,expiresAt:isPix?expiration:r.hold_until};
}

export async function paymentStatus(id:string){const requestId=uuid.parse(id);const [r]=await sql`select status,payment_status,reservation_id,hold_until,payment_id from booking_requests where id=${requestId}`;if(!r)throw new Error('Pagamento não encontrado.');if(r.payment_id&&!['confirmed','payment_review','payment_failed'].includes(r.status)){const payment=await mercado('/v1/payments/'+encodeURIComponent(r.payment_id));await reconcile(payment);const [fresh]=await sql`select status,payment_status,reservation_id,hold_until from booking_requests where id=${requestId}`;return fresh}return r}

export async function webhook(req:Request,url:URL){const secret=webhookSecret();if(!secret)return new Response(null,{status:503});const signature=req.headers.get('x-signature')??'',requestId=req.headers.get('x-request-id')??'',ts=signature.match(/(?:^|,)ts=([^,]+)/)?.[1]??'',v1=signature.match(/(?:^|,)v1=([^,]+)/)?.[1]??'',paymentId=url.searchParams.get('data.id')??url.searchParams.get('id')??'';if(!ts||!v1||!paymentId||Math.abs(Date.now()-Number(ts)*1000)>600_000)return new Response(null,{status:401});const expected=await hex(secret,`id:${paymentId};request-id:${requestId};ts:${ts};`);if(!same(expected,v1))return new Response(null,{status:401});const payment=await mercado('/v1/payments/'+encodeURIComponent(paymentId));await reconcile(payment);return new Response(null,{status:204})}
