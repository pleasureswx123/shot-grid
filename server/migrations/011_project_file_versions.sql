-- A version owns zero or more files.  Keep the relationship in one direction so
-- a version with several deliverables cannot disagree with versions.file_id.
ALTER TABLE project_files
  ADD COLUMN version_id uuid REFERENCES versions(id) ON DELETE CASCADE;

CREATE INDEX project_files_version_id_idx ON project_files (version_id);

-- Prefer the old UUID relationship, then use the legacy display number only
-- where it identifies exactly one version in the same project and entity.
UPDATE project_files f
   SET version_id = v.id
  FROM versions v
  JOIN tasks t ON t.id = v.task_id
 WHERE v.file_id = f.id
   AND t.project_id = f.project_id;

WITH unambiguous_legacy_matches AS (
  SELECT f.id AS file_id, min(v.id::text)::uuid AS version_id
    FROM project_files f
    JOIN tasks t
      ON t.project_id = f.project_id
     AND t.entity_type = f.entity_type
     AND t.entity_id::text = f.entity_id
    JOIN versions v
      ON v.task_id = t.id
     AND v.version_number = f.version_number
   WHERE f.version_id IS NULL
   GROUP BY f.id
  HAVING count(*) = 1
)
UPDATE project_files f
   SET version_id = m.version_id
  FROM unambiguous_legacy_matches m
 WHERE f.id = m.file_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM project_files WHERE file_type = 'review' AND version_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce review-file ownership: legacy review files remain unmatched';
  END IF;
END $$;

ALTER TABLE project_files
  ADD CONSTRAINT project_files_review_has_version_check
    CHECK (file_type <> 'review' OR version_id IS NOT NULL),
  ADD CONSTRAINT project_files_source_has_entity_check
    CHECK (file_type <> 'source' OR (entity_type IS NOT NULL AND entity_id IS NOT NULL)),
  ADD CONSTRAINT project_files_entity_pair_check
    CHECK ((entity_type IS NULL) = (entity_id IS NULL));

-- CHECK constraints cannot inspect another table.  This trigger prevents a
-- UUID from crossing project or entity boundaries, including direct SQL writes.
CREATE FUNCTION validate_project_file_ownership()
RETURNS trigger AS $$
DECLARE
  target_project uuid;
  target_entity_type text;
  target_entity_id text;
BEGIN
  IF NEW.entity_type = 'shot' THEN
    SELECT project_id INTO target_project FROM shots WHERE id::text = NEW.entity_id AND deleted_at IS NULL;
  ELSIF NEW.entity_type = 'asset' THEN
    SELECT project_id INTO target_project FROM assets WHERE id::text = NEW.entity_id AND deleted_at IS NULL;
  END IF;
  IF NEW.entity_type IS NOT NULL AND (target_project IS NULL OR target_project <> NEW.project_id) THEN
    RAISE EXCEPTION 'project file entity does not belong to its project' USING ERRCODE = '23514';
  END IF;

  IF NEW.version_id IS NOT NULL THEN
    SELECT t.project_id, v.entity_type, v.entity_id::text
      INTO target_project, target_entity_type, target_entity_id
      FROM versions v JOIN tasks t ON t.id = v.task_id
     WHERE v.id = NEW.version_id AND v.deleted_at IS NULL AND t.deleted_at IS NULL;
    IF target_project IS NULL OR target_project <> NEW.project_id THEN
      RAISE EXCEPTION 'project file version does not belong to its project' USING ERRCODE = '23514';
    END IF;
    IF NEW.entity_type IS NOT NULL
       AND (target_entity_type <> NEW.entity_type OR target_entity_id <> NEW.entity_id) THEN
      RAISE EXCEPTION 'project file and version entities do not match' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_files_validate_ownership
  BEFORE INSERT OR UPDATE OF project_id, entity_type, entity_id, version_id
  ON project_files FOR EACH ROW EXECUTE FUNCTION validate_project_file_ownership();

DROP INDEX IF EXISTS versions_file_id_idx;
ALTER TABLE versions DROP COLUMN file_id;
