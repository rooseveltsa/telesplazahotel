ALTER TABLE teles.rooms ADD COLUMN extra_guest_rate integer NOT NULL DEFAULT 0 CHECK (extra_guest_rate >= 0);
