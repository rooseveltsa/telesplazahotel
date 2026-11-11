// Documentos para o hóspede (voucher, extrato e FNRH) gerados no navegador e impressos ou salvos em PDF.
import {account,money,nights,roomOn,type Entry,type Reservation,type Room,type RoomMove} from '@/lib/hotel-domain';

export const HOTEL={name:'Teles Plaza Hotel',cnpj:'64.819.551/0001-64',address:'BR 070, Quadra 02, Lote 24 — Nova Águas Lindas de Goiás, Águas Lindas de Goiás/GO',phone:'+55 (61) 99934-3604',email:'telesplazahotel@gmail.com'};
export type GuestRecord={full_name:string;email:string;phone:string;profession:string;nationality:string;gender:string;birth:string;race:string;disability:string;disability_type:string;doc_type:string;doc_number:string;address:string;number:string;complement:string;cep:string;city:string;state:string;country:string;last_destination:string;next_destination:string;reason:string;transport:string;companions:string;arrival_time:string;departure_time:string};
export type StayContext={reservation:Reservation;rooms:Room[];entries:Entry[];moves:RoomMove[];nightly:{day:string;rate:number}[];operator:string};

const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const date=(s:string)=>s?s.slice(0,10).split('-').reverse().join('/'):'';
const code=(r:Reservation)=>r.id.slice(-8).toUpperCase();
const roomLabel=(rooms:Room[],id:string)=>{const q=rooms.find(x=>x.id===id);return q?q.number+' · '+q.category:'—';};
// Quarto de cada noite: a troca registrada durante a estadia aparece no extrato e no voucher.
function roomTrail(c:StayContext){const ms=c.moves.filter(m=>m.reservation_id===c.reservation.id).sort((a,b)=>a.day.localeCompare(b.day));if(!ms.length)return roomLabel(c.rooms,c.reservation.room_id);return [roomLabel(c.rooms,ms[0].from_room)+' (desde '+date(c.reservation.checkin)+')',...ms.map(m=>roomLabel(c.rooms,m.to_room)+' (desde '+date(m.day)+')')].join(' → ');}
const nightsOf=(c:StayContext)=>c.nightly.length?c.nightly:Array.from({length:Math.max(0,nights(c.reservation.checkin,c.reservation.checkout))},(_,i)=>({day:new Date(Date.parse(c.reservation.checkin+'T12:00:00Z')+i*86400000).toISOString().slice(0,10),rate:c.reservation.rate}));

const STYLE=`*{box-sizing:border-box;margin:0;padding:0}body{font:13px/1.55 Arial,Helvetica,sans-serif;color:#1b2942;background:#f5f7fb}main{background:#fff;max-width:820px;margin:28px auto;padding:44px 48px;border-top:6px solid #243c84}
header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-bottom:20px;border-bottom:2px solid #d9ad4c}header img{height:74px}.brand small{display:block;color:#64748b;font-size:11px;line-height:1.6;text-align:right}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:2px;color:#8792a4;margin:26px 0 6px}h1{font:700 28px Georgia,serif;color:#243c84;letter-spacing:.3px}h2{font:700 15px Georgia,serif;color:#18345b;margin:26px 0 10px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px 20px;margin-top:18px}.grid div{border:1px solid #e4e9f1;border-radius:6px;padding:10px 12px}.grid dt{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8190a6}.grid dd{font-size:14px;font-weight:600;color:#1b2942;margin-top:3px}.wide{grid-column:span 3}.half{grid-column:span 2}
table{width:100%;border-collapse:collapse;margin-top:8px}th{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8190a6;text-align:left;border-bottom:1px solid #d5dce8;padding:8px 6px}td{padding:8px 6px;border-bottom:1px solid #eef1f6;vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap}td small{color:#64748b;display:block}
.totals{margin-left:auto;width:340px;margin-top:14px}.totals div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eef1f6}.totals .due{border:0;color:#243c84;font-size:18px;font-weight:700;padding-top:12px}
.badge{display:inline-block;padding:5px 10px;border-radius:4px;font-size:12px;font-weight:700}.paid{background:#ebf5f0;color:#2f7a5d}.partial{background:#fcf4e2;color:#946f1c}.open{background:#fbeeee;color:#a14d4d}
.note{border:1px solid #e8edf4;background:#fafbfd;border-radius:6px;padding:12px 14px;margin-top:16px;color:#4b5b76;white-space:pre-wrap}footer{margin-top:30px;padding-top:14px;border-top:1px solid #e4e9f1;font-size:11px;color:#8190a6;display:flex;justify-content:space-between;gap:12px}
.actions{max-width:820px;margin:0 auto 30px;text-align:right}.actions button{background:#243c84;color:#fff;border:0;border-radius:6px;padding:11px 18px;font-weight:700;cursor:pointer}
@page{size:A4;margin:12mm}@media print{body{background:#fff}main{margin:0;max-width:none;padding:0 4mm;border-top-width:4px}.actions{display:none}}`;

// A janela abre no clique (antes de qualquer espera), senão o navegador bloqueia o pop-up.
export function documentWindow(){const win=window.open('','_blank');if(!win)throw new Error('Permita a abertura de janelas para imprimir o documento.');win.opener=null;win.document.write('<p style="font:14px Arial;padding:40px;color:#64748b">Preparando documento…</p>');return win;}
function page(win:Window,title:string,body:string){
 win.document.open();
 const logo=location.origin+'/logo-teles.png';
 win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body><main><header><img src="${esc(logo)}" alt="${esc(HOTEL.name)}"><div class="brand"><small><b>${esc(HOTEL.name)}</b> · CNPJ ${esc(HOTEL.cnpj)}<br>${esc(HOTEL.address)}<br>${esc(HOTEL.phone)} · ${esc(HOTEL.email)}</small></div></header>${body}</main><div class="actions"><button onclick="window.print()">Imprimir / salvar em PDF</button></div></body></html>`);
 win.document.close();
}
const stamp=(operator:string)=>`<footer><span>Emitido em ${esc(new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date()))} por ${esc(operator)}</span><span>${esc(HOTEL.name)}</span></footer>`;

export function printVoucher(win:Window,c:StayContext){
 const r=c.reservation,a=account(r,c.entries),n=nights(r.checkin,r.checkout);
 const status=a.balance<=0?['paid','Pago integralmente']:a.paid>0?['partial','Pagamento parcial']:['open','Pagamento pendente'];
 page(win,'Voucher '+code(r),`<p class="eyebrow">VOUCHER DE RESERVA · ${esc(code(r))}</p><h1>${esc(r.name)}</h1><p style="margin-top:8px"><span class="badge ${status[0]}">${status[1]}</span></p>
 <dl class="grid"><div><dt>Check-in</dt><dd>${esc(date(r.checkin))}</dd></div><div><dt>Check-out</dt><dd>${esc(date(r.checkout))}</dd></div><div><dt>Diárias</dt><dd>${n}</dd></div>
 <div class="half"><dt>Acomodação</dt><dd>${esc(roomTrail(c))}</dd></div><div><dt>Hóspedes</dt><dd>${r.guests} pessoa${r.guests>1?'s':''}</dd></div>
 ${r.company?`<div class="half"><dt>Empresa</dt><dd>${esc(r.company)}</dd></div>`:''}<div${r.company?'':' class="half"'}><dt>Telefone</dt><dd>${esc(r.phone||'Não informado')}</dd></div>${r.company?'':`<div><dt>Origem</dt><dd>${esc(r.source)}</dd></div>`}</dl>
 <div class="totals"><div><span>Hospedagem (${n} diária${n>1?'s':''})</span><b>${money(r.total)}</b></div>${a.charges>r.total?`<div><span>Consumos lançados</span><b>${money(a.charges-r.total)}</b></div>`:''}<div><span>Valor pago</span><b>${money(a.paid)}</b></div><div class="due"><span>Saldo a pagar</span><span>${money(Math.max(0,a.balance))}</span></div></div>
 ${r.notes?`<div class="note"><b>Observações</b><br>${esc(r.notes)}</div>`:''}<div class="note">Apresente este voucher e um documento oficial com foto no check-in. Consumos durante a estadia são lançados à parte. Dúvidas ou alterações: ${esc(HOTEL.phone)}.</div>${stamp(c.operator)}`);
}

export function printStatement(win:Window,c:StayContext){
 const r=c.reservation,a=account(r,c.entries),list=nightsOf(c);
 const own=c.entries.filter(e=>e.reservation_id===r.id&&e.kind!=='expense'&&!e.voided_at);
 const rows=[...list.map(d=>({day:d.day,text:'Diária · quarto '+esc(c.rooms.find(q=>q.id===roomOn(r,d.day,c.moves))?.number??'—'),debit:d.rate,credit:0})),
  ...own.map(e=>({day:e.due,text:esc(e.description)+'<small>'+({charge:'Consumo',payment:'Pagamento · '+esc(e.method),refund:'Devolução · '+esc(e.method)} as Record<string,string>)[e.kind]+'</small>',debit:e.kind==='charge'?e.amount:e.kind==='refund'?e.amount:0,credit:e.kind==='payment'?e.amount:0}))]
  .sort((x,y)=>x.day.localeCompare(y.day));
 const consumos=own.filter(e=>e.kind==='charge').reduce((s,e)=>s+e.amount,0),diarias=list.reduce((s,d)=>s+d.rate,0);
 page(win,'Extrato '+code(r),`<p class="eyebrow">EXTRATO DA HOSPEDAGEM · ${esc(code(r))}</p><h1>${esc(r.name)}</h1>
 <dl class="grid"><div><dt>Período</dt><dd>${esc(date(r.checkin))} a ${esc(date(r.checkout))}</dd></div><div class="half"><dt>Acomodação</dt><dd>${esc(roomTrail(c))}</dd></div>${r.company?`<div class="wide"><dt>Empresa</dt><dd>${esc(r.company)}</dd></div>`:''}</dl>
 <h2>Movimentação</h2><table><thead><tr><th>Data</th><th>Descrição</th><th class="n">Débito</th><th class="n">Crédito</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(date(x.day))}</td><td>${x.text}</td><td class="n">${x.debit?money(x.debit):''}</td><td class="n">${x.credit?money(x.credit):''}</td></tr>`).join('')}</tbody></table>
 <div class="totals"><div><span>Diárias (${list.length})</span><b>${money(diarias)}</b></div><div><span>Consumos</span><b>${money(consumos)}</b></div><div><span>Total geral</span><b>${money(a.charges)}</b></div><div><span>Pagamentos líquidos</span><b>${money(a.paid)}</b></div><div class="due"><span>${a.balance<0?'Crédito do hóspede':'Saldo a pagar'}</span><span>${money(Math.abs(a.balance))}</span></div></div>${stamp(c.operator)}`);
}

const box=(label:string,value:string,span='')=>`<div${span?` class="${span}"`:''}><dt>${esc(label)}</dt><dd>${esc(value)||'&nbsp;'}</dd></div>`;
const options=(list:string[],value:string)=>list.map(o=>`<span style="margin-right:14px;white-space:nowrap">${o===value?'☒':'☐'} ${esc(o)}</span>`).join('');
export function printGuestRecord(win:Window,c:StayContext,g:GuestRecord){
 const r=c.reservation;
 page(win,'FNRH '+(g.full_name||r.name),`<p class="eyebrow">FICHA NACIONAL DE REGISTRO DE HÓSPEDES</p><h1>${esc(g.full_name||r.name)}</h1>
 <h2>Informações da hospedagem</h2><dl class="grid">${box('UH nº (local)',c.rooms.find(q=>q.id===r.room_id)?.number??'')}${box('Nº de acompanhantes',g.companions)}${box('Reserva',code(r))}${box('Data e hora de entrada',date(r.checkin)+(g.arrival_time?' · '+g.arrival_time:''))}${box('Data e hora de saída',date(r.checkout)+(g.departure_time?' · '+g.departure_time:''))}${box('Telefone',g.phone||r.phone)}</dl>
 <h2>Informações do hóspede</h2><dl class="grid">${box('E-mail',g.email,'half')}${box('Profissão',g.profession)}${box('Nacionalidade',g.nationality)}${box('Gênero',g.gender)}${box('Nascimento',date(g.birth))}${box('Raça/cor',g.race)}${box('Deficiência',({sim:'Sim',nao:'Não',nao_informar:'Não informar'} as Record<string,string>)[g.disability]??'')}${box('Tipo de deficiência',g.disability_type)}${box('Documento',g.doc_type)}${box('Número do documento',g.doc_number,'half')}${box('Endereço',g.address,'half')}${box('Número',g.number)}${box('Complemento',g.complement,'half')}${box('CEP',g.cep)}${box('Cidade',g.city)}${box('Estado',g.state)}${box('País',g.country)}${box('Último destino (cidade, país)',g.last_destination,'half')}${box('Próximo destino (cidade, país)',g.next_destination)}</dl>
 <h2>Motivo da viagem</h2><p>${options(['Compras','Evento','Estudo','Lazer','Negócios','Religião','Saúde','Parentes/Amigos'],g.reason)}</p>
 <h2>Meio de transporte</h2><p>${options(['Ônibus','Automóvel','Avião','Moto','A pé','Trem','Bicicleta','Navio/Barco'],g.transport)}</p>
 <div style="margin:64px 0 0 auto;width:320px;border-top:1px solid #1b2942;text-align:center;padding-top:6px;color:#4b5b76">Assinatura do hóspede</div>${stamp(c.operator)}`);
}
