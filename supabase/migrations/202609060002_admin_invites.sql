CREATE TABLE teles.operator_invites (
 email text PRIMARY KEY CHECK(email=lower(email)),digest text NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz
);
ALTER TABLE teles.operator_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON teles.operator_invites FROM PUBLIC,anon,authenticated;
ALTER TABLE teles.operators ADD COLUMN owner_id uuid REFERENCES auth.users(id);
UPDATE teles.operators SET owner_id=user_id WHERE owner_id IS NULL;
ALTER TABLE teles.operators ALTER COLUMN owner_id SET NOT NULL;
