import {reception,receptionActions,reservationDetail} from './reception.ts';
import {ratesRoute,stayQuote} from './rates.ts';
import {freeRooms} from './reception-domain.ts';
import {usersRoute} from './users.ts';
import {requestsRoute} from './requests.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {z} from 'npm:zod@3.25.76';
import {sql,database} from './db.ts';
import {handle as hotel} from './hotel.ts';
import {handle as operations} from './operations.ts';
import {validDay,nights,roomRate,validateBookingStart} from './hotel-domain.ts';
import {checkout,pay,paymentStatus,webhook} from './payments.ts';
const origins=new Set(['https://telesplazahotel.vercel.app','https://www.telesplazahotel.com.br','https://telesplazahotel.com.br']);
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const clean=(v:unknown,max=200)=>z.string().trim().min(1).max(max).parse(v);
const result=(data:unknown,status=200)=>Response.json(data,{status});
function dates(b:any){if(!validDay(b.checkin)||!validDay(b.checkout)||nights(b.checkin,b.checkout)<1||nights(b.checkin,b.checkout)>365)throw new Error('Confira as datas da estadia.');validateBookingStart(b.checkin);}
async function limit(req:Request,scope:string,max:number){const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown';const key=await digest(scope+':'+ip);const rows=await sql`insert into request_limits(key,window_start,count) values(${key},now(),1) on conflict(key) do update set count=case when request_limits.window_start<now()-interval '10 minutes' then 1 else request_limits.count+1 end,window_start=case when request_limits.window_start<now()-interval '10 minutes' then now() else request_limits.window_start end returning count`;if(rows[0].count>max)throw new Error('Muitas tentativas. Aguarde alguns minutos.');}
export async function dispatch(req:Request,auth=admin){
 const url=new URL(req.url),route=url.pathname.split('/hotel-api')[1]||'/';
 if(req.method==='GET'&&route==='/payment-config')return result({enabled:!!Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')&&!!Deno.env.get('MERCADOPAGO_PUBLIC_KEY'),public_key:Deno.env.get('MERCADOPAGO_PUBLIC_KEY')??''});
 if(req.method==='GET'&&route==='/health')return result({ok:true});
 if(route==='/payments'&&req.method==='POST')return webhook(req,url);
 if(route==='/checkout'&&req.method==='POST'){await limit(req,'checkout',12);return result(await checkout(await req.json()));}
 if(route==='/pay'&&req.method==='POST'){await limit(req,'pay',20);return result(await pay(await req.json()));}
 if(route==='/payment-status'&&req.method==='GET')return result(await paymentStatus(clean(url.searchParams.get('id'),50)));
 if(req.method==='GET'&&route==='/setup'){const a=await sql`select 1 from operator_invites where used_at is null and expires_at>now() limit 1`;return result({available:a.length===1});}
 if(req.method==='POST'&&route==='/setup'){
  await limit(req,'setup',10);const b=await req.json();const token=clean(b.code,100),email=z.string().trim().email().max(200).parse(b.email).toLowerCase(),password=z.string().min(12).max(128).parse(b.password);const hash=await digest(token);let newUser:string|null=null;
  try{await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(hashtextextended('administrator-activation',0))`;const a=await tx`select email from operator_invites where email=${email} and digest=${hash} and used_at is null and expires_at>now() for update`;if(!a.length)throw new Error('Código de ativação inválido ou expirado.');
   const created=await auth.auth.admin.createUser({email,password,email_confirm:true});if(created.error||!created.data.user)throw new Error('Não foi possível criar a conta. Confira o e-mail ou use o login se já possui cadastro.');newUser=created.data.user.id;
   const [existing]=await tx`select h.owner from portal_config p join hotels h on h.id=p.hotel_id where p.id=1`;const owner=existing?.owner??newUser;await tx`insert into operators(user_id,owner_id) values(${newUser},${owner})`;if(!existing){const hid=crypto.randomUUID();await tx`insert into hotels(id,owner,name,demo,created) values(${hid},${newUser},'Teles Plaza Hotel',0,${new Date().toISOString()})`;await tx`insert into portal_config(id,hotel_id) values(1,${hid})`;}await tx`update operator_invites set used_at=now() where email=${email}`;
  });return result({message:'Administrador ativado. Entre com seu e-mail e senha.'});}catch(e){if(newUser)await auth.auth.admin.deleteUser(newUser);throw e;}
 }
 if(route==='/availability'&&req.method==='GET'){
  const b=Object.fromEntries(url.searchParams);dates(b);const guests=z.coerce.number().int().min(1).max(50).parse(b.guests);const [config]=await sql`select hotel_id from portal_config where id=1`;if(!config)throw new Error('Reservas on-line indisponíveis.');const rooms=await freeRooms(sql,config.hotel_id,b.checkin,b.checkout,guests);const categories:any[]=[];
  for(const room of rooms){try{const q=await stayQuote(sql,room,b.checkin,b.checkout,guests);const existing=categories.find(x=>x.category===room.category);if(existing){existing.available++;existing.rate=Math.min(existing.rate,q.rate);existing.total=Math.min(existing.total,q.total);existing.deposit_amount=Math.min(existing.deposit_amount,q.deposit);existing.capacity=Math.max(existing.capacity,room.capacity);}else categories.push({category:room.category,available:1,capacity:room.capacity,rate:q.rate,total:q.total,deposit_amount:q.deposit});}catch(e){if(!String((e as Error).message).includes('Tarifa')&&!String((e as Error).message).includes('Saída'))throw e;}}
  return result({categories,online_payment:!!Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')&&!!Deno.env.get('MERCADOPAGO_PUBLIC_KEY')});
 }
 if(route==='/request'&&req.method==='POST'){
  await limit(req,'request',12);const b=await req.json();dates(b);const id=z.string().uuid().parse(b.id),name=clean(b.name,120),phone=clean(b.phone,30),category=clean(b.category,40),guests=z.coerce.number().int().min(1).max(50).parse(b.guests),notes=z.string().max(1000).parse(b.notes??'');if(phone.replace(/\D/g,'').length<10)throw new Error('Informe um telefone com DDD.');
  const [config]=await sql`select hotel_id from portal_config where id=1`;if(!config)throw new Error('As reservas on-line ainda não estão disponíveis. Fale com a recepção pelo WhatsApp.');
  await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(hashtextextended(${config.hotel_id},0))`;const [prior]=await tx`select id from booking_requests where id=${id}`;if(prior)return;
   if(category!=='Grupo'){const rooms=(await freeRooms(tx,config.hotel_id,b.checkin,b.checkout,guests,'',id)).filter((r:any)=>r.category===category);if(!rooms.length)throw new Error('A disponibilidade mudou. Consulte novamente.');await stayQuote(tx,rooms[0],b.checkin,b.checkout,guests);}
   await tx`insert into booking_requests(id,hotel_id,name,phone,checkin,checkout,guests,category,notes,created) values(${id},${config.hotel_id},${name},${phone},${b.checkin},${b.checkout},${guests},${category},${notes},${new Date().toISOString()})`;
  });return result({id,message:'Solicitação recebida. A recepção confirmará sua reserva pelo telefone informado.'});
 }
 // All remaining routes require a verified Supabase access token and an operator record.
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');if(!token)return result({error:'Entre com seu e-mail e senha.'},401);
 const {data,error}=await auth.auth.getUser(token);if(error||!data.user)return result({error:'Sua sessão expirou. Entre novamente.'},401);
 const [operator]=await sql`select owner_id,role,name from operators where user_id=${data.user.id} and active=1`;if(!operator)return result({error:'Conta sem acesso administrativo.'},403);const user={id:String(operator.owner_id),uid:data.user.id,email:data.user.email,role:operator.role};
 const payload=req.method==='POST'?await req.clone().json():null;const hid=String(payload?.hotel??url.searchParams.get('hotel')??'');
 if(route==='/users')return usersRoute(req,user,auth);
 if(route==='/rates'){if(!(await sql`select id from hotels where id=${hid} and owner=${user.id}`).length)return result({error:'Unidade sem acesso.'},403);return result(await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(hashtextextended(${hid},0))`;return ratesRoute(req,tx,hid,user.email??user.uid)}));}
 if(route==='/hotel'){
  if(req.method==='POST'&&receptionActions.has(payload?.action))return result(await reception(payload,user));
  if(req.method==='GET'&&url.searchParams.has('reservation')){if(!(await sql`select id from hotels where id=${hid} and owner=${user.id}`).length)return result({error:'Unidade sem acesso.'},403);return result(await reservationDetail(sql,hid,url.searchParams.get('reservation')!));}
  return hotel(req,user,database(hid||user.id));
 }
 if(route==='/operations')return operations(req,user,database(hid||user.id));
 if(route==='/requests')return requestsRoute(req,user,hid);
 return result({error:'Recurso não encontrado.'},404);
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');const allowed=!origin||origins.has(origin);if(!allowed)return result({error:'Origem não autorizada.'},403);
 const cors={'Access-Control-Allow-Origin':origin??'https://telesplazahotel.vercel.app','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-signature, x-request-id','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 let response:Response;try{if(!['GET','POST'].includes(req.method))response=result({error:'Método inválido.'},405);else if(Number(req.headers.get('content-length')??0)>65536)response=result({error:'Conteúdo muito grande.'},413);else response=await dispatch(req);}catch(e){console.error('hotel-api',(e as Error).message);const message=e instanceof z.ZodError?'Revise os campos informados.':(e as Error).message;response=result({error:/postgres|connect|relation|syntax|PG_|password authentication/i.test(message)?'Serviço temporariamente indisponível. Tente novamente.':message},400);}
 for(const [key,value] of Object.entries(cors))response.headers.set(key,value);return response;
});
