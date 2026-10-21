import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {apiFetch} from '@/lib/client';
import type {HotelData} from '@/lib/hotel-domain';
import {addDays,money} from '@/lib/hotel-domain';
import {toast} from 'sonner';

type Rate={category:string;day:string;rate:number;extra_guest_rate:number;min_stay:number;closed:number;stored:number};
const WEEK=[['0','D'],['1','S'],['2','T'],['3','Q'],['4','Q'],['5','S'],['6','S']] as const;
const short=(cents:number)=>String(Math.round(cents/100));
const monthEnd=(month:string)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);};

export default function RateCalendar({data}:{data:HotelData}){
 const hid=data.hotel!.id;
 const categories=useMemo(()=>[...new Set(data.rooms.map(r=>r.category))].sort(),[data.rooms]);
 const [month,setMonth]=useState(data.today.slice(0,7));
 const [rates,setRates]=useState<Rate[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[picked,setPicked]=useState<string[]>([]);
 const [weekdays,setWeekdays]=useState<string[]>(['0','1','2','3','4','5','6']);
 const [value,setValue]=useState(''),[extra,setExtra]=useState('0'),[minStay,setMinStay]=useState('1'),[closed,setClosed]=useState(false);

 const start=month+'-01',end=monthEnd(month);
 const refresh=useCallback(async()=>{try{
  const r=await apiFetch('/rates?hotel='+encodeURIComponent(hid)+'&from='+start+'&to='+end);
  const d=await r.json();if(!r.ok)throw new Error(d.error);
  setRates(d.rates);setError('');
 }catch(e){setError((e as Error).message)}},[hid,start,end]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{if(!from)setFrom(start);if(!to)setTo(end);if(!picked.length)setPicked(categories)},[start,end,categories,from,to,picked.length]);

 const days=useMemo(()=>{const out:string[]=[];for(let d=start;d<=end;d=addDays(d,1))out.push(d);return out},[start,end]);
 const grid=useMemo(()=>{const m=new Map<string,Rate>();for(const r of rates)m.set(r.category+'|'+r.day,r);return m},[rates]);
 const published=rates.filter(r=>r.stored).length;
 const prices=rates.filter(r=>!r.closed).map(r=>r.rate);

 const apply=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{
  const r=await apiFetch('/rates',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({hotel:hid,from,to,categories:picked,weekdays:weekdays.map(Number),
    rate:value,extra_guest_rate:extra||0,min_stay:minStay,closed:closed?1:0})});
  const d=await r.json();if(!r.ok)throw new Error(d.error);
  toast.success(d.message);await refresh();
 }catch(e){toast.error((e as Error).message)}finally{setBusy(false)}};

 const toggle=(list:string[],set:(v:string[])=>void,v:string)=>set(list.includes(v)?list.filter(x=>x!==v):[...list,v]);

 return <>
 <section className="panel">
  <div className="panel-heading">
   <div><h2>Aplicar tarifa</h2><p>Escolha o período, as acomodações e os dias da semana. O valor vale para cada diária.</p></div>
  </div>
  <form className="rate-form" onSubmit={apply}>
   <label className="field"><span>De</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)} required/></label>
   <label className="field"><span>Até</span><input type="date" value={to} onChange={e=>setTo(e.target.value)} required/></label>
   <label className="field"><span>Diária (R$)</span><input type="number" min="1" step="0.01" value={value} onChange={e=>setValue(e.target.value)} placeholder="290,00" required/></label>
   <label className="field"><span>Hóspede extra (R$)</span><input type="number" min="0" step="0.01" value={extra} onChange={e=>setExtra(e.target.value)}/></label>
   <label className="field"><span>Mínimo de noites</span><input type="number" min="1" max="30" value={minStay} onChange={e=>setMinStay(e.target.value)}/></label>
   <div className="field">
    <span>Dias da semana</span>
    <div className="chip-row">{WEEK.map(([v,l],i)=><button type="button" key={v} className={'chip'+(weekdays.includes(v)?' on':'')} aria-pressed={weekdays.includes(v)} onClick={()=>toggle(weekdays,setWeekdays,v)}>{l}<i>{i}</i></button>)}</div>
   </div>
   <div className="field full">
    <span>Acomodações</span>
    <div className="chip-row">{categories.map(c=><button type="button" key={c} className={'chip wide'+(picked.includes(c)?' on':'')} aria-pressed={picked.includes(c)} onClick={()=>toggle(picked,setPicked,c)}>{c}</button>)}</div>
   </div>
   <label className="rate-close"><input type="checkbox" checked={closed} onChange={e=>setClosed(e.target.checked)}/><span>Fechar para venda neste período <small>As datas somem do site e dos canais, mesmo com quarto livre.</small></span></label>
   <button className="primary" type="submit" disabled={busy||!picked.length||!weekdays.length}>{busy?'Aplicando…':'Aplicar tarifa'}</button>
  </form>
 </section>

 <section className="panel">
  <div className="panel-heading">
   <div><h2>Calendário</h2><p>{published} de {rates.length} diárias publicadas{prices.length?' · de '+money(Math.min(...prices))+' a '+money(Math.max(...prices)):''}</p></div>
   <label className="month-pick">Mês <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
  </div>
  {error&&<p role="alert" className="panel-padding">{error}</p>}
  <div className="rate-scroll">
   <table className="rate-grid">
    <thead><tr><th className="rate-cat">Acomodação</th>{days.map(d=>{const w=new Date(d+'T12:00:00Z').getUTCDay();return <th key={d} className={w===0||w===6?'weekend':''}>{d.slice(8)}<small>{WEEK[w][1]}</small></th>})}</tr></thead>
    <tbody>{categories.map(c=><tr key={c}>
     <td className="rate-cat">{c}</td>
     {days.map(d=>{const r=grid.get(c+'|'+d);
      return <td key={d} className={'rate-cell'+(r?.closed?' closed':'')+(r&&!r.stored?' fallback':'')} title={r?(r.closed?'Fechado para venda':money(r.rate)+(r.min_stay>1?' · mínimo '+r.min_stay+' noites':'')+(r.stored?'':' · valor do cadastro do quarto')):''}>
       {r?(r.closed?'—':short(r.rate)):''}{r&&r.min_stay>1&&!r.closed?<i>{r.min_stay}</i>:null}</td>})}
    </tr>)}</tbody>
   </table>
  </div>
  <p className="panel-padding muted">Valores em reais, sem centavos. Célula esmaecida usa o preço do cadastro do quarto, porque ainda não há tarifa publicada para o dia. O número pequeno indica mínimo de noites.</p>
 </section>
 </>;
}
