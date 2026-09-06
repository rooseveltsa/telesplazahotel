import {createClient} from '@supabase/supabase-js';
export const supabase=createClient('https://kukhsxcaqcywsvbkwhrm.supabase.co','sb_publishable_BoKnQ3jv5x-tB1mI16QHVw_vq7RiIkT');
const base='https://kukhsxcaqcywsvbkwhrm.supabase.co/functions/v1/hotel-api';
export async function apiFetch(path:string,options:RequestInit={}){const {data}=await supabase.auth.getSession();const headers=new Headers(options.headers);headers.set('apikey','sb_publishable_BoKnQ3jv5x-tB1mI16QHVw_vq7RiIkT');if(data.session)headers.set('Authorization','Bearer '+data.session.access_token);return fetch(base+path.replace(/^\/api/,''),{...options,headers});}
