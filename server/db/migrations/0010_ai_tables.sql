-- AI Gateway Tables
-- Migration: 0010_ai_tables
-- Run this manually or via your migration runner before using /api/ai/*

CREATE TABLE IF NOT EXISTS ai_task (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  module TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5,
  input TEXT NOT NULL DEFAULT '{}',
  output TEXT,
  error TEXT,
  created_by_id TEXT,
  source TEXT,
  folio TEXT,
  lead_id TEXT,
  file_id TEXT,
  needs_approval INTEGER NOT NULL DEFAULT 0,
  approval_reason TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_audit_log (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  agent_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  module TEXT,
  input TEXT,
  output TEXT,
  metadata TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_memory_record (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  content TEXT NOT NULL,
  metadata TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_document_job (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  module TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  extracted TEXT,
  summary TEXT,
  error TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_task_status ON ai_task(status);
CREATE INDEX IF NOT EXISTS idx_ai_task_agent ON ai_task(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_task_module ON ai_task(module);
CREATE INDEX IF NOT EXISTS idx_ai_audit_task ON ai_audit_log(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON ai_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_ns ON ai_memory_record(namespace, module);
CREATE INDEX IF NOT EXISTS idx_ai_memory_entity ON ai_memory_record(entity_type, entity_id);
