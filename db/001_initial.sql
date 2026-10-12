BEGIN;
CREATE TABLE IF NOT EXISTS shop_state (
  id integer PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO shop_state(id, data) VALUES
(1, '{"version":1,"revision":0,"products":[],"ingredients":[],"orders":[],"activity":[]}')
ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  credential_version text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS request_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS product_images (
  id text PRIMARY KEY,
  mime text NOT NULL,
  bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
