ALTER TABLE review_lists
  ADD COLUMN status varchar(20) NOT NULL DEFAULT '草稿' CHECK (status IN ('草稿', '待审核', '审核中', '已完成', '已归档')),
  ADD COLUMN round_number integer NOT NULL DEFAULT 1 CHECK (round_number >= 1),
  ADD COLUMN due_at timestamptz,
  ADD COLUMN submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN completed_at timestamptz;

CREATE TABLE review_list_participants (
  review_list_id uuid NOT NULL REFERENCES review_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_role varchar(20) NOT NULL CHECK (participant_role IN ('审核人', '客户', '观察者')),
  has_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_list_id, user_id)
);

CREATE INDEX review_lists_status_idx ON review_lists (project_id, status, due_at);
CREATE INDEX review_list_participants_user_idx ON review_list_participants (user_id, has_completed);
