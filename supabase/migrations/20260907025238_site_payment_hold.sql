-- Aplicada em produção em 2026-09-07 02:52 UTC fora do repositório.
-- Recuperada do histórico do banco (supabase_migrations.schema_migrations) para o repositório voltar a representar a produção.
SET search_path TO teles, public;

ALTER TABLE portal_config
  ADD COLUMN IF NOT EXISTS deposit_nights integer NOT NULL DEFAULT 1
  CHECK (deposit_nights BETWEEN 1 AND 30);

ALTER TABLE booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_status_check;

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS room_id text REFERENCES rooms(id),
  ADD COLUMN IF NOT EXISTS rate integer,
  ADD COLUMN IF NOT EXISTS total integer,
  ADD COLUMN IF NOT EXISTS deposit_amount integer,
  ADD COLUMN IF NOT EXISTS hold_until timestamptz,
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD CONSTRAINT booking_requests_status_check
    CHECK (status IN ('pending','awaiting_payment','confirmed','cancelled','payment_failed','payment_review'));

ALTER TABLE entries ADD COLUMN IF NOT EXISTS payment_id text;

CREATE INDEX IF NOT EXISTS idx_requests_active_hold
  ON booking_requests(hotel_id,room_id,checkin,checkout,hold_until)
  WHERE status='awaiting_payment';
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_payment_id
  ON booking_requests(payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_payment_id
  ON entries(payment_id) WHERE payment_id IS NOT NULL;

RESET search_path;
