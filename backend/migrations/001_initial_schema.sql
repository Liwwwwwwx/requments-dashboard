CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  ts BIGINT NOT NULL,
  kind TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id TEXT,
  task_id TEXT,
  actor TEXT,
  payload JSONB NOT NULL
);
CREATE INDEX idx_events_project_ts ON events(project_id, ts, id);
CREATE INDEX idx_events_requirement ON events(project_id, requirement_id, ts);

CREATE TABLE ai_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  account_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  model_id TEXT NOT NULL DEFAULT '',
  extra_headers_json JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id TEXT,
  title TEXT,
  model TEXT NOT NULL,
  account_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX idx_ai_conversations_user_project ON ai_conversations(user_id, project_id, updated_at DESC);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  ts BIGINT NOT NULL
);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, ts);

CREATE TABLE ai_proposals (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  events_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at BIGINT,
  applied_by TEXT,
  created_at BIGINT NOT NULL
);
