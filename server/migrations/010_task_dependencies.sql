-- Promote task prerequisites from the legacy single foreign key to a many-to-many relation.
CREATE TABLE task_dependencies (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  prerequisite_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, prerequisite_task_id),
  CHECK (task_id <> prerequisite_task_id)
);

INSERT INTO task_dependencies (task_id, prerequisite_task_id)
SELECT id, prerequisite_task_id
FROM tasks
WHERE prerequisite_task_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX task_dependencies_prerequisite_idx
  ON task_dependencies (prerequisite_task_id, task_id);

CREATE INDEX tasks_blocked_idx
  ON tasks (id) WHERE status = '已阻塞' AND deleted_at IS NULL;
