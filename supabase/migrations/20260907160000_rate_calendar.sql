-- Tarifário por data: o preço deixa de ser atributo do quarto e passa a ser
-- de categoria x plano x dia. rooms.rate permanece como preço de segurança,
-- usado quando não existe tarifa cadastrada para a data.
SET search_path TO teles, public;

CREATE TABLE IF NOT EXISTS teles.rate_plans (
  id             text PRIMARY KEY,
  hotel_id       text NOT NULL REFERENCES teles.hotels(id),
  code           text NOT NULL,
  name           text NOT NULL,
  refundable     integer NOT NULL DEFAULT 1 CHECK (refundable IN (0,1)),
  deposit_nights integer NOT NULL DEFAULT 1 CHECK (deposit_nights BETWEEN 1 AND 30),
  active         integer NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created        text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_plans_code ON teles.rate_plans (hotel_id, code);
ALTER TABLE teles.rate_plans ENABLE ROW LEVEL SECURITY;

-- Uma linha por diária: mesmo formato que o OTA transmite em RateDetailsNotif.
CREATE TABLE IF NOT EXISTS teles.daily_rates (
  hotel_id            text NOT NULL REFERENCES teles.hotels(id),
  plan_id             text NOT NULL REFERENCES teles.rate_plans(id),
  category            text NOT NULL,
  day                 text NOT NULL CHECK (day ~ '^\d{4}-\d{2}-\d{2}$'),
  rate                integer NOT NULL CHECK (rate > 0),
  extra_guest_rate    integer NOT NULL DEFAULT 0 CHECK (extra_guest_rate >= 0),
  min_stay            integer NOT NULL DEFAULT 1 CHECK (min_stay BETWEEN 1 AND 30),
  closed              integer NOT NULL DEFAULT 0 CHECK (closed IN (0,1)),
  closed_to_arrival   integer NOT NULL DEFAULT 0 CHECK (closed_to_arrival IN (0,1)),
  closed_to_departure integer NOT NULL DEFAULT 0 CHECK (closed_to_departure IN (0,1)),
  updated             text NOT NULL,
  PRIMARY KEY (hotel_id, plan_id, category, day)
);
CREATE INDEX IF NOT EXISTS idx_daily_rates_lookup
  ON teles.daily_rates (hotel_id, category, day) WHERE closed = 0;
ALTER TABLE teles.daily_rates ENABLE ROW LEVEL SECURITY;

-- Diárias congeladas na reserva: alterar o tarifário nunca reescreve o
-- extrato de quem já se hospedou.
CREATE TABLE IF NOT EXISTS teles.reservation_nights (
  reservation_id text NOT NULL REFERENCES teles.reservations(id),
  day            text NOT NULL,
  rate           integer NOT NULL CHECK (rate >= 0),
  PRIMARY KEY (reservation_id, day)
);
ALTER TABLE teles.reservation_nights ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON teles.rate_plans, teles.daily_rates, teles.reservation_nights
  FROM PUBLIC, anon, authenticated;

-- Plano único de balcão, espelhando a regra de sinal já em produção.
INSERT INTO teles.rate_plans (id, hotel_id, code, name, refundable, deposit_nights, active, created)
SELECT 'plan-balcao-' || h.id, h.id, 'BALCAO', 'Balcão',
       1, COALESCE(p.deposit_nights, 1), 1, to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSZ')
FROM teles.hotels h
LEFT JOIN teles.portal_config p ON p.hotel_id = h.id
WHERE h.demo = 0
ON CONFLICT (hotel_id, code) DO NOTHING;

-- Backfill de dois anos replicando o cadastro atual. Nenhum preço muda:
-- é exatamente isso que prova que a troca de origem do preço foi correta.
INSERT INTO teles.daily_rates
  (hotel_id, plan_id, category, day, rate, extra_guest_rate, min_stay,
   closed, closed_to_arrival, closed_to_departure, updated)
SELECT r.hotel_id, pl.id, r.category, to_char(g.day, 'YYYY-MM-DD'),
       MIN(r.rate), MAX(r.extra_guest_rate), 1, 0, 0, 0,
       to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSZ')
FROM teles.rooms r
JOIN teles.rate_plans pl ON pl.hotel_id = r.hotel_id AND pl.code = 'BALCAO'
CROSS JOIN generate_series(current_date - 1, current_date + 729, interval '1 day') g(day)
GROUP BY r.hotel_id, pl.id, r.category, g.day
ON CONFLICT (hotel_id, plan_id, category, day) DO NOTHING;

RESET search_path;
