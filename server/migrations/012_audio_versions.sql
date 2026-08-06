ALTER TABLE versions DROP CONSTRAINT IF EXISTS versions_file_type_check;
ALTER TABLE versions
  ADD CONSTRAINT versions_file_type_check
  CHECK (file_type IN ('video', 'image', 'audio'));
