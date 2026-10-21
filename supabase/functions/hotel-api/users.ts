import {z} from 'npm:zod@3.25.76';
import {sql} from './db.ts';
import {text,audit} from './reception-domain.ts';
export async function usersRoute(req:Request,user:any,auth:any){
 if(user.role!=='admin')return Response.json({error:'Somente administradores gerenciam acessos.'},{status:403});
 if(req.method==='GET'){const users=await sql`select o.user_id,o.name,o.role,o.active,u.email from operators o join auth.users u on u.id=o.user_id where o.owner_id=${user.id} order by o.created`;return Response.json({users});}
 const b=await req.json(),action=z.enum(['create','active','password']).parse(b.action),hid=text(b.hotel);
 if(!(await sql`select id from hotels where id=${hid} and owner=${user.id}`).length)return Response.json({error:'Unidade sem acesso.'},{status:403});
 let created:string|null=null;
 try{return await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(hashtextextended(${user.id+':users'},0))`;
  // Recheck database role after waiting for the lock; JWT metadata is never authoritative.
  const [operator]=await tx`select role,active from operators where user_id=${user.uid} and owner_id=${user.id}`;if(operator?.role!=='admin'||operator.active!==1)throw new Error('Acesso administrativo revogado.');
  let target:string;
  if(action==='create'){const name=text(b.name,120),email=z.string().trim().email().max(200).parse(b.email).toLowerCase(),password=z.string().min(12).max(128).parse(b.password),role=z.enum(['admin','reception']).parse(b.role);const result=await auth.auth.admin.createUser({email,password,email_confirm:true});if(result.error||!result.data?.user)throw new Error('Não foi possível criar o acesso. Confira se o e-mail já está cadastrado.');target=result.data.user.id;created=target;await tx`insert into operators(user_id,owner_id,name,role,active) values(${target},${user.id},${name},${role},1)`;
  }else{target=z.string().uuid().parse(b.id);const [op]=await tx`select * from operators where user_id=${target} and owner_id=${user.id} for update`;if(!op)throw new Error('Usuário não pertence à sua operação.');
   if(action==='active'){const active=z.coerce.number().int().min(0).max(1).parse(b.active);if(!active&&(target===user.uid||target===user.id))throw new Error('Não é possível desativar seu próprio acesso ou o proprietário.');if(!active&&op.role==='admin'){const admins=await tx`select user_id from operators where owner_id=${user.id} and role='admin' and active=1`;if(admins.length<=1)throw new Error('Mantenha pelo menos um administrador ativo.');}await tx`update operators set active=${active} where user_id=${target} and owner_id=${user.id}`;
   }else{const password=z.string().min(12).max(128).parse(b.password);const result=await auth.auth.admin.updateUserById(target,{password});if(result.error)throw new Error('Não foi possível redefinir a senha.');}
  }
  await audit(tx,hid,user.email??user.uid,action==='create'?'Usuário criado':action==='active'?'Acesso '+(Number(b.active)?'reativado':'desativado'):'Senha redefinida',target);return Response.json({message:'Acesso atualizado.'});
 });}catch(e){if(created)await auth.auth.admin.deleteUser(created);throw e;}
}
