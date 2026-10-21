-- Contato e liquidação do sinal: a recepção precisa do e-mail de quem pagou,
-- e o caixa precisa saber quando o dinheiro entrou.
SET search_path TO teles, public;

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

RESET search_path;
