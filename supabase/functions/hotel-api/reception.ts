import {z} from 'npm:zod@3.25.76';
import {sql} from './db.ts';
import {today,validDay,cents,bookingTotal} from './hotel-domain.ts';
import {period,text,optional,now,guestFor,audit,freeRooms,totals,cashShift,methods} from './reception-domain.ts';
import {saveNights,nightsFor,stayQuote} from './rates.ts';
export const receptionActions=new Set(['reservation','reservation_group','reservation_update','room_move','regularize','status','entry','charge_void','charge_update','guest_record','reconcile']);
const identitySchema=z.object({name:z.string().trim().min(1).max(120),phone:z.string().trim().max(30).default(''),document_type:z.enum(['CPF','RG','Passaporte','CNH','Outro']).default('CPF'),document:z.string().max(30).default(''),birth_date:z.string().max(10).default(''),nationality:z.string().max(60).default('Brasileira'),email:z.union([z.literal(''),z.string().email()]).default(''),postal_code:z.string().max(10).default(''),address:z.string().max(150).default(''),address_number:z.string().max(20).default(''),complement:z.string().max(80).default(''),neighborhood:z.string().max(80).default(''),city:z.string().max(80).default(''),state:z.string().max(2).default('')});
const staySchema=z.object(Object.fromEntries(['reason','transport','previous_destination','next_destination','companions','checkin_time','checkout_time','profession','gender','race','disability','disability_type','country'].map(k=>[k,z.string().max(k==='companions'?1500:150).default('')])));
export async function reservationDetail(tx:any,hid:string,id:string){const [r]=await tx`select * from reservations where id=${id} and hotel_id=${hid}`;if(!r)throw new Error('Reserva não pertence à unidade.');const [guest]=await tx`select * from guests where id=${r.guest_id} and hotel_id=${hid}`;const [record]=await tx`select data,updated from guest_records where reservation_id=${id} and hotel_id=${hid}`;const rows=await tx`select * from reservation_nights where reservation_id=${id} order by day`;const moves=await tx`select * from room_moves where reservation_id=${id} and hotel_id=${hid} order by day,created`;return {reservation:r,guest:guest??null,record:record?.data??{},nights:rows.length?rows:nightsFor(r),moves};}
export async function reception(b:any,user:{id:string;email?:string}){
 const hid=text(b.hotel),actor=user.email??user.id,action=text(b.action);
 return await sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(hashtextextended(${hid},0))`;
  if(!(await tx`select id from hotels where id=${hid} and owner=${user.id}`).length)throw new Error('Unidade sem acesso.');
  let id=text(b.id),label='';
  if(action==='reservation'||action==='reservation_group'){
   const name=text(b.name,120),phone=optional(b.phone,30),company=optional(b.company,150),start=text(b.checkin,10),end=text(b.checkout,10);period(start,end);
   const items=action==='reservation_group'?z.array(z.object({room:z.string().min(1),rate:z.union([z.string(),z.number()]).optional(),guests:z.coerce.number().int().min(1).max(10)})).min(1).max(50).parse(b.rooms):[{room:text(b.room),rate:b.rate,guests:z.coerce.number().int().min(1).max(10).parse(b.guests)}];
   if(new Set(items.map(i=>i.room)).size!==items.length)throw new Error('Escolha cada quarto apenas uma vez.');
   const ids=items.map((i)=>action==='reservation_group'?id+':'+i.room:id);
   const existing=await tx`select id,hotel_id from reservations where id=any(${ids})`;
   if(existing.length){if(existing.length===items.length&&existing.every((r:any)=>r.hotel_id===hid))return {id:ids[0],ids,message:'Reservas já registradas.'};throw new Error('Identificador já utilizado. Atualize e tente novamente.');}
   const gid=await guestFor(tx,hid,name,phone,company,optional(b.guest_id,100));
   for(let i=0;i<items.length;i++){const item=items[i],room=(await freeRooms(tx,hid,start,end,item.guests)).find((q:any)=>q.id===item.room);if(!room)throw new Error('Quarto indisponível, ocupado ou sem capacidade. Nenhuma reserva foi criada.');
    const quote=item.rate!==undefined&&item.rate!==''?null:await stayQuote(tx,room,start,end,item.guests);const rate=quote?.rate??cents(item.rate),total=quote?.total??bookingTotal(start,end,rate);
    const [r]=await tx`insert into reservations(id,hotel_id,room_id,guest_id,name,phone,company,guests,checkin,checkout,rate,total,status,source,notes,created) values(${ids[i]},${hid},${room.id},${gid},${name},${phone},${company},${item.guests},${start},${end},${rate},${total},'confirmed',${text(b.source,40)},${optional(b.notes)+(action==='reservation_group'?' · Confirmar dados do hóspede':'')},${now()}) returning *`;
    await saveNights(tx,r,quote?.nights);await audit(tx,hid,actor,action==='reservation_group'?'Reserva em grupo criada':'Reserva criada',r.id);
   }return {id:ids[0],ids,message:items.length+' reserva(s) registrada(s).'};
  }
  if(action==='reconcile'){
   const [e]=await tx`select * from entries where id=${id} and hotel_id=${hid} and kind in ('payment','refund') and method in ('Cartão de crédito','Cartão de débito') and voided_at is null for update`;if(!e)throw new Error('Lançamento de cartão não encontrado.');
   await tx`update entries set card_auth=${optional(b.card_auth,100)},reconciled_at=${now()},reconciled_by=${actor} where id=${id} and hotel_id=${hid}`;label='Cartão conciliado';
  }else if(action==='entry'){
   const [existing]=await tx`select hotel_id from entries where id=${id}`;if(existing){if(existing.hotel_id!==hid)throw new Error('Identificador já utilizado.');return {id,message:'Lançamento já registrado.'};}
   const kind=z.enum(['payment','charge','refund','expense']).parse(b.kind),rid=kind==='expense'?null:text(b.reservation);let r:any,a:any;
   if(rid){[r]=await tx`select * from reservations where id=${rid} and hotel_id=${hid} for update`;if(!r||!['confirmed','checked_in'].includes(r.status))throw new Error('Reserva não encontrada ou conta encerrada.');a=await totals(tx,hid,r);}
   const quantity=kind==='charge'?z.coerce.number().int().min(1).max(10000).parse(b.quantity??1):1,unit=kind==='charge'?cents(b.unit_price??b.amount):cents(b.amount),amount=unit*quantity;
   if(!Number.isSafeInteger(amount)||amount>1_000_000_000)throw new Error('Valor total acima do limite.');
   if(kind==='payment'&&amount>a.balance)throw new Error('O recebimento excede o saldo.');if(kind==='refund'&&amount>Math.max(0,-a.balance))throw new Error('A devolução excede o crédito a devolver. Exclua o consumo incorreto antes de registrar a devolução.');
   const due=text(b.due,10);if(!validDay(due))throw new Error('Data inválida.');const method=kind==='charge'?'':methods.parse(b.method),paid=kind==='expense'?z.coerce.number().int().min(0).max(1).parse(b.paid):1,shift=paid?await cashShift(tx,hid,method):null;
   await tx`insert into entries(id,hotel_id,reservation_id,kind,amount,description,method,due,paid,created,actor,shift_id,quantity,unit_price,card_brand,card_auth) values(${id},${hid},${rid},${kind},${amount},${(kind==='charge'?quantity+'× ':'')+text(b.description,180)},${method},${due},${paid},${now()},${actor},${shift},${quantity},${unit},${optional(b.card_brand,60)},${optional(b.card_auth,100)})`;label=kind==='charge'?'Consumo lançado':kind==='refund'?'Devolução registrada':'Lançamento registrado';
  }else{
   if(action==='charge_void'){const [e]=await tx`select * from entries where id=${id} and hotel_id=${hid} and kind='charge'`;if(!e)throw new Error('Consumo não encontrado.');const [r]=await tx`select * from reservations where id=${e.reservation_id} and hotel_id=${hid} for update`;if(!r||!['confirmed','checked_in'].includes(r.status))throw new Error('Conta encerrada.');if(e.voided_at)return {id,message:'Consumo já excluído.'};await tx`update entries set voided_at=${now()},voided_by=${actor} where id=${id} and hotel_id=${hid}`;label='Consumo excluído: '+e.description;
   }else if(action==='charge_update'){
    const [e]=await tx`select * from entries where id=${id} and hotel_id=${hid} and kind='charge' and voided_at is null`;if(!e)throw new Error('Consumo não encontrado ou já excluído.');
    const [r]=await tx`select * from reservations where id=${e.reservation_id} and hotel_id=${hid} for update`;if(!r||!['confirmed','checked_in'].includes(r.status))throw new Error('Conta encerrada.');
    const quantity=z.coerce.number().int().min(1).max(10000).parse(b.quantity),unit=cents(b.unit_price),amount=unit*quantity,due=text(b.due,10);
    if(!Number.isSafeInteger(amount)||amount>1_000_000_000)throw new Error('Valor total acima do limite.');if(!validDay(due))throw new Error('Data inválida.');
    const description=quantity+'× '+text(b.description,180);
    await tx`update entries set amount=${amount},quantity=${quantity},unit_price=${unit},description=${description},due=${due} where id=${id} and hotel_id=${hid}`;
    label=`Consumo alterado: ${e.description} (R$ ${(e.amount/100).toFixed(2)}) → ${description} (R$ ${(amount/100).toFixed(2)})`;
   }else{
    const [r]=await tx`select * from reservations where id=${id} and hotel_id=${hid} for update`;if(!r)throw new Error('Reserva não pertence à unidade.');
    const active=['confirmed','checked_in'].includes(r.status),a=await totals(tx,hid,r);
    if(action==='reservation_update'){
     const name=text(b.name,120),phone=optional(b.phone,30),company=optional(b.company,150);const changed=name.trim().toLowerCase()!==r.name.trim().toLowerCase()||phone.replace(/\D/g,'')!==r.phone.replace(/\D/g,'');const gid=changed||!r.guest_id?await guestFor(tx,hid,name,phone,company):r.guest_id;
     const start=optional(b.checkin,10)||r.checkin,end=optional(b.checkout,10)||r.checkout,count=b.guests===undefined?r.guests:z.coerce.number().int().min(1).max(10).parse(b.guests),rate=b.rate===undefined?r.rate:cents(b.rate);const repriced=start!==r.checkin||end!==r.checkout||rate!==r.rate||count!==r.guests;
     if(!active&&repriced)throw new Error('Conta encerrada: somente dados cadastrais podem ser alterados.');
     let total=r.total;
     if(repriced){period(start,end);const moves=await tx`select * from room_moves where reservation_id=${id} order by day,created`;
      if(moves.some((m:any)=>m.day<start||m.day>=end))throw new Error('O período precisa incluir todas as trocas de quarto registradas.');
      total=rate===r.rate&&start===r.checkin&&end===r.checkout?r.total:bookingTotal(start,end,rate);
      const rows=nightsFor({...r,checkin:start,checkout:end,total});let initial=moves[0]?.from_room??r.room_id;
      for(const row of rows){for(const m of moves)if(m.day<=row.day)initial=m.to_room;row.room_id=initial;const available=await freeRooms(tx,hid,row.day,new Date(Date.parse(row.day+'T12:00:00Z')+86400000).toISOString().slice(0,10),count,id);if(!available.some((q:any)=>q.id===initial))throw new Error('Conflito de quarto ou capacidade no novo período.');}
      await saveNights(tx,r,rows);
     }
     await tx`update reservations set name=${name},phone=${phone},company=${company},guest_id=${gid},source=${text(b.source??r.source,40)},notes=${optional(b.notes)},checkin=${start},checkout=${end},guests=${count},rate=${rate},total=${total} where id=${id} and hotel_id=${hid}`;label='Reserva editada';
    }else if(action==='room_move'){
     if(!active)throw new Error('Conta encerrada.');const day=text(b.day,10),roomId=text(b.room);if(!validDay(day)||day<r.checkin||day>=r.checkout||(r.status==='checked_in'&&day>today()))throw new Error('Informe o dia da troca dentro da estadia; para hospedado, até hoje.');
     const previous=await tx`select * from room_moves where reservation_id=${id} order by day desc,created desc`;if(previous.length&&day<previous[0].day)throw new Error('Registre a troca após a última movimentação.');if(roomId===r.room_id)throw new Error('Escolha outro quarto.');
     const room=(await freeRooms(tx,hid,day,r.checkout,r.guests,id)).find((q:any)=>q.id===roomId);if(!room)throw new Error('Quarto ocupado, bloqueado ou sem capacidade.');
     if(r.status==='checked_in'&&day===today()&&room.state!=='clean')throw new Error('Libere a limpeza do quarto antes da troca.');
     const rows=await tx`select * from reservation_nights where reservation_id=${id} order by day`;if(!rows.length)await saveNights(tx,r);
     await tx`update reservation_nights set room_id=${roomId} where reservation_id=${id} and day>=${day}`;
     await tx`insert into room_moves(id,hotel_id,reservation_id,from_room,to_room,day,actor,created) values(${crypto.randomUUID()},${hid},${id},${r.room_id},${roomId},${day},${actor},${now()})`;
     await tx`update reservations set room_id=${roomId} where id=${id} and hotel_id=${hid}`;
     if(r.status==='checked_in'&&day===today())await tx`update rooms set state='dirty' where id=${r.room_id} and hotel_id=${hid}`;label='Troca de quarto registrada em '+day;
    }else if(action==='regularize'||action==='status'){
     const status=action==='regularize'?'checked_out':z.enum(['checked_in','checked_out','cancelled']).parse(b.status);
     if(!active)throw new Error('Reserva já encerrada.');
     if(action==='regularize'){if(r.status!=='confirmed'||r.checkout>today())throw new Error('Regularização exige reserva confirmada com saída até hoje.');if(a.balance!==0)throw new Error('Quite o saldo antes de regularizar.');}
     else if(status==='checked_in'){if(r.status!=='confirmed'||r.checkin>today()||r.checkout<=today())throw new Error('Check-in fora do período reservado.');const [room]=await tx`select * from rooms where id=${r.room_id} and hotel_id=${hid}`;if(room?.state!=='clean')throw new Error('O quarto precisa estar limpo.');if((await tx`select id from reservations where hotel_id=${hid} and room_id=${r.room_id} and status='checked_in' and id<>${id}`).length)throw new Error('O quarto ainda possui hóspede sem check-out.');}
     else if(status==='checked_out'){if(r.status!=='checked_in'||a.balance!==0)throw new Error('Check-out exige hóspede hospedado e saldo zero.');}
     else {if(r.status!=='confirmed')throw new Error('Use check-out para encerrar uma hospedagem iniciada.');if(a.paid>0){const settle=z.enum(['refund','retain']).parse(b.settle);if(settle==='refund'){const method=methods.parse(b.method),shift=await cashShift(tx,hid,method);await tx`insert into entries(id,hotel_id,reservation_id,kind,amount,description,method,due,paid,created,actor,shift_id) values(${crypto.randomUUID()},${hid},${id},'refund',${a.paid},'Devolução registrada no cancelamento',${method},${today()},1,${now()},${actor},${shift})`;}await tx`update reservations set cancellation_settlement=${settle},cancellation_amount=${a.paid} where id=${id}`;}}
     await tx`update reservations set status=${status} where id=${id} and hotel_id=${hid}`;
     if(status==='checked_out'&&action!=='regularize')await tx`update rooms set state='dirty' where id=${r.room_id} and hotel_id=${hid}`;
     label=action==='regularize'?'Estadia regularizada':status==='cancelled'?'Reserva cancelada · '+(b.settle==='retain'?'valor retido como multa/no-show':a.paid>0?'devolução registrada':'sem valor recebido'):status==='checked_in'?'Check-in realizado':'Check-out realizado';
    }else if(action==='guest_record'){
     const g=identitySchema.parse(b.guest),record=staySchema.parse(b.record??{});if(g.birth_date&&(!validDay(g.birth_date)||g.birth_date>today()))throw new Error('Nascimento inválido.');
     for(const k of ['checkin_time','checkout_time'])if(record[k]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(record[k]))throw new Error('Horário inválido.');
     const changed=g.name.trim().toLowerCase()!==r.name.trim().toLowerCase()||g.phone.replace(/\D/g,'')!==r.phone.replace(/\D/g,'');
     const gid=changed||!r.guest_id?await guestFor(tx,hid,g.name,g.phone,r.company):r.guest_id;
     await tx`update guests set name=${g.name},phone=${g.phone},document_type=${g.document_type},document=${g.document.replace(/[^\p{L}\p{N}]/gu,'').toUpperCase()},birth_date=${g.birth_date},nationality=${g.nationality},email=${g.email},postal_code=${g.postal_code},address=${g.address},address_number=${g.address_number},complement=${g.complement},neighborhood=${g.neighborhood},city=${g.city},state=${g.state.toUpperCase()},updated=${now()} where id=${gid} and hotel_id=${hid}`;
     await tx`update reservations set guest_id=${gid},name=${g.name},phone=${g.phone} where id=${id} and hotel_id=${hid}`;
     await tx`insert into guest_records(reservation_id,hotel_id,data,updated,actor) values(${id},${hid},(${JSON.stringify(record)}::text)::jsonb,${now()},${actor}) on conflict(reservation_id) do update set data=excluded.data,updated=excluded.updated,actor=excluded.actor`;label='Ficha do hóspede atualizada';
    }else throw new Error('Ação desconhecida.');
   }
  }
  await audit(tx,hid,actor,label,id);return {id,message:label};
 });
}
