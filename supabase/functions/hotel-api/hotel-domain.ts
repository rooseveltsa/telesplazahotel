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
export type Entry={id:string;hotel_id:string;reservation_id:string|null;kind:string;amount:number;description:string;method:string;due:string;paid:number;created:string};
export type HotelData={hotels:Hotel[];hotel:Hotel|null;rooms:Room[];reservations:Reservation[];entries:Entry[];audit:{id:number;action:string;entity:string;created:string;actor:string}[];user:string;today:string};
export function account(r:Reservation,es:Entry[]){let charges=r.total,paid=0;for(const e of es.filter(e=>e.reservation_id===r.id)){if(e.kind==='charge')charges+=e.amount;if(e.kind==='payment')paid+=e.amount;if(e.kind==='refund')paid-=e.amount;}return {charges,paid,balance:charges-paid};}

export function roomRate(room:{rate:number;extra_guest_rate?:number},guests:number){return room.rate+Math.max(0,guests-2)*(room.extra_guest_rate??0);}
