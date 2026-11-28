ALTER TABLE assistants ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS share_token text;
CREATE UNIQUE INDEX IF NOT EXISTS assistants_token_idx ON assistants (share_token) WHERE share_token IS NOT NULL;
CREATE TABLE IF NOT EXISTS assistant_subs (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assistant_id  uuid NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, assistant_id)
);
