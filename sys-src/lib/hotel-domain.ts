export const BOOKING_START = '2026-10-05';
export function earliestBookingDate(day = today()) { return day < BOOKING_START ? BOOKING_START : day; }
export function validateBookingStart(day: string) { if (day < BOOKING_START) throw new Error('Reservas disponíveis para entrada a partir de 05/10/2026.'); if (day < today()) throw new Error('A entrada não pode ser anterior a hoje.'); }
// O painel aceita entradas passadas para regularizar estadias que não foram lançadas no dia.
export const RETRO_DAYS = 180;
export function validateAdminStart(day: string) { if (!validDay(day)) throw new Error('Informe uma data válida.'); if (day < addDays(today(), -RETRO_DAYS)) throw new Error('Lançamentos retroativos aceitam entradas dos últimos 180 dias.'); }
export function today() { return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date()); }
export function addDays(day:string,n:number){return new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function nights(start:string,end:string){return Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000);}
export function validDay(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function cents(value:unknown){const n=Number(String(value).replace(',','.'));if(!Number.isFinite(n)||n<=0||n>10000000)throw new Error('Informe um valor maior que zero e até R$ 10 milhões.');return Math.round(n*100);}
export function bookingTotal(start:string,end:string,rate:number){if(!validDay(start)||!validDay(end)||nights(start,end)<1||nights(start,end)>365)throw new Error('A hospedagem deve ter entre 1 e 365 diárias.');return nights(start,end)*rate;}
export function money(n:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);}
export function shortDay(s:string){return s?s.slice(8,10)+'/'+s.slice(5,7):'—';}
export type Hotel={id:string;name:string;demo:number};
export type Room={id:string;hotel_id:string;number:string;category:string;capacity:number;rate:number;state:string;floor:string;extra_guest_rate?:number};
export type Reservation={id:string;hotel_id:string;room_id:string;name:string;phone:string;company:string;guests:number;checkin:string;checkout:string;rate:number;total:number;status:string;source:string;notes:string;created:string};
export type Entry={id:string;hotel_id:string;reservation_id:string|null;kind:string;amount:number;description:string;method:string;due:string;paid:number;created:string;actor?:string;card_brand?:string;card_auth?:string;reconciled_at?:string|null;reconciled_by?:string|null;payment_id?:string|null;voided_at?:string|null;voided_by?:string|null};
export type RoomMove={id:string;reservation_id:string;from_room:string;to_room:string;day:string;created:string;actor:string};
export type HotelData={hotels:Hotel[];hotel:Hotel|null;rooms:Room[];reservations:Reservation[];entries:Entry[];moves:RoomMove[];audit:{id:number;action:string;entity:string;created:string;actor:string}[];user:string;role?:string;today:string};
export function account(r:Reservation,es:Entry[]){let charges=r.total,paid=0;for(const e of es.filter(e=>e.reservation_id===r.id&&!e.voided_at)){if(e.kind==='charge')charges+=e.amount;if(e.kind==='payment')paid+=e.amount;if(e.kind==='refund')paid-=e.amount;}return {charges,paid,balance:charges-paid};}

export function roomRate(room:{rate:number;extra_guest_rate?:number},guests:number){return room.rate+Math.max(0,guests-2)*(room.extra_guest_rate??0);}

export type Night={day:string;rate:number;extra_guest_rate:number};
// Cotação de uma estadia a partir das diárias do período. Substitui noites*diária,
// que passa a estar errado assim que o tarifário varia dentro da estadia.
export function stayQuote(nights:Night[],guests:number){
  if(!nights.length)throw new Error('Não há tarifa publicada para o período. Fale com a recepção.');
  const extra=Math.max(0,guests-2);
  const nightly=nights.map(n=>({day:n.day,rate:n.rate+extra*(n.extra_guest_rate??0)}));
  const total=nightly.reduce((s,n)=>s+n.rate,0);
  return {nightly,total,average:Math.round(total/nightly.length)};
}
// Ajusta a última noite para que as diárias gravadas somem exatamente o total
// cotado ao hóspede, mesmo que o tarifário tenha mudado depois da cotação.
export function spreadTotal(total:number,nightly:{day:string;rate:number}[]){
  if(!nightly.length)return nightly;
  const soma=nightly.reduce((s,n)=>s+n.rate,0);
  if(soma===total)return nightly;
  const last=nightly.length-1;
  return nightly.map((n,i)=>i===last?{day:n.day,rate:Math.max(0,n.rate+(total-soma))}:n);
}

// Quarto ocupado pela reserva em um dia, considerando as trocas registradas na estadia.
export function roomOn(r:{id:string;room_id:string},day:string,moves:RoomMove[]){
  const ms=moves.filter(m=>m.reservation_id===r.id).sort((a,b)=>a.day.localeCompare(b.day));
  if(!ms.length)return r.room_id;
  let room=ms[0].from_room;
  for(const m of ms)if(m.day<=day)room=m.to_room;
  return room;
}
