import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {Printer} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {apiFetch} from '@/lib/client';
import type {Reservation} from '@/lib/hotel-domain';
import {documentWindow,type GuestRecord} from './print-documents';

const EMPTY:GuestRecord={full_name:'',email:'',phone:'',profession:'',nationality:'Brasileira',gender:'',birth:'',race:'',disability:'',disability_type:'',doc_type:'CPF',doc_number:'',address:'',number:'',complement:'',cep:'',city:'',state:'',country:'Brasil',last_destination:'',next_destination:'',reason:'',transport:'',companions:'',arrival_time:'',departure_time:''};
const REASONS=['Compras','Evento','Estudo','Lazer','Negócios','Religião','Saúde','Parentes/Amigos'];
const TRANSPORTS=['Ônibus','Automóvel','Avião','Moto','A pé','Trem','Bicicleta','Navio/Barco'];
function Field({label,children,wide}:{label:string;children:ReactNode;wide?:boolean}){return <label className={'field'+(wide?' full-span':'')}><span>{label}</span>{children}</label>}
function Pick({name,value,options,onChange}:{name:keyof GuestRecord;value:string;options:[string,string][];onChange:(k:keyof GuestRecord,v:string)=>void}){return <select className="native-choice" value={value} onChange={e=>onChange(name,e.target.value)}><option value="">Selecionar</option>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>}

// Ficha Nacional de Registro de Hóspedes: mesmos campos da ficha em papel, salva junto da reserva.
export default function GuestRecordDialog({hotel,reservation,onClose,onPrint}:{hotel:string;reservation:Reservation|null;onClose:()=>void;onPrint:(win:Window,g:GuestRecord)=>void}){
 const [record,setRecord]=useState<GuestRecord|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!reservation){setRecord(null);return;}let live=true;setError('');
  apiFetch('/api/hotel?hotel='+encodeURIComponent(hotel)+'&reservation='+encodeURIComponent(reservation.id)).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(live)setRecord({...EMPTY,full_name:reservation.name,phone:reservation.phone,...(d.guest?.data??{})});}).catch(e=>{if(live)setError((e as Error).message)});
  return()=>{live=false};},[hotel,reservation]);
 const set=(k:keyof GuestRecord,v:string)=>setRecord(old=>old&&{...old,[k]:v});
 const input=(k:keyof GuestRecord,max:number,type='text')=><input type={type} maxLength={max} value={record?.[k]??''} onChange={e=>set(k,e.target.value)}/>;
 const save=async(e:FormEvent,print:boolean)=>{e.preventDefault();if(!record||!reservation)return;setBusy(true);setError('');let win:Window|null=null;try{if(print)win=documentWindow();const r=await apiFetch('/api/hotel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'guest_record',hotel,id:reservation.id,record})});const d=await r.json();if(!r.ok)throw new Error(d.error);toast.success(d.message);if(win)onPrint(win,record);onClose();}catch(err){win?.close();setError((err as Error).message);}finally{setBusy(false)}};
 return <Dialog open={!!reservation} onOpenChange={v=>{if(!v&&!busy)onClose()}}><DialogContent className="form-modal wide-modal"><DialogHeader><DialogTitle>Ficha de registro do hóspede</DialogTitle><DialogDescription>Ficha Nacional de Registro de Hóspedes (FNRH). Os dados ficam salvos na reserva e podem ser impressos para assinatura.</DialogDescription></DialogHeader>
 {error&&<div className="form-error" role="alert">{error}</div>}
 {!record?<p className="muted">{error?'':'Carregando ficha…'}</p>:<form onSubmit={e=>save(e,false)}><div className="form-grid">
  <Field label="Nome completo" wide>{input('full_name',120)}</Field>
  <Field label="E-mail">{input('email',200,'email')}</Field><Field label="Telefone">{input('phone',30,'tel')}</Field>
  <Field label="Profissão">{input('profession',80)}</Field><Field label="Nacionalidade">{input('nationality',60)}</Field>
  <Field label="Gênero">{input('gender',30)}</Field><Field label="Nascimento">{input('birth',10,'date')}</Field>
  <Field label="Raça/cor">{input('race',30)}</Field><Field label="Deficiência"><Pick name="disability" value={record.disability} onChange={set} options={[['sim','Sim'],['nao','Não'],['nao_informar','Não informar']]}/></Field>
  {record.disability==='sim'&&<Field label="Tipo de deficiência" wide>{input('disability_type',120)}</Field>}
  <Field label="Tipo de documento"><Pick name="doc_type" value={record.doc_type} onChange={set} options={['CPF','Passaporte','RG','CNH'].map(v=>[v,v])}/></Field><Field label="Número do documento">{input('doc_number',40)}</Field>
  <Field label="Endereço">{input('address',160)}</Field><Field label="Número">{input('number',20)}</Field>
  <Field label="Complemento">{input('complement',80)}</Field><Field label="CEP">{input('cep',12)}</Field>
  <Field label="Cidade">{input('city',80)}</Field><Field label="Estado">{input('state',40)}</Field>
  <Field label="País">{input('country',60)}</Field><Field label="Nº de acompanhantes">{input('companions',4)}</Field>
  <Field label="Último destino (cidade, país)">{input('last_destination',120)}</Field><Field label="Próximo destino (cidade, país)">{input('next_destination',120)}</Field>
  <Field label="Motivo da viagem"><Pick name="reason" value={record.reason} onChange={set} options={REASONS.map(v=>[v,v])}/></Field><Field label="Meio de transporte"><Pick name="transport" value={record.transport} onChange={set} options={TRANSPORTS.map(v=>[v,v])}/></Field>
  <Field label="Hora de entrada">{input('arrival_time',5,'time')}</Field><Field label="Hora de saída">{input('departure_time',5,'time')}</Field>
 </div><p className="form-hint">Dados pessoais protegidos pela LGPD: preencha apenas o necessário para o registro do hóspede.</p>
 <div className="form-actions"><button type="button" className="secondary" disabled={busy} onClick={e=>void save(e,true)}><Printer size={16}/>Salvar e imprimir</button><button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar ficha'}</button></div></form>}
 </DialogContent></Dialog>;
}
