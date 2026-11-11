import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
for(const path of ['sys-src/lib/hotel-domain.ts','supabase/functions/hotel-api/hotel-domain.ts']){
 const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
 const {account}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 test(path+': exclusão gera crédito e devolução liquida esse crédito',()=>{
  const r={id:'booking',total:19000};
  const charge={reservation_id:r.id,kind:'charge',amount:3000};
  const payment={reservation_id:r.id,kind:'payment',amount:22000};
  const excluded={...charge,voided_at:'2026-11-10T12:00:00Z'};
  const refund={reservation_id:r.id,kind:'refund',amount:1000};
  assert.equal(account({...r,total:10000},[{...payment,amount:20000}]).balance,-10000);
  assert.equal(account({...r,total:10000},[{...payment,amount:20000},{...refund,amount:10000}]).balance,0);
  assert.equal(account(r,[charge,payment]).balance,0);
  assert.equal(account(r,[excluded,payment]).balance,-3000);
  assert.equal(account(r,[excluded,payment,refund]).balance,-2000);
  assert.equal(account(r,[excluded,payment,{...refund,amount:3000}]).balance,0);
  assert.equal(account(r,[excluded,payment,{...refund,voided_at:'2026-11-10T13:00:00Z'}]).balance,-3000);
  assert.equal(account(r,[{...payment,amount:19000},excluded,{...refund,amount:3000}]).balance,3000);
  assert.equal(account(r,[{...payment,amount:19000},{...charge,reservation_id:'other'}]).balance,0);
 });
}
test('redução de reserva paga pode gerar crédito antes da devolução',()=>{
 const source=readFileSync('supabase/functions/hotel-api/reception.ts','utf8');
 const pricing=source.slice(source.indexOf('total=rate===r.rate'),source.indexOf('const rows=nightsFor'));
 const reprice=new Function('r','a','rate','start','end','bookingTotal',`let total;${pricing};return total;`);
 const r={total:20000,rate:20000,checkin:'2026-11-10',checkout:'2026-11-11'};
 assert.equal(reprice(r,{charges:20000,paid:20000},10000,r.checkin,r.checkout,()=>10000),10000);
});
test('ficha envia cadastro e estadia separados, preservando campos não editados',()=>{
 const source=readFileSync('sys-src/app/guest-record.tsx','utf8');
 const start=source.indexOf("JSON.stringify({action:'guest_record'")+15;
 const end=source.indexOf(')});const d=',start);
 const payload=new Function('hotel','reservation','record','original',`return (${source.slice(start,end)});`);
 const record={full_name:'Hóspede teste',phone:'',email:'',nationality:'Brasileira',birth:'1990-01-01',doc_type:'CPF',doc_number:'123',address:'Rua teste',number:'10',complement:'',cep:'12345678',city:'Cidade',state:'SP',profession:'Teste',gender:'',race:'',disability:'sim',disability_type:'Visual',country:'Brasil',companions:'',last_destination:'Origem',next_destination:'Destino',reason:'Lazer',transport:'Automóvel',arrival_time:'14:00',departure_time:'12:00'};
 const result=payload('hotel',{id:'booking'},record,{guest:{neighborhood:'Bairro preservado'},record:{}});
 assert.equal(result.guest.name,record.full_name);
 assert.equal(result.guest.neighborhood,'Bairro preservado');
 assert.equal(result.guest.birth_date,record.birth);
 assert.equal(result.guest.document,record.doc_number);
 assert.equal(result.record.previous_destination,record.last_destination);
 assert.equal(result.record.checkin_time,record.arrival_time);
 assert.equal(result.record.checkout_time,record.departure_time);
 assert.equal(result.record.disability_type,'Visual');
 assert.equal(result.record.country,'Brasil');
 const api=readFileSync('supabase/functions/hotel-api/reception.ts','utf8');
 const schemas=new Function('z',api.slice(api.indexOf('const identitySchema='),api.indexOf('export async function reservationDetail'))+';return {identitySchema,staySchema};')(z);
 assert.equal(schemas.identitySchema.parse(result.guest).neighborhood,'Bairro preservado');
 const saved=schemas.staySchema.parse(result.record);
 assert.equal(saved.disability_type,'Visual');
 assert.equal(saved.country,'Brasil');
 assert.equal(saved.previous_destination,'Origem');
});
test('API de recepção permanece sintaticamente válida',()=>{
 const output=ts.transpileModule(readFileSync('supabase/functions/hotel-api/reception.ts','utf8'),{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 assert.deepEqual(output.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
});
test('edição de consumo: ação registrada, total recalculado e descrição sem prefixo duplicado',()=>{
 const api=readFileSync('supabase/functions/hotel-api/reception.ts','utf8'),panel=readFileSync('sys-src/app/hotel-app.tsx','utf8');
 assert.match(api,/receptionActions=new Set\([^)]*'charge_update'/);
 const branch=api.slice(api.indexOf("action==='charge_update'"),api.indexOf("label=`Consumo alterado"));
 assert.match(branch,/amount=unit\*quantity/);assert.match(branch,/voided_at is null/);assert.match(branch,/'confirmed','checked_in'/);
 const strip=d=>d.replace(/^\d+× /,'');
 assert.ok(panel.includes(".replace(/^\\d+× /,'')"));
 assert.equal(strip('3× Água mineral'),'Água mineral');assert.equal(strip('1× 3× Água mineral'),'3× Água mineral');
});
