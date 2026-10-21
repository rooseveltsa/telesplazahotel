import {z} from 'npm:zod@3.25.76';
import {addDays,nights,validDay,cents,roomRate} from './hotel-domain.ts';
import {audit,now,text} from './reception-domain.ts';
export function spreadTotal(start:string,end:string,total:number,room_id?:string){const count=nights(start,end),base=Math.floor(total/count);return Array.from({length:count},(_,i)=>({day:addDays(start,i),rate:base+(i<total%count?1:0),room_id}));}
export function nightsFor(r:any){return spreadTotal(r.checkin,r.checkout,r.total,r.room_id);}
export async function saveNights(tx:any,r:any,rows:any[]=nightsFor(r)){
 await tx`delete from reservation_nights where reservation_id=${r.id}`;
 for(const n of rows)await tx`insert into reservation_nights(reservation_id,day,rate,room_id) values(${r.id},${n.day},${n.rate},${n.room_id??r.room_id})`;
}
export async function stayQuote(tx:any,room:any,start:string,end:string,guests:number){
 if(!validDay(start)||!validDay(end)||nights(start,end)<1||nights(start,end)>365)throw new Error('Confira as datas.');
 const [plan]=await tx`select * from rate_plans where hotel_id=${room.hotel_id} and code='BALCAO' and active=1`;
 const rates=plan?await tx`select * from daily_rates where hotel_id=${room.hotel_id} and plan_id=${plan.id} and category=${room.category} and day>=${start} and day<=${end}`:[];
 const count=nights(start,end),rows=[];
 for(let i=0;i<count;i++){const day=addDays(start,i),d=rates.find((r:any)=>r.day===day);if(d&&(d.closed||count<d.min_stay||(i===0&&d.closed_to_arrival)))throw new Error('Tarifa indisponível para o período ou permanência mínima não atendida.');rows.push({day,rate:roomRate(room,guests),room_id:room.id});}// Price always comes from the room (edited in the panel); daily_rates only restricts dates.
 if(rates.some((d:any)=>d.day===end&&d.closed_to_departure))throw new Error('Saída indisponível nesta data.');
 const total=rows.reduce((s,r)=>s+r.rate,0);return {total,rate:Math.round(total/count),nights:rows,deposit:rows.slice(0,plan?.deposit_nights??1).reduce((s,r)=>s+r.rate,0)};
}
export async function ratesRoute(req:Request,tx:any,hid:string,actor:string){
 if(req.method==='GET'){const u=new URL(req.url);const start=u.searchParams.get('start')??u.searchParams.get('from')??new Date().toISOString().slice(0,10),end=u.searchParams.get('end')??u.searchParams.get('to')??addDays(start,31);if(!validDay(start)||!validDay(end)||nights(start,end)<0||nights(start,end)>366)throw new Error('Informe um período de até 366 dias.');const plans=await tx`select * from rate_plans where hotel_id=${hid} order by code`;const rates=await tx`select * from daily_rates where hotel_id=${hid} and day>=${start} and day<=${end} order by day,category`;return {plans,rates};}
 const b=await req.json(),start=text(b.start,10),end=text(b.end,10),category=text(b.category,60);if(!validDay(start)||!validDay(end)||nights(start,end)<0||nights(start,end)>366)throw new Error('Informe um período de até 366 dias.');
 if(!(await tx`select id from rooms where hotel_id=${hid} and category=${category}`).length)throw new Error('Categoria não pertence ao hotel.');
 let [plan]=await tx`select * from rate_plans where hotel_id=${hid} and code='BALCAO'`;
 if(!plan){const id='plan-balcao-'+hid;[plan]=await tx`insert into rate_plans(id,hotel_id,code,name,created) values(${id},${hid},'BALCAO','Balcão',${now()}) returning *`;}
 const rate=cents(b.rate),extra=Math.round(z.coerce.number().min(0).max(100000).parse(b.extra_guest_rate??0)*100),min=z.coerce.number().int().min(1).max(30).parse(b.min_stay??1);
 const flag=(v:any)=>z.coerce.number().int().min(0).max(1).parse(v??0);
 for(let day=start;day<=end;day=addDays(day,1))await tx`insert into daily_rates(hotel_id,plan_id,category,day,rate,extra_guest_rate,min_stay,closed,closed_to_arrival,closed_to_departure,updated) values(${hid},${plan.id},${category},${day},${rate},${extra},${min},${flag(b.closed)},${flag(b.closed_to_arrival)},${flag(b.closed_to_departure)},${now()}) on conflict(hotel_id,plan_id,category,day) do update set rate=excluded.rate,extra_guest_rate=excluded.extra_guest_rate,min_stay=excluded.min_stay,closed=excluded.closed,closed_to_arrival=excluded.closed_to_arrival,closed_to_departure=excluded.closed_to_departure,updated=excluded.updated`;
 await audit(tx,hid,actor,'Tarifário atualizado: '+category+' · '+start+' a '+end,plan.id);return {message:'Tarifas atualizadas. Reservas existentes preservadas.'};
}
