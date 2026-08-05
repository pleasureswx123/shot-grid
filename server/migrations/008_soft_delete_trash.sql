ALTER TABLE shots ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE versions ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE review_lists ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shots_project_active_idx ON shots (project_id, sort_order, shot_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS assets_project_active_idx ON assets (project_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_project_active_idx ON tasks (project_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS versions_task_active_idx ON versions (task_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notes_version_active_idx ON notes (version_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS review_lists_project_active_idx ON review_lists (project_id, review_date DESC, created_at DESC) WHERE deleted_at IS NULL;
