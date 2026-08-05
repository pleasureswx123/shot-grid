CREATE TABLE users (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL,
  email varchar(255) NOT NULL,
  password_hash text NOT NULL,
  role varchar(20) NOT NULL CHECK (role IN ('admin', 'director', 'creator', 'client')),
  department varchar(120) NOT NULL DEFAULT '',
  avatar text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE projects (
  id uuid PRIMARY KEY,
  name varchar(200) NOT NULL,
  code varchar(40) NOT NULL,
  project_type varchar(100) NOT NULL DEFAULT '',
  aspect_ratio varchar(20) NOT NULL DEFAULT '16:9',
  total_duration_min numeric(10, 2) NOT NULL DEFAULT 0,
  delivery_date date,
  director_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT '筹备中' CHECK (status IN ('进行中', '已完成', '筹备中')),
  current_phase varchar(120) NOT NULL DEFAULT '筹备中',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX projects_code_unique ON projects (lower(code));

CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role varchar(20) NOT NULL CHECK (project_role IN ('admin', 'director', 'creator', 'client')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE scenes (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_code varchar(40) NOT NULL,
  name varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, scene_code)
);

CREATE TABLE assets (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  category varchar(40) NOT NULL CHECK (
    category IN ('角色', '场景', '道具', '服装', '载具', '生物', '风格参考')
  ),
  thumbnail_url text NOT NULL DEFAULT '',
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT '未开始' CHECK (
    status IN ('未开始', '制作中', '审核中', '已定稿', '已锁定')
  ),
  latest_version_id uuid,
  approved_version_id uuid,
  description text NOT NULL DEFAULT '',
  reference_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assets_project_id_idx ON assets (project_id);
CREATE INDEX assets_assignee_id_idx ON assets (assignee_id);

CREATE TABLE shots (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE RESTRICT,
  shot_code varchar(40) NOT NULL,
  duration_sec numeric(10, 3) NOT NULL DEFAULT 0 CHECK (duration_sec >= 0),
  shot_type varchar(100) NOT NULL DEFAULT '',
  camera_movement varchar(200) NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  dialogue text,
  current_stage varchar(40) NOT NULL DEFAULT '台本',
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT '未开始' CHECK (
    status IN ('未开始', '制作中', '审核中', '已完成', '已锁定')
  ),
  latest_version_id uuid,
  thumbnail_url text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, shot_code)
);

CREATE INDEX shots_scene_id_idx ON shots (scene_id);
CREATE INDEX shots_assignee_id_idx ON shots (assignee_id);
CREATE INDEX shots_status_idx ON shots (project_id, status);

CREATE TABLE shot_assets (
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shot_id, asset_id)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title varchar(240) NOT NULL,
  entity_type varchar(20) NOT NULL CHECK (entity_type IN ('project', 'shot', 'asset')),
  entity_id uuid NOT NULL,
  pipeline_stage varchar(40) NOT NULL,
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT '未开始' CHECK (
    status IN ('未开始', '制作中', '待审核', '修改中', '已完成', '已阻塞')
  ),
  priority varchar(10) NOT NULL DEFAULT '中' CHECK (priority IN ('高', '中', '低')),
  due_date date,
  requirements text NOT NULL DEFAULT '',
  prerequisite_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  latest_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tasks_project_id_idx ON tasks (project_id);
CREATE INDEX tasks_entity_idx ON tasks (entity_type, entity_id);
CREATE INDEX tasks_assignee_status_idx ON tasks (assignee_id, status);

CREATE TABLE versions (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  entity_type varchar(20) NOT NULL CHECK (entity_type IN ('project', 'shot', 'asset')),
  entity_id uuid NOT NULL,
  version_number varchar(60) NOT NULL,
  file_url text NOT NULL,
  file_type varchar(20) NOT NULL CHECK (file_type IN ('video', 'image')),
  thumbnail_url text NOT NULL DEFAULT '',
  uploader_id uuid REFERENCES users(id) ON DELETE SET NULL,
  changelog text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT '待审核' CHECK (
    status IN ('待审核', '已通过', '已退回', '最终版')
  ),
  ai_params jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, version_number)
);

CREATE INDEX versions_entity_idx ON versions (entity_type, entity_id, created_at DESC);
CREATE INDEX versions_status_idx ON versions (status, created_at DESC);

ALTER TABLE tasks
  ADD CONSTRAINT tasks_latest_version_fk
  FOREIGN KEY (latest_version_id) REFERENCES versions(id) ON DELETE SET NULL;

ALTER TABLE shots
  ADD CONSTRAINT shots_latest_version_fk
  FOREIGN KEY (latest_version_id) REFERENCES versions(id) ON DELETE SET NULL;

ALTER TABLE assets
  ADD CONSTRAINT assets_latest_version_fk
  FOREIGN KEY (latest_version_id) REFERENCES versions(id) ON DELETE SET NULL;

ALTER TABLE assets
  ADD CONSTRAINT assets_approved_version_fk
  FOREIGN KEY (approved_version_id) REFERENCES versions(id) ON DELETE SET NULL;

CREATE TABLE notes (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content text NOT NULL,
  timestamp_sec numeric(12, 3),
  annotation_data_url text,
  annotations jsonb,
  is_mandatory boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT '待处理' CHECK (status IN ('待处理', '已解决')),
  reply_content text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notes_version_id_idx ON notes (version_id, created_at);

CREATE TABLE review_lists (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title varchar(240) NOT NULL,
  review_date date NOT NULL,
  description text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE review_list_versions (
  review_list_id uuid NOT NULL REFERENCES review_lists(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (review_list_id, version_id)
);

CREATE TABLE project_files (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(500) NOT NULL,
  file_type varchar(20) NOT NULL CHECK (file_type IN ('review', 'source')),
  extension varchar(20) NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  storage_key text,
  url text,
  nas_path text,
  entity_type varchar(20) CHECK (entity_type IN ('shot', 'asset')),
  entity_id uuid,
  entity_code varchar(100),
  version_number varchar(60),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploader_id uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX project_files_project_id_idx ON project_files (project_id, uploaded_at DESC);
CREATE INDEX project_files_entity_idx ON project_files (entity_type, entity_id);

CREATE TABLE department_channels (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  department varchar(120) NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  icon varchar(60) NOT NULL DEFAULT 'MessageSquare',
  is_private boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX department_channels_project_name_unique
  ON department_channels (project_id, lower(name));

CREATE TABLE channel_members (
  channel_id uuid NOT NULL REFERENCES department_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES department_channels(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  media_type varchar(20) NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'video')),
  media_url text,
  media_name varchar(500),
  media_size_bytes bigint CHECK (media_size_bytes >= 0),
  edited_media_url text,
  referenced_entity jsonb,
  reply_to_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX chat_messages_channel_created_idx
  ON chat_messages (channel_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE chat_message_likes (
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  action varchar(120) NOT NULL,
  entity_type varchar(80),
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_project_created_idx ON audit_logs (project_id, created_at DESC);
CREATE INDEX audit_logs_actor_created_idx ON audit_logs (actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER scenes_set_updated_at
  BEFORE UPDATE ON scenes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER assets_set_updated_at
  BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER shots_set_updated_at
  BEFORE UPDATE ON shots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER review_lists_set_updated_at
  BEFORE UPDATE ON review_lists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER department_channels_set_updated_at
  BEFORE UPDATE ON department_channels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER chat_messages_set_updated_at
  BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
