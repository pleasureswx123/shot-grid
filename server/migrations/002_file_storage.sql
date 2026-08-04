ALTER TABLE project_files
  ALTER COLUMN entity_id TYPE text USING entity_id::text;

ALTER TABLE project_files
  ADD COLUMN mime_type varchar(200),
  ADD COLUMN sha256 char(64),
  ADD COLUMN deleted_at timestamptz;

CREATE UNIQUE INDEX project_files_storage_key_unique_idx
  ON project_files (storage_key)
  WHERE storage_key IS NOT NULL;

CREATE INDEX project_files_active_project_idx
  ON project_files (project_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;
