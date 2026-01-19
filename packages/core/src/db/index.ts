import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import Database from 'better-sqlite3'
import postgres from 'postgres'
import * as schema from './schema.js'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { homedir } from 'os'
import { join } from 'path'

export type DatabaseType = 'sqlite' | 'postgres'

export interface DbConfig {
  type: DatabaseType
  url: string
}

// Detect database type from URL
export function detectDatabaseType(url: string): DatabaseType {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgres'
  }
  return 'sqlite'
}

// Get default database path
export function getDefaultDbPath(): string {
  const agentmineDir = join(homedir(), '.agentmine')
  if (!existsSync(agentmineDir)) {
    mkdirSync(agentmineDir, { recursive: true })
  }
  return join(agentmineDir, 'data.db')
}

// SQLite connection
export function createSqliteDb(path: string) {
  // Ensure directory exists
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')

  return drizzleSqlite(sqlite, {
    schema: {
      projects: schema.sqliteProjects,
      tasks: schema.sqliteTasks,
      histories: schema.sqliteHistories,
      agents: schema.sqliteAgents,
      skills: schema.sqliteSkills,
      sessions: schema.sqliteSessions,
    },
  })
}

// PostgreSQL connection
export function createPostgresDb(url: string) {
  const client = postgres(url)

  return drizzlePostgres(client, {
    schema: {
      projects: schema.pgProjects,
      tasks: schema.pgTasks,
      histories: schema.pgHistories,
      agents: schema.pgAgents,
      skills: schema.pgSkills,
      sessions: schema.pgSessions,
    },
  })
}

// Unified database interface
export type SqliteDb = ReturnType<typeof createSqliteDb>
export type PostgresDb = ReturnType<typeof createPostgresDb>
export type AnyDb = SqliteDb | PostgresDb

// Create database connection based on config
export function createDb(config?: DbConfig): { db: AnyDb; type: DatabaseType } {
  const url = config?.url ?? process.env.DATABASE_URL ?? getDefaultDbPath()
  const type = config?.type ?? detectDatabaseType(url)

  if (type === 'postgres') {
    return { db: createPostgresDb(url), type: 'postgres' }
  }

  // Default to SQLite
  const dbPath = url.startsWith('file:') ? url.slice(5) : url
  return { db: createSqliteDb(dbPath), type: 'sqlite' }
}

// Export schema
export * from './schema.js'
