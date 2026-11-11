import {useState} from 'react';

type Bloco={titulo:string;itens:{o:string;q:string}[];nota?:string};
type Secao={id:string;nome:string;resumo:string;blocos:Bloco[]};

const MANUAL:Secao[]=[
 {id:'dia',nome:'A rotina do dia',resumo:'O caminho normal de uma diária, da chegada à saída.',
  blocos:[
   {titulo:'Pela manhã',itens:[
    {o:'Visão geral',q:'Mostra ocupação, chegadas e saídas do dia e quanto entrou no caixa. É a tela para abrir primeiro.'},
    {o:'Movimentação do dia',q:'As abas Chegadas, Saídas e Hospedados listam quem a recepção precisa atender hoje. Clique na linha para abrir a reserva.'},
    {o:'Abrir o caixa',q:'Em Caixa, informe o valor de abertura. Sem caixa aberto o sistema recusa qualquer recebimento em dinheiro.'}]},
   {titulo:'Quando o hóspede chega',itens:[
    {o:'Check-in',q:'Abra a reserva e use Realizar check-in. Funciona a partir do dia da entrada, com o quarto limpo. Se o check-in não foi lançado no dia, ele ainda pode ser feito enquanto a estadia não terminou.'},
    {o:'Quarto sujo',q:'Se o quarto ainda não foi liberado pela governança, o check-in é recusado. Atualize o quarto em Governança primeiro.'}]},
   {titulo:'Quando o hóspede sai',itens:[
    {o:'Check-out',q:'Só é liberado com a conta zerada. Registre os consumos e o recebimento antes.'},
    {o:'Depois da saída',q:'O quarto vai automaticamente para "aguardando limpeza". A governança devolve ele para "limpo e liberado".'}]}]},

 {id:'reservas',nome:'Reservas',resumo:'Criar, acompanhar e encerrar hospedagens.',
  blocos:[
   {titulo:'Criar pelo balcão',itens:[
    {o:'Nova reserva',q:'Disponível na Visão geral, em Reservas, no Mapa e em Hóspedes. Informe hóspede, quarto, período e a diária negociada.'},
    {o:'Diária no balcão',q:'Aqui você digita o valor. Reserva de balcão aceita preço negociado e não é obrigada a seguir o tarifário.'},
    {o:'Origem',q:'Recepção, WhatsApp, Site, Empresa ou Agência. Serve para saber de onde vêm suas vendas.'}]},
   {titulo:'Situações',itens:[
    {o:'Confirmada',q:'Reserva ativa, quarto bloqueado no período, hóspede ainda não chegou.'},
    {o:'Hospedado',q:'Check-in feito.'},
    {o:'Finalizada',q:'Check-out concluído e conta encerrada.'},
    {o:'Cancelada',q:'Reserva desfeita e quarto liberado.'}]},
   {titulo:'Cancelar',itens:[
    {o:'Com valor recebido',q:'Ao cancelar, escolha: devolver ao hóspede (a devolução é lançada junto, com a forma usada) ou reter como multa de cancelamento/no-show.'}],
    nota:'O dinheiro nunca some do controle: a devolução fica registrada no financeiro, e a retenção fica no histórico da reserva.'},
   {titulo:'Corrigir e regularizar',itens:[
    {o:'Editar',q:'Na reserva, use Editar para trocar o nome do hóspede (quando a empresa manda outra pessoa), telefone, empresa, observações, período, número de hóspedes e diária. Reserva finalizada ou cancelada aceita só correção cadastral.'},
    {o:'Trocar quarto',q:'Hóspede no hotel: informe o novo quarto e o dia da mudança. O mapa mostra o quarto anterior até a troca e o novo a partir dela; o extrato mostra o quarto de cada noite.'},
    {o:'Estadia passada',q:'Reservas de até 180 dias atrás podem ser lançadas. Quando a saída já passou e o check-in não foi feito, lance consumos e pagamentos e use Regularizar estadia.'},
    {o:'Grupo sem nomes',q:'Em Nova reserva, marque Reservar vários quartos de uma vez. Os quartos ficam bloqueados no nome do responsável; depois edite cada reserva com o hóspede real.'},
    {o:'Consumo errado',q:'Enquanto a conta estiver aberta, use Editar ao lado do consumo (ou em Editar reserva) para corrigir item, quantidade, valor ou data, e Excluir para tirá-lo do saldo. Toda alteração fica no histórico.'}]},
   {titulo:'Documentos',itens:[
    {o:'Voucher',q:'Comprovante para o hóspede com check-in, check-out, quarto, valor total, valor pago e saldo. Imprima ou salve em PDF para enviar pelo WhatsApp.'},
    {o:'Extrato',q:'Todas as diárias e consumos com data, pagamentos e saldo — o documento que as empresas pedem para conferir.'},
    {o:'Ficha FNRH',q:'Preencha a ficha do hóspede no sistema e imprima para assinatura.'}]}]},

 {id:'site',nome:'Reservas do site e pagamento on-line',resumo:'O que acontece sozinho quando alguém reserva pelo site.',
  blocos:[
   {titulo:'O fluxo automático',itens:[
    {o:'1. Hóspede escolhe',q:'Data, acomodação e número de pessoas. O site mostra o total da estadia, que é pago na hora.'},
    {o:'2. Quarto reservado',q:'Um quarto específico fica bloqueado durante o pagamento: 15 minutos no cartão, 30 no Pix. Ele some da disponibilidade nesse tempo.'},
    {o:'3. Pagamento',q:'Cartão ou Pix, dentro do próprio site. O hóspede não é levado para fora.'},
    {o:'4. Reserva criada',q:'Pagamento aprovado vira reserva confirmada na hora, com o pagamento já lançado no financeiro. Ninguém precisa digitar nada.'}]},
   {titulo:'Quando não dá certo',itens:[
    {o:'Pagamento recusado',q:'O quarto é liberado na hora e a solicitação fica como "Pagamento não aprovado".'},
    {o:'Hóspede desistiu',q:'Se o prazo vence sem pagamento, o quarto volta a ser vendido e a solicitação some da fila de pendências sozinha.'},
    {o:'Pagamento a conferir',q:'Situação rara e importante: o pagamento foi aprovado mas o quarto não estava mais disponível. Aparece em vermelho e exige ação humana — acomodar em outro quarto ou devolver o valor. O sistema primeiro tenta outro quarto livre da mesma categoria; se não houver, o pedido aparece no alerta amarelo da Visão geral, de Reservas e na linha Site do mapa até ser acomodado.'}]},
   {titulo:'O que continua manual',itens:[
    {o:'Grupos',q:'Cinco hóspedes ou mais não pagam on-line. Chega como solicitação para a recepção montar os quartos e responder.'},
    {o:'Aviso ao hóspede',q:'O sistema não envia mensagem de confirmação. O comprovante do Mercado Pago vai para o hóspede; o contato do hotel é com a recepção.'}]}]},

 {id:'tarifas',nome:'Tarifas',resumo:'O preço de cada diária, por acomodação e por data.',
  blocos:[
   {titulo:'Onde o preço vive',itens:[
    {o:'Calendário de tarifas',q:'É aqui que se define o preço de venda. Vale para o site e, no futuro, para os canais.'},
    {o:'Diária do cadastro do quarto',q:'Virou rede de segurança. Só é usada em datas sem tarifa publicada — e não altera o preço de datas que já têm tarifa.'}],
    nota:'Se você mudar a diária no cadastro do quarto esperando mudar o preço do site, não vai funcionar nas datas com tarifa publicada. O calendário ganha.'},
   {titulo:'Aplicar preço',itens:[
    {o:'Ordem',q:'Do geral para o específico: primeiro a base do ano, depois fins de semana, depois feriados. Cada aplicação sobrescreve a anterior no mesmo recorte.'},
    {o:'Dias da semana',q:'Permite reajustar só sexta e sábado sem tocar no resto.'},
    {o:'Mínimo de noites',q:'Em feriado prolongado, evita vender a sexta sozinha e perder o fim de semana.'},
    {o:'Fechar para venda',q:'Tira a data do site mesmo com quarto livre. Use em manutenção ou bloqueio comercial.'}]},
   {titulo:'Leitura do calendário',itens:[
    {o:'Célula esmaecida',q:'Ainda não tem tarifa publicada: o preço está vindo do cadastro do quarto.'},
    {o:'Célula vermelha',q:'Venda fechada naquele dia.'},
    {o:'Número pequeno',q:'Mínimo de noites exigido.'}]},
   {titulo:'Efeitos que acontecem sozinhos',itens:[
    {o:'Pagamento on-line',q:'O site cobra a estadia inteira. Subir a tarifa de um feriado sobe o valor cobrado.'},
    {o:'Estadia que cruza temporada',q:'O total é a soma de cada noite pelo seu próprio preço, não uma média.'},
    {o:'Quem já reservou',q:'Não é afetado. As diárias ficam congeladas na reserva no momento em que ela é criada.'}]}]},

 {id:'quartos',nome:'Mapa e governança',resumo:'Disponibilidade e preparo dos quartos.',
  blocos:[
   {titulo:'Mapa de quartos',itens:[
    {o:'Calendário semanal',q:'Mostra quarto a quarto quem está onde. Navegue por semana.'},
    {o:'Disponível para reserva',q:'Considera limpeza, manutenção e reservas ativas — e também os quartos em pagamento no site.'}]},
   {titulo:'Situação do quarto',itens:[
    {o:'Limpo e liberado',q:'Pronto para receber. Condição obrigatória para check-in.'},
    {o:'Aguardando limpeza',q:'Estado automático após o check-out.'},
    {o:'Em limpeza',q:'Camareira trabalhando no quarto.'},
    {o:'Manutenção',q:'Fora de venda. Só pode ser marcado se o quarto não tiver reserva ativa.'}]}]},

 {id:'financeiro',nome:'Financeiro e caixa',resumo:'Recebimentos, consumos, despesas e fechamento.',
  blocos:[
   {titulo:'Na conta do hóspede',itens:[
    {o:'Consumo',q:'Acrescenta valor à conta: frigobar, refeição, lavanderia.'},
    {o:'Receber',q:'Registra pagamento. Nunca aceita valor acima do saldo devedor.'},
    {o:'Devolução',q:'Estorna valor já recebido. Necessária antes de cancelar reserva paga.'}]},
   {titulo:'Conciliação de cartões',itens:[
    {o:'No lançamento',q:'Ao receber no cartão, informe bandeira e NSU/autorização do comprovante da maquininha.'},
    {o:'Na conferência',q:'Em Conciliação de cartões, compare o resumo por dia com o fechamento da maquininha e marque cada venda como conciliada.'}]},
   {titulo:'Caixa',itens:[
    {o:'Abertura',q:'Informe o valor inicial. Pagamentos em dinheiro exigem caixa aberto.'},
    {o:'Fechamento',q:'Informe o valor contado. O sistema compara com o esperado e registra a diferença.'},
    {o:'Só um por vez',q:'Não é possível abrir dois caixas simultâneos na mesma unidade.'}]},
   {titulo:'Despesas',itens:[
    {o:'Lançar despesa',q:'Com vencimento, pode ficar pendente.'},
    {o:'Contas a pagar',q:'As despesas não pagas do período aparecem no resumo do Financeiro.'}]}]},

 {id:'operacao',nome:'Estoque, compras e propostas',resumo:'Suprimentos e orçamentos para grupos.',
  blocos:[
   {titulo:'Estoque',itens:[
    {o:'Produtos',q:'Cadastro com unidade, categoria e estoque mínimo.'},
    {o:'Movimentos',q:'Entradas e saídas. O sistema recusa saída maior que o saldo disponível.'}]},
   {titulo:'Compras',itens:[
    {o:'Pedido',q:'Fornecedor, itens, quantidades e vencimento.'},
    {o:'Recebimento',q:'Ao receber, o estoque entra automaticamente e a despesa é gerada. Um pedido só pode ser recebido uma vez.'}]},
   {titulo:'Propostas',itens:[
    {o:'Orçamento para grupo',q:'Monte itens de hospedagem, refeição e transporte com validade. Serve para responder empresas e excursões.'}]}]},

 {id:'sistema',nome:'Configurações e regras do sistema',resumo:'Estrutura, acesso e limites que valem para tudo.',
  blocos:[
   {titulo:'Estrutura',itens:[
    {o:'Cadastrar quarto',q:'Número, categoria, capacidade, andar, diária de referência e valor por hóspede extra.'},
    {o:'Excluir quarto',q:'Não existe. Um quarto que saiu de operação deve ser marcado como manutenção.'},
    {o:'Várias unidades',q:'O seletor no topo alterna entre hotéis cadastrados. Cada um tem estrutura e financeiro próprios.'}]},
   {titulo:'Regras que surpreendem',itens:[
    {o:'Data mínima de reserva',q:'Pelo site, só a partir de hoje. No painel, entradas de até 180 dias atrás são aceitas para regularizar estadias não lançadas.'},
    {o:'Capacidade',q:'A reserva exige quarto com capacidade igual ou maior que o número de hóspedes.'},
    {o:'Dois cliques não duplicam',q:'Reenviar a mesma solicitação ou o mesmo pagamento não gera cobrança nem reserva em duplicidade.'},
    {o:'Histórico',q:'Toda ação relevante fica registrada com autor e horário em Configurações.'}]},
   {titulo:'Usuários',itens:[
    {o:'Um login por plantonista',q:'Em Configurações › Usuários e acessos, o administrador cria o acesso de cada funcionário com e-mail e senha. O histórico mostra quem fez cada lançamento.'},
    {o:'Desativar',q:'Corta o acesso na hora e preserva o histórico. Senhas esquecidas são redefinidas pelo administrador.'}]},
   {titulo:'Dados',itens:[
    {o:'Exportar reservas',q:'Em Reservas, o botão Exportar gera planilha do que está filtrado na tela.'},
    {o:'Exportar tudo',q:'Em Configurações, gera um arquivo com a estrutura e os dados da unidade.'}]}]},
];

export default function Manual(){
 const [aberta,setAberta]=useState<string>(MANUAL[0].id);
 return <div className="manual">
  <nav className="manual-index" aria-label="Seções do manual">
   {MANUAL.map(s=><button key={s.id} className={'manual-link'+(aberta===s.id?' on':'')} onClick={()=>setAberta(s.id)}>
    <strong>{s.nome}</strong><span>{s.resumo}</span></button>)}
  </nav>
  <div className="manual-body">
   {MANUAL.filter(s=>s.id===aberta).map(s=><section key={s.id}>
    <header className="manual-head"><h2>{s.nome}</h2><p>{s.resumo}</p></header>
    {s.blocos.map(b=><div className="manual-bloco" key={b.titulo}>
     <h3>{b.titulo}</h3>
     <dl>{b.itens.map(i=><div key={i.o}><dt>{i.o}</dt><dd>{i.q}</dd></div>)}</dl>
     {b.nota&&<p className="manual-nota">{b.nota}</p>}
    </div>)}
   </section>)}
  </div>
 </div>;
}
