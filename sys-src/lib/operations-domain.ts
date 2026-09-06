import {z} from 'zod';
import {cents,validDay} from './hotel-domain';
export const quantity=(v:unknown)=>{const n=Number(String(v).replace(',','.'));if(!Number.isFinite(n)||n<=0||n>1000000)throw new Error('Informe uma quantidade entre 0,001 e 1 milhão.');const q=Math.round(n*1000);if(q<1)throw new Error('A quantidade mínima é 0,001.');return q;};
export const qty=(n:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(n/1000);
export function proposalLines(input:unknown){return z.array(z.object({description:z.string().trim().min(1).max(200),unit:z.enum(['quarto/diária','pessoa/dia','veículo/diária','serviço']),quantity:z.coerce.number().int().min(1).max(10000),days:z.coerce.number().int().min(1).max(365),rate:z.union([z.string(),z.number()])})).min(1).max(30).parse(input).map(item=>({...item,rate:cents(item.rate),total:item.quantity*item.days*cents(item.rate)}));}
export const date=(v:unknown)=>{const s=z.string().parse(v);if(!validDay(s))throw new Error('Data inválida.');return s;};
export type Product={id:string;name:string;unit:string;category:string;quantity:number;minimum:number};
export type Supplier={id:string;name:string;document:string;contact:string;notes:string};
export type Order={id:string;supplier_id:string;items:{product:string;name:string;unit:string;quantity:number;rate:number;total:number}[];total:number;status:string;due:string;notes:string;created:string};
export type Proposal={id:string;client:string;contact:string;items:{description:string;unit:string;quantity:number;days:number;rate:number;total:number}[];total:number;status:string;valid_until:string;terms:string;created:string};
export type CashShift={id:string;actor:string;opening:number;opened:string;closed:string|null;expected:number|null;counted:number|null;notes:string;live_expected:number};
export type OperationsData={products:Product[];suppliers:Supplier[];orders:Order[];proposals:Proposal[];movements:{id:string;product_id:string;quantity:number;reason:string;created:string;actor:string}[];shifts:CashShift[]};
