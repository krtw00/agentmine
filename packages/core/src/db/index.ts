import { drizzle } from 'drizzle-orm/libsql'
import { createClient, type Client } from '@libsql/client'
import * as schema from './schema.js'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { sql } from 'drizzle-orm'

// ============================================
// Types
// ============================================

export type Db = ReturnType<typeof drizzle<typeof schema>>

export interface DbOptions {
  /** Database file path (default: .agentmine/data.db) */
  path?: string
  /** Project root directory (default: process.cwd()) */
  projectRoot?: string
}

// ============================================
// Constants
// ============================================

export const AGENTMINE_DIR = '.agentmine'
export const DEFAULT_DB_NAME = 'data.db'

// ============================================
// Module state
// ============================================

let dbInstance: Db | null = null
let clientInstance: Client | null = null

// ============================================
// Database functions
// ============================================

/**
 * Get the .agentmine directory path for a project
 */
export function getAgentmineDir(projectRoot: string = process.cwd()): string {
  return join(projectRoot, AGENTMINE_DIR)
}

/**
 * Get the default database path for a project
 */
export function getDefaultDbPath(projectRoot: string = process.cwd()): string {
  return join(getAgentmineDir(projectRoot), DEFAULT_DB_NAME)
}

/**
 * Check if a project is initialized (has .agentmine directory)
 */
export function isProjectInitialized(projectRoot: string = process.cwd()): boolean {
  return existsSync(getAgentmineDir(projectRoot))
}

/**
 * Create SQLite database connection using libsql
 */
export function createDb(options: DbOptions = {}): Db {
  const projectRoot = options.projectRoot ?? process.cwd()
  const dbPath = options.path ?? getDefaultDbPath(projectRoot)
  const absolutePath = resolve(projectRoot, dbPath)

  // Ensure directory exists
  const dir = dirname(absolutePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const client = createClient({
    url: `file:${absolutePath}`,
  })

  clientInstance = client
  dbInstance = drizzle(client, { schema })

  return dbInstance
}

/**
 * Get the underlying libsql client
 */
export function getClient(): Client | null {
  return clientInstance
}

/**
 * Initialize database tables
 * Creates tables if they don't exist
 */
export async function initializeDb(db: Db): Promise<void> {
  // Create projects table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Create tasks table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id),
      parent_id INTEGER REFERENCES tasks(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'done', 'failed', 'cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('task', 'feature', 'bug', 'refactor')),
      assignee_type TEXT CHECK(assignee_type IN ('ai', 'human')),
      assignee_name TEXT,
      branch_name TEXT,
      pr_url TEXT,
      complexity INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Create sessions table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER UNIQUE REFERENCES tasks(id),
      agent_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
      started_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER,
      duration_ms INTEGER,
      exit_code INTEGER,
      signal TEXT,
      dod_result TEXT DEFAULT 'pending' CHECK(dod_result IN ('pending', 'merged', 'timeout', 'error')),
      artifacts TEXT DEFAULT '[]',
      error TEXT DEFAULT NULL
    )
  `)

  // Create project_decisions table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS project_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK(category IN ('architecture', 'tooling', 'convention', 'rule')),
      title TEXT NOT NULL,
      decision TEXT NOT NULL,
      reason TEXT,
      related_task_id INTEGER REFERENCES tasks(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER
    )
  `)

  // Create agents table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id),
      name TEXT NOT NULL,
      description TEXT,
      client TEXT NOT NULL,
      model TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT '{"write":[],"exclude":[]}',
      config TEXT DEFAULT '{}',
      prompt_content TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Create agent_history table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS agent_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL REFERENCES agents(id),
      snapshot TEXT NOT NULL,
      version INTEGER NOT NULL,
      changed_by TEXT,
      change_summary TEXT,
      changed_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Create memories table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft', 'active', 'archived')),
      tags TEXT DEFAULT '[]',
      related_task_id INTEGER REFERENCES tasks(id),
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Create indexes
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_type, assignee_name)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_decisions_category ON project_decisions(category)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_agent_history_agent ON agent_history(agent_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id)`)

  // Migration: Add pid and worktree_path columns to sessions (for detach mode)
  // Check if column exists first to avoid errors
  try {
    const tableInfo = await db.all(sql`PRAGMA table_info(sessions)`) as Array<{ name: string }>
    const columns = tableInfo.map((row) => row.name)

    if (!columns.includes('pid')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN pid INTEGER`)
    }
    if (!columns.includes('worktree_path')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN worktree_path TEXT`)
    }

    // Migration: Add review columns to sessions
    if (!columns.includes('review_status')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN review_status TEXT DEFAULT 'pending'`)
    }
    if (!columns.includes('reviewed_by')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN reviewed_by TEXT`)
    }
    if (!columns.includes('reviewed_at')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN reviewed_at INTEGER`)
    }
    if (!columns.includes('review_comment')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN review_comment TEXT`)
    }
  } catch {
    // Ignore errors if columns already exist
  }
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (clientInstance) {
    clientInstance.close()
    clientInstance = null
    dbInstance = null
  }
}

// Re-export schema
export * from './schema.js'
