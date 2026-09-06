# Teles Plaza Hotel — site e administração

O site público e o painel `/sys` estão no mesmo projeto Vercel. O painel usa Supabase Auth com e-mail e senha; não depende do ChatGPT. O backend `hotel-api` é uma Edge Function do Supabase com autenticação verificada e consultas PostgreSQL parametrizadas.

## Primeiro acesso

Abrir `/sys`, selecionar “Primeiro acesso — ativar administrador” e informar o código exclusivo entregue ao proprietário, e-mail e senha de ao menos 12 caracteres. O código não faz parte do repositório: apenas seu hash fica no banco, com validade de sete dias e uso único. A ativação cria o administrador e a unidade Teles Plaza Hotel vazia. Cadastre quartos e tarifas reais em Configurações; nenhum inventário real foi presumido.

## Integração de reservas

O formulário consulta categorias e tarifas disponíveis no mesmo banco usado pelo painel. Uma solicitação recebe protocolo e aparece em “Reservas do site”. O administrador escolhe o quarto e confirma; a confirmação cria a reserva e atualiza a disponibilidade em uma transação. Solicitações pendentes não bloqueiam quartos. O hóspede recebe uma confirmação na tela; mensagens e e-mails de reserva ainda são enviados manualmente pela recepção. Grupos são atendidos pela recepção e registrados por quarto.

## Administração

Reservas, check-in/out, governança, financeiro, fornecedores, compras, estoque, propostas comerciais, caixa e relatórios foram portados da aplicação anterior. Todos os endpoints administrativos exigem JWT validado por Supabase Auth, registro de operador e autorização do proprietário da unidade. Não há cadastro aberto de administradores. A sessão é gerenciada pelo cliente Supabase; a chave pública pode aparecer no navegador, mas a chave de serviço e a conexão PostgreSQL existem apenas no ambiente Edge.

As tabelas ficam no schema privado `teles`, com RLS habilitado e sem acesso direto para anon/authenticated. Gravações usam transações e bloqueio por unidade para evitar reservas e recebimentos concorrentes duplicados. O site público só acessa disponibilidade agregada e envio de solicitações, sem expor dados de hóspedes. CORS limita os domínios do hotel. Endpoints públicos de gravação têm limites por janela de tempo.

## Publicação

- `npm ci`
- `npm run check`
- `npm run build`: gera o painel em `sys/` e reúne apenas arquivos públicos em `public-dist/`.
- Vercel usa `public-dist` e serve `/sys` pelo HTML do painel, sem redirecionar para outro domínio.
- Migração: `supabase/migrations/202609060001_hotel.sql`.
- Edge: `supabase/functions/hotel-api/index.ts`; `verify_jwt=false` é necessário para os endpoints públicos. O próprio handler valida o JWT nas rotas administrativas antes de qualquer acesso.

## Verificação

A suíte `tests/integration.mjs` foi executada com conta e registros temporários, removidos após o teste. Ela exige uma ativação descartável e não deve ser executada no ambiente de produção já utilizado pelo hotel. Cobriu login, submissão idempotente, confirmação, disponibilidade, check-in/out, caixa, concorrência de compras, estoque negativo, cálculo de propostas e isolamento entre unidades. Tipagem e build também foram validados.

## Continuidade

A aplicação anterior e seu banco D1 foram preservados. Registros eventualmente cadastrados nela não foram copiados automaticamente: migração de dados reais exige exportação e conferência antes da importação. O novo Supabase começa vazio. Pagamentos, emissão fiscal, contabilidade, recuperação de senha por e-mail, permissões por equipe e cobrança de assinaturas ainda precisam de implementação/configuração própria. Registros financeiros atuais representam pagamentos realizados fora do sistema.
