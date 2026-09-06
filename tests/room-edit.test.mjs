import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
test('edição de quarto preserva reservas, valida capacidade e isola unidades',async()=>{
 const dir=mkdtempSync(resolve('tests/.room-edit-'));const sqlite=new DatabaseSync(':memory:');
 try{
 for(const name of ['hotel','hotel-domain']){const source=readFileSync('supabase/functions/hotel-api/'+name+'.ts','utf8').replace("'npm:zod@3.25.76'","'zod'").replace("'./hotel-domain.ts'","'./hotel-domain.mjs'");writeFileSync(dir+'/'+name+'.mjs',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
 const {handle}=await import(pathToFileURL(dir+'/hotel.mjs'));
 sqlite.exec(`CREATE TABLE hotels(id TEXT PRIMARY KEY,owner TEXT);CREATE TABLE rooms(id TEXT PRIMARY KEY,hotel_id TEXT,number TEXT,category TEXT,capacity INTEGER,rate INTEGER,state TEXT,floor TEXT,UNIQUE(hotel_id,number));CREATE TABLE reservations(id TEXT,hotel_id TEXT,room_id TEXT,status TEXT,guests INTEGER,rate INTEGER,total INTEGER);CREATE TABLE audit(id INTEGER PRIMARY KEY,hotel_id TEXT,actor TEXT,action TEXT,entity TEXT,created TEXT);CREATE TABLE operation_guards(id TEXT PRIMARY KEY,capacity INTEGER DEFAULT 1 CONSTRAINT CAPACIDADE CHECK(capacity=1));INSERT INTO hotels VALUES('unit','owner'),('other','someone');INSERT INTO rooms VALUES('room','unit','101','Duplo',2,24000,'dirty','1'),('second','unit','102','Duplo',2,24000,'clean','1'),('foreign','other','201','Duplo',2,24000,'clean','1');INSERT INTO reservations VALUES('booking','unit','room','confirmed',2,24000,48000);`);
 class Statement{constructor(query){this.query=query;this.values=[]}bind(...values){this.values=values;return this}async first(){return sqlite.prepare(this.query).get(...this.values)??null}}
 const db={prepare:q=>new Statement(q),batch:async statements=>{sqlite.exec('BEGIN');try{for(const s of statements)sqlite.prepare(s.query).run(...s.values);sqlite.exec('COMMIT');return []}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 const payload={action:'room_update',hotel:'unit',id:'room',number:'101A',category:'Triplo',capacity:3,rate:290,floor:'2'};
 const call=async(p)=>{const r=await handle(new Request('https://hotel.test/hotel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}),{id:'owner',email:'local@example.invalid'},db);return {status:r.status,data:await r.json()}};
 assert.equal((await call(payload)).status,200);
 const room=sqlite.prepare("SELECT * FROM rooms WHERE id='room'").get();assert.equal(room.number,'101A');assert.equal(room.rate,29000);assert.equal(room.state,'dirty');assert.equal(room.floor,'2');assert.equal(room.capacity,3);
 const reservation=sqlite.prepare("SELECT * FROM reservations WHERE id='booking'").get();assert.equal(reservation.rate,24000);assert.equal(reservation.total,48000);
 assert.equal((await call({...payload,capacity:1})).status,409);
 assert.equal((await call({...payload,number:'102'})).status,409);
 assert.equal((await call({...payload,id:'foreign'})).status,409);
 assert.equal((await call({...payload,hotel:'other',id:'foreign'})).status,403);
 assert.equal((await call({...payload,rate:-1})).status,400);
 assert.equal(sqlite.prepare("SELECT capacity FROM rooms WHERE id='room'").get().capacity,3);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM audit').get().n,1);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM operation_guards').get().n,0);
 }finally{sqlite.close();rmSync(dir,{recursive:true,force:true})}
});
