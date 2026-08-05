ALTER TABLE versions
  ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES project_files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS versions_file_id_idx ON versions (file_id);
