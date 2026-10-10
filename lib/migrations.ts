// Run once on app startup (or manually) to create tables
export const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS workflows (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT 'Untitled Workflow',
  canvas      JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'idle',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workflows_user_id_idx ON workflows(user_id);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workflow_id  TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',
  scope        TEXT NOT NULL DEFAULT 'full',
  duration     NUMERIC,
  node_runs    JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS runs_workflow_id_idx ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS runs_user_id_idx ON workflow_runs(user_id);
`;
