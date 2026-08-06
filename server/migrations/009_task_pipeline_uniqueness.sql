-- A task template has exactly one active task for each entity and pipeline stage.
WITH duplicates AS (
  SELECT id, row_number() OVER (
    PARTITION BY project_id, entity_type, entity_id, pipeline_stage ORDER BY created_at, id
  ) AS position
  FROM tasks WHERE deleted_at IS NULL
)
UPDATE tasks SET deleted_at = now()
WHERE id IN (SELECT id FROM duplicates WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS tasks_active_entity_pipeline_unique
  ON tasks (project_id, entity_type, entity_id, pipeline_stage)
  WHERE deleted_at IS NULL;
