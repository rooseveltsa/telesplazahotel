import postgres from 'npm:postgres@3.4.7';
// Only the Edge runtime receives this credential. Browser input never contains SQL.
export const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:3,idle_timeout:20,connect_timeout:10,connection:{search_path:'teles,public'}});
export class Statement{
 values:any[]=[];
 constructor(public query:string){}
 bind(...values:any[]){this.values=values;return this;}
 async first(){return (await execute(sql,this))[0]??null;}
 async all(){return {results:await execute(sql,this)};}
}
async function execute(connection:any,s:Statement){let i=0;const query=s.query.replace(/\?/g,()=>'$'+(++i));try{return await connection.unsafe(query,s.values);}catch(e){const err=e as {code?:string;constraint_name?:string;message:string};if(err.code==='23514')throw new Error(err.constraint_name??'ESTADO');if(err.code==='23505')throw new Error('UNIQUE constraint');console.error('postgres',err.code);throw new Error('PG_STORAGE');}}
export function database(lock:string){return {prepare:(query:string)=>new Statement(query),batch:async<T=Record<string,unknown>>(statements:Statement[])=>sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(hashtextextended(${lock},0))`;const results:{results:T[]}[]=[];for(const statement of statements)results.push({results:await execute(tx,statement) as T[]});return results;})};}
