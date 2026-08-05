ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_entity_type_check,
  ADD CONSTRAINT tasks_entity_type_check
  CHECK (entity_type IN ('project', 'shot', 'asset'));

ALTER TABLE versions
  DROP CONSTRAINT IF EXISTS versions_entity_type_check,
  ADD CONSTRAINT versions_entity_type_check
  CHECK (entity_type IN ('project', 'shot', 'asset'));
