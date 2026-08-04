ALTER TABLE projects
  ADD COLUMN storage_key text;

UPDATE projects
   SET storage_key = upper(code)
 WHERE storage_key IS NULL;

ALTER TABLE projects
  ALTER COLUMN storage_key SET NOT NULL;

CREATE UNIQUE INDEX projects_storage_key_unique
  ON projects (lower(storage_key));
