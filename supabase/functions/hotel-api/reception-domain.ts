import {z} from 'npm:zod@3.25.76';
import {today,addDays,validDay,nights} from './hotel-domain.ts';
export const RETRO_DAYS=180;
export function validateAdminStart(day:string){if(!validDay(day)||day<addDays(today(),-RETRO_DAYS))throw new Error('A entrada deve estar no máximo 180 dias no passado.');}
export function period(start:string,end:string){validateAdminStart(start);if(!validDay(end)||nights(start,end)<1||nights(start,end)>365)throw new Error('A hospedagem deve ter entre 1 e 365 diárias.');}
export const text=(v:unknown,max=200)=>z.string().trim().min(1).max(max).parse(v);
export const optional=(v:unknown,max=1000)=>z.string().trim().max(max).parse(v??'');
export const now=()=>new Date().toISOString();
export const methods=z.enum(['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência']);
export async function guestFor(tx:any,hid:string,name:string,phone:string,company='',chosen=''){
 if(chosen){const [g]=await tx`select * from guests where hotel_id=${hid} and id=${chosen}`;if(!g)throw new Error('Hóspede não pertence à unidade.');if(g.name.trim().toLowerCase()===name.trim().toLowerCase()&&g.phone.replace(/\D/g,'')===phone.replace(/\D/g,''))return g.id;}
 const [found]=await tx`select id from guests where hotel_id=${hid} and lower(btrim(name))=lower(btrim(${name})) and regexp_replace(phone,'[^0-9]','','g')=${phone.replace(/\D/g,'')} order by created,id limit 1`;
 if(found)return found.id;
 const id=crypto.randomUUID(),stamp=now();await tx`insert into guests(id,hotel_id,name,phone,company,created,updated) values(${id},${hid},${name},${phone},${company},${stamp},${stamp})`;return id;
}
export async function audit(tx:any,hid:string,actor:string,action:string,entity:string){await tx`insert into audit(hotel_id,actor,action,entity,created) values(${hid},${actor},${action},${entity},${now()})`;}
export async function freeRooms(tx:any,hid:string,start:string,end:string,guests:number,except='',request=''){
 return await tx`select * from rooms where hotel_id=${hid} and state!='blocked' and capacity>=${guests} and room_available(${hid},id,${start},${end},${except},${request}) order by number`;
}
export async function totals(tx:any,hid:string,r:any){const [a]=await tx`select coalesce(sum(case kind when 'charge' then amount else 0 end),0)::integer as charges,coalesce(sum(case kind when 'payment' then amount when 'refund' then -amount else 0 end),0)::integer as paid from entries where hotel_id=${hid} and reservation_id=${r.id} and voided_at is null`;return {charges:r.total+a.charges,paid:a.paid,balance:r.total+a.charges-a.paid};}
export async function cashShift(tx:any,hid:string,method:string){if(method!=='Dinheiro')return null;const [s]=await tx`select id from cash_shifts where hotel_id=${hid} and closed is null for update`;if(!s)throw new Error('Abra o caixa antes de registrar pagamentos em dinheiro.');return s.id;}
