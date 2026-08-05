CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
  ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity_created_idx
  ON audit_logs (entity_type, entity_id, created_at DESC);
