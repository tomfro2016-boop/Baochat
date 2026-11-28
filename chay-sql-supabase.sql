CREATE TABLE IF NOT EXISTS assistant_files (
  assistant_id  uuid NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  file_id       uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assistant_id, file_id)
);
