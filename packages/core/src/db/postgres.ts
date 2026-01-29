import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, type PoolClient } from 'pg'
import { sql } from 'drizzle-orm'
import * as pgSchema from './pg-schema.js'

// ============================================
// Types
// ============================================

export type PgDb = ReturnType<typeof drizzle<typeof pgSchema>>

// ============================================
// Module state
// ============================================

let poolInstance: Pool | null = null
let dbInstance: PgDb | null = null

// ============================================
// PostgreSQL Database functions
// ============================================

/**
 * Create PostgreSQL database connection
 */
export function createPgDb(connectionString: string): PgDb {
  const pool = new Pool({ connectionString })

  poolInstance = pool
  // Note: Drizzle's node-postgres adapter works with Pool
  dbInstance = drizzle(pool, { schema: pgSchema }) as unknown as PgDb

  return dbInstance
}

/**
 * Get the underlying pg Pool
 */
export function getPgPool(): Pool | null {
  return poolInstance
}

/**
 * Initialize PostgreSQL database tables
 * Creates tables if they don't exist
 */
export async function initializePgDb(db: PgDb): Promise<void> {
  // Create projects table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      updated_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    )
  `)

  // Create tasks table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      parent_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'done', 'failed', 'dod_failed', 'cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('task', 'feature', 'bug', 'refactor')),
      assignee_type TEXT CHECK(assignee_type IN ('ai', 'human')),
      assignee_name TEXT,
      selected_session_id INTEGER,
      labels JSONB DEFAULT '[]',
      complexity INTEGER,
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      updated_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    )
  `)

  // Create sessions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id),
      agent_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
      started_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      completed_at INTEGER,
      duration_ms INTEGER,
      session_group_id TEXT,
      idempotency_key TEXT UNIQUE,
      branch_name TEXT,
      pr_url TEXT,
      worktree_path TEXT,
      exit_code INTEGER,
      signal TEXT,
      dod_result TEXT CHECK(dod_result IN ('passed', 'failed', 'skipped', 'timeout')),
      artifacts JSONB DEFAULT '[]',
      error JSONB DEFAULT NULL,
      pid INTEGER,
      review_status TEXT DEFAULT 'pending' CHECK(review_status IN ('pending', 'approved', 'rejected', 'needs_work')),
      reviewed_by TEXT,
      reviewed_at INTEGER,
      review_comment TEXT
    )
  `)

  // Create agents table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      name TEXT NOT NULL,
      description TEXT,
      client TEXT NOT NULL,
      model TEXT NOT NULL,
      scope JSONB NOT NULL DEFAULT '{"write":[],"exclude":[]}',
      config JSONB DEFAULT '{}',
      prompt_content TEXT,
      dod JSONB DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      updated_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      UNIQUE(project_id, name)
    )
  `)

  // Create agent_history table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_history (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES agents(id),
      snapshot JSONB NOT NULL,
      version INTEGER NOT NULL,
      changed_by TEXT,
      change_summary TEXT,
      changed_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    )
  `)

  // Create memories table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS memories (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft', 'active', 'archived')),
      tags JSONB DEFAULT '[]',
      related_task_id INTEGER REFERENCES tasks(id),
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      updated_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    )
  `)

  // Create memory_history table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS memory_history (
      id SERIAL PRIMARY KEY,
      memory_id INTEGER NOT NULL REFERENCES memories(id),
      snapshot JSONB NOT NULL,
      version INTEGER NOT NULL,
      changed_by TEXT,
      change_summary TEXT,
      changed_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    )
  `)

  // Create settings table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      key TEXT NOT NULL,
      value JSONB NOT NULL,
      updated_by TEXT,
      updated_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      UNIQUE(project_id, key)
    )
  `)

  // Create audit_logs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      user_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'start', 'stop', 'export')),
      entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'agent', 'memory', 'session', 'settings')),
      entity_id TEXT NOT NULL,
      changes JSONB DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    )
  `)

  // Create task_dependencies table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS task_dependencies (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id),
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      UNIQUE(task_id, depends_on_task_id)
    )
  `)

  // Create project_decisions table (legacy)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_decisions (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL CHECK(category IN ('architecture', 'tooling', 'convention', 'rule')),
      title TEXT NOT NULL,
      decision TEXT NOT NULL,
      reason TEXT,
      related_task_id INTEGER REFERENCES tasks(id),
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      updated_at INTEGER
    )
  `)

  // Create indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_type, assignee_name)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_idempotency_key ON sessions(idempotency_key)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_history_agent ON agent_history(agent_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_memory_history_memory ON memory_history(memory_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_settings_project_key ON settings(project_id, key)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_decisions_category ON project_decisions(category)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON task_dependencies(depends_on_task_id)`)

  // Seed default agents if not exist
  await seedDefaultAgents(db)
}

/**
 * Seed default agents
 */
async function seedDefaultAgents(db: PgDb): Promise<void> {
  const defaultAgents = [
    {
      name: 'coder',
      description: 'Default coding agent using Claude Code',
      client: 'claude-code',
      model: 'sonnet',
    },
    {
      name: 'codex-coder',
      description: 'Coding agent using OpenAI Codex CLI',
      client: 'codex',
      model: 'gpt-4.1',
    },
    {
      name: 'gemini-coder',
      description: 'Coding agent using Gemini CLI',
      client: 'gemini-cli',
      model: 'gemini-2.5-pro',
    },
  ]

  for (const agent of defaultAgents) {
    await db.execute(sql`
      INSERT INTO agents (name, description, client, model, scope, config, dod)
      VALUES (
        ${agent.name},
        ${agent.description},
        ${agent.client},
        ${agent.model},
        '{"write":[],"exclude":[]}'::jsonb,
        '{}'::jsonb,
        '[]'::jsonb
      )
      ON CONFLICT (project_id, name) DO NOTHING
    `)
  }
}

/**
 * Close PostgreSQL connection pool
 */
export async function closePgDb(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end()
    poolInstance = null
    dbInstance = null
  }
}
