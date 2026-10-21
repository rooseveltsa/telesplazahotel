SET search_path TO teles, public;

CREATE TABLE guests (
  id text PRIMARY KEY,
  hotel_id text NOT NULL REFERENCES hotels(id),
  name text NOT NULL,
  document_type text NOT NULL DEFAULT 'CPF',
  document text NOT NULL DEFAULT '',
  birth_date text NOT NULL DEFAULT '',
  nationality text NOT NULL DEFAULT 'Brasileira',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  address_number text NOT NULL DEFAULT '',
  complement text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created text NOT NULL,
  updated text NOT NULL
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE guests FROM PUBLIC, anon, authenticated;

CREATE INDEX idx_guests_hotel_name ON guests(hotel_id, lower(name));
CREATE INDEX idx_guests_hotel_phone ON guests(hotel_id, phone) WHERE phone <> '';
CREATE UNIQUE INDEX idx_guests_hotel_document ON guests(hotel_id, document_type, document) WHERE document <> '';
CREATE UNIQUE INDEX idx_guests_hotel_identity ON guests(hotel_id, lower(btrim(name)), regexp_replace(phone, '\D', '', 'g')) WHERE phone <> '';

ALTER TABLE reservations ADD COLUMN guest_id text REFERENCES guests(id);
ALTER TABLE booking_requests ADD COLUMN guest_id text REFERENCES guests(id);

CREATE INDEX idx_reservations_guest ON reservations(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX idx_requests_guest ON booking_requests(guest_id) WHERE guest_id IS NOT NULL;

WITH source AS (
  SELECT DISTINCT ON (r.hotel_id, lower(btrim(r.name)), regexp_replace(r.phone, '\D', '', 'g'))
    r.hotel_id,
    r.name,
    r.phone,
    r.company,
    r.created,
    COALESCE((
      SELECT br.email
      FROM booking_requests br
      WHERE br.reservation_id = r.id AND br.email <> ''
      ORDER BY br.created DESC
      LIMIT 1
    ), '') AS email
  FROM reservations r
  ORDER BY r.hotel_id, lower(btrim(r.name)), regexp_replace(r.phone, '\D', '', 'g'), r.created
)
INSERT INTO guests (
  id, hotel_id, name, phone, email, company, created, updated
)
SELECT gen_random_uuid()::text, hotel_id, name, phone, email, company, created, created
FROM source;

UPDATE reservations r
SET guest_id = g.id
FROM guests g
WHERE g.hotel_id = r.hotel_id
  AND lower(btrim(g.name)) = lower(btrim(r.name))
  AND regexp_replace(g.phone, '\D', '', 'g') = regexp_replace(r.phone, '\D', '', 'g');

UPDATE booking_requests br
SET guest_id = r.guest_id
FROM reservations r
WHERE r.id = br.reservation_id AND r.guest_id IS NOT NULL;

RESET search_path;
;
