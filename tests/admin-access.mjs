import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.TEST_SUPABASE_URL;
assert.ok(base && base!=='https://kukhsxcaqcywsvbkwhrm.supabase.co','Use um projeto Supabase isolado para testes; produção não é permitida.');
async function request(path,body,token){const r=await fetch(base+'/functions/v1/hotel-api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});return {status:r.status,data:await r.json()}}
const tokens=[],ids=[];
for(const email of ['teles-validation-a@example.invalid','teles-validation-b@example.invalid']){const password=crypto.randomUUID()+crypto.randomUUID();const r=await request('/setup',{email,password,code:process.env.TEST_ACTIVATION});assert.equal(r.status,200,JSON.stringify(r.data));const login=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json',apikey:process.env.TEST_SUPABASE_KEY},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(25000)});const data=await login.json();assert.equal(login.status,200);tokens.push(data.access_token);ids.push(data.user.id);writeFileSync('/tmp/teles-test-admins.json',JSON.stringify(ids),{mode:0o600});}
const a=await request('/hotel',null,tokens[0]),b=await request('/hotel',null,tokens[1]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.data.hotel.id,b.data.hotel.id);
assert.equal((await request('/hotel',{action:'room',hotel:a.data.hotel.id,number:'TESTE',category:'Casal',capacity:2,rate:200,floor:'1'},tokens[1])).status,200);
assert.equal((await request('/hotel',null,tokens[0])).data.rooms.length,1);
assert.equal((await request('/setup',{email:'not-authorized@example.invalid',password:crypto.randomUUID(),code:process.env.TEST_ACTIVATION})).status,400);
assert.equal((await request('/setup',{email:'teles-validation-a@example.invalid',password:crypto.randomUUID(),code:process.env.TEST_ACTIVATION})).status,400);
console.log('PASS: dois administradores compartilham a unidade; e-mail não autorizado e reuso de ativação rejeitados.');
