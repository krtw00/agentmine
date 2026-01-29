import { drizzle } from 'drizzle-orm/libsql'
import { createClient, type Client } from '@libsql/client'
import * as schema from './schema.js'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { createPgDb, initializePgDb, closePgDb, type PgDb } from './postgres.js'

// ============================================
// Types
// ============================================

export type SqliteDb = ReturnType<typeof drizzle<typeof schema>>
// Use SqliteDb as the common interface type since Drizzle ORM APIs are compatible
// This allows services to work with both SQLite and PostgreSQL without type errors
export type Db = SqliteDb
export type DbType = 'sqlite' | 'postgres'

export interface DbOptions {
  /** Database file path for SQLite (default: .agentmine/data.db) */
  path?: string
  /** Project root directory (default: process.cwd()) */
  projectRoot?: string
  /** Database URL (overrides path, supports postgres:// or file:) */
  url?: string
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
let currentDbType: DbType | null = null

// ============================================
// Database functions
// ============================================

/**
 * Detect database type from URL or environment
 */
export function detectDbType(url?: string): DbType {
  const dbUrl = url ?? process.env.DATABASE_URL
  if (dbUrl?.startsWith('postgres://') || dbUrl?.startsWith('postgresql://')) {
    return 'postgres'
  }
  return 'sqlite'
}

/**
 * Get current database type
 */
export function getDbType(): DbType | null {
  return currentDbType
}

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
 * Create database connection (SQLite or PostgreSQL based on DATABASE_URL)
 */
export function createDb(options: DbOptions = {}): Db {
  const url = options.url ?? process.env.DATABASE_URL
  const dbType = detectDbType(url)
  currentDbType = dbType

  if (dbType === 'postgres') {
    if (!url) {
      throw new Error('DATABASE_URL is required for PostgreSQL connection')
    }
    // Cast to Db (SqliteDb) since Drizzle ORM APIs are compatible
    dbInstance = createPgDb(url) as unknown as Db
    return dbInstance
  }

  // SQLite
  return createSqliteDb(options)
}

/**
 * Create SQLite database connection using libsql
 */
function createSqliteDb(options: DbOptions = {}): SqliteDb {
  const projectRoot = options.projectRoot ?? process.cwd()
  const url = options.url ?? process.env.DATABASE_URL

  let dbPath: string
  if (url?.startsWith('file:')) {
    dbPath = url.replace('file:', '')
  } else {
    dbPath = options.path ?? getDefaultDbPath(projectRoot)
  }

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
  currentDbType = 'sqlite'

  return dbInstance as SqliteDb
}

/**
 * Get the underlying libsql client (SQLite only)
 */
export function getClient(): Client | null {
  return clientInstance
}

/**
 * Initialize database tables
 * Creates tables if they don't exist
 * Automatically detects database type
 */
export async function initializeDb(db: Db): Promise<void> {
  const dbType = currentDbType ?? detectDbType()

  if (dbType === 'postgres') {
    // Use unknown intermediate cast for PostgreSQL
    await initializePgDb(db as unknown as PgDb)
    return
  }

  // SQLite initialization
  await initializeSqliteDb(db)
}

/**
 * Initialize SQLite database tables
 */
async function initializeSqliteDb(db: SqliteDb): Promise<void> {
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

  // Create tasks table (without branchName, prUrl - moved to sessions)
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id),
      parent_id INTEGER REFERENCES tasks(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'done', 'failed', 'dod_failed', 'cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('task', 'feature', 'bug', 'refactor')),
      assignee_type TEXT CHECK(assignee_type IN ('ai', 'human')),
      assignee_name TEXT,
      selected_session_id INTEGER,
      labels TEXT DEFAULT '[]',
      complexity INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Create sessions table (no UNIQUE on task_id, with branchName, prUrl)
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id),
      agent_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
      started_at INTEGER NOT NULL DEFAULT (unixepoch()),
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
      artifacts TEXT DEFAULT '[]',
      error TEXT DEFAULT NULL,
      pid INTEGER,
      review_status TEXT DEFAULT 'pending' CHECK(review_status IN ('pending', 'approved', 'rejected', 'needs_work')),
      reviewed_by TEXT,
      reviewed_at INTEGER,
      review_comment TEXT
    )
  `)

  // Create agents table (with dod column)
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
      dod TEXT DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(project_id, name)
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

  // Create memories table (with version)
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
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Create memory_history table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS memory_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id INTEGER NOT NULL REFERENCES memories(id),
      snapshot TEXT NOT NULL,
      version INTEGER NOT NULL,
      changed_by TEXT,
      change_summary TEXT,
      changed_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Create settings table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(project_id, key)
    )
  `)

  // Create audit_logs table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id),
      user_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'start', 'stop', 'export')),
      entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'agent', 'memory', 'session', 'settings')),
      entity_id TEXT NOT NULL,
      changes TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Create task_dependencies table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(task_id, depends_on_task_id)
    )
  `)

  // Create project_decisions table (legacy)
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

  // Create indexes
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_type, assignee_name)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_idempotency_key ON sessions(idempotency_key)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_agent_history_agent ON agent_history(agent_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memory_history_memory ON memory_history(memory_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_settings_project_key ON settings(project_id, key)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_decisions_category ON project_decisions(category)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON task_dependencies(depends_on_task_id)`)

  // Run migrations for existing databases
  await runSqliteMigrations(db)

  // Seed default agents
  await seedDefaultAgentsSqlite(db)
}

/**
 * Seed default agents for SQLite
 */
async function seedDefaultAgentsSqlite(db: SqliteDb): Promise<void> {
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
    await db.run(sql`
      INSERT OR IGNORE INTO agents (name, description, client, model, scope, config, dod)
      VALUES (
        ${agent.name},
        ${agent.description},
        ${agent.client},
        ${agent.model},
        '{"write":[],"exclude":[]}',
        '{}',
        '[]'
      )
    `)
  }
}

/**
 * Run migrations to update existing SQLite databases to the new schema
 */
async function runSqliteMigrations(db: SqliteDb): Promise<void> {
  // Migration: Add new columns to tasks
  try {
    const taskInfo = await db.all(sql`PRAGMA table_info(tasks)`) as Array<{ name: string }>
    const taskColumns = taskInfo.map((row) => row.name)

    if (!taskColumns.includes('selected_session_id')) {
      await db.run(sql`ALTER TABLE tasks ADD COLUMN selected_session_id INTEGER`)
    }
    if (!taskColumns.includes('labels')) {
      await db.run(sql`ALTER TABLE tasks ADD COLUMN labels TEXT DEFAULT '[]'`)
    }
  } catch {
    // Ignore errors if columns already exist
  }

  // Migration: Add new columns to sessions
  try {
    const sessionInfo = await db.all(sql`PRAGMA table_info(sessions)`) as Array<{ name: string }>
    const sessionColumns = sessionInfo.map((row) => row.name)

    if (!sessionColumns.includes('pid')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN pid INTEGER`)
    }
    if (!sessionColumns.includes('worktree_path')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN worktree_path TEXT`)
    }
    if (!sessionColumns.includes('review_status')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN review_status TEXT DEFAULT 'pending'`)
    }
    if (!sessionColumns.includes('reviewed_by')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN reviewed_by TEXT`)
    }
    if (!sessionColumns.includes('reviewed_at')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN reviewed_at INTEGER`)
    }
    if (!sessionColumns.includes('review_comment')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN review_comment TEXT`)
    }
    if (!sessionColumns.includes('session_group_id')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN session_group_id TEXT`)
    }
    if (!sessionColumns.includes('idempotency_key')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN idempotency_key TEXT`)
    }
    if (!sessionColumns.includes('branch_name')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN branch_name TEXT`)
    }
    if (!sessionColumns.includes('pr_url')) {
      await db.run(sql`ALTER TABLE sessions ADD COLUMN pr_url TEXT`)
    }
  } catch {
    // Ignore errors if columns already exist
  }

  // Migration: Add dod column to agents
  try {
    const agentInfo = await db.all(sql`PRAGMA table_info(agents)`) as Array<{ name: string }>
    const agentColumns = agentInfo.map((row) => row.name)

    if (!agentColumns.includes('dod')) {
      await db.run(sql`ALTER TABLE agents ADD COLUMN dod TEXT DEFAULT '[]'`)
    }
  } catch {
    // Ignore errors if columns already exist
  }

  // Migration: Add version column to memories
  try {
    const memoryInfo = await db.all(sql`PRAGMA table_info(memories)`) as Array<{ name: string }>
    const memoryColumns = memoryInfo.map((row) => row.name)

    if (!memoryColumns.includes('version')) {
      await db.run(sql`ALTER TABLE memories ADD COLUMN version INTEGER NOT NULL DEFAULT 1`)
    }
  } catch {
    // Ignore errors if columns already exist
  }
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
  const dbType = currentDbType

  if (dbType === 'postgres') {
    await closePgDb()
  } else if (clientInstance) {
    clientInstance.close()
    clientInstance = null
  }

  dbInstance = null
  currentDbType = null
}

// Re-export SQLite schema (default for backward compatibility)
export * from './schema.js'

// Re-export PostgreSQL schema tables directly
export {
  projects as pgProjects,
  tasks as pgTasks,
  sessions as pgSessions,
  agents as pgAgents,
  agentHistory as pgAgentHistory,
  memories as pgMemories,
  memoryHistory as pgMemoryHistory,
  settings as pgSettings,
  auditLogs as pgAuditLogs,
  projectDecisions as pgProjectDecisions,
  taskDependencies as pgTaskDependencies,
} from './pg-schema.js'

// Re-export PostgreSQL types
export type { PgDb } from './postgres.js'
