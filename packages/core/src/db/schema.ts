import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ============================================
// SQLite Schema (Primary for local development)
// ============================================

/**
 * Projects table
 * Note: agentmineは1プロジェクト=1ディレクトリの原則
 * このテーブルは将来の拡張用（複数プロジェクト管理）
 */
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Tasks table
 * タスク管理の中心テーブル
 */
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),
  parentId: integer('parent_id'), // self-reference handled at application level

  title: text('title').notNull(),
  description: text('description'),

  status: text('status', {
    enum: ['open', 'in_progress', 'done', 'failed', 'cancelled']
  }).notNull().default('open'),

  priority: text('priority', {
    enum: ['low', 'medium', 'high', 'critical']
  }).notNull().default('medium'),

  type: text('type', {
    enum: ['task', 'feature', 'bug', 'refactor']
  }).notNull().default('task'),

  assigneeType: text('assignee_type', {
    enum: ['ai', 'human']
  }),
  assigneeName: text('assignee_name'),

  branchName: text('branch_name'),
  prUrl: text('pr_url'),

  complexity: integer('complexity'), // 1-10

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Sessions table
 * エージェント実行セッションの記録
 * 1タスク1セッション制約（UNIQUE）
 */
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  taskId: integer('task_id')
    .references(() => tasks.id)
    .unique(), // 1タスク1セッション制約
  agentName: text('agent_name').notNull(),

  status: text('status', {
    enum: ['running', 'completed', 'failed', 'cancelled']
  }).notNull().default('running'),

  // 実行時間
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),

  // Worker終了情報（観測可能な事実）
  exitCode: integer('exit_code'),
  signal: text('signal'), // SIGTERM, SIGKILL等

  // DoD判定結果
  dodResult: text('dod_result', {
    enum: ['pending', 'merged', 'timeout', 'error']
  }).default('pending'),

  // 成果物（JSON配列: 変更されたファイルパス）
  artifacts: text('artifacts', { mode: 'json' })
    .$type<string[]>()
    .default([]),

  // エラー情報（JSON: 失敗時の詳細）
  error: text('error', { mode: 'json' })
    .$type<SessionError | null>()
    .default(null),
})

/**
 * Project decisions table
 * プロジェクトの決定事項（Memory Bank の補助）
 */
export const projectDecisions = sqliteTable('project_decisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  category: text('category', {
    enum: ['architecture', 'tooling', 'convention', 'rule']
  }).notNull(),

  title: text('title').notNull(),
  decision: text('decision').notNull(),
  reason: text('reason'),

  relatedTaskId: integer('related_task_id').references(() => tasks.id),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

// ============================================
// Type definitions
// ============================================

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'failed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskType = 'task' | 'feature' | 'bug' | 'refactor'
export type AssigneeType = 'ai' | 'human'
export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled'
export type DodResult = 'pending' | 'merged' | 'timeout' | 'error'
export type DecisionCategory = 'architecture' | 'tooling' | 'convention' | 'rule'

export interface SessionError {
  type: 'timeout' | 'crash' | 'signal' | 'unknown'
  message: string
  details?: Record<string, unknown>
}

// Inferred types from schema
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type ProjectDecision = typeof projectDecisions.$inferSelect
export type NewProjectDecision = typeof projectDecisions.$inferInsert

// ============================================
// Agent definition (from YAML, not DB)
// ============================================

/**
 * Agent定義はYAMLファイル（.agentmine/agents/*.yaml）で管理
 * DBには保存しない
 */
export interface AgentDefinition {
  name: string
  description?: string
  client: string // claude-code, opencode, codex等
  model: string // opus, sonnet, haiku等
  scope: {
    read: string[] // 参照可能（globパターン）
    write: string[] // 編集可能（globパターン）
    exclude: string[] // アクセス不可（globパターン）
  }
  config?: {
    temperature?: number
    maxTokens?: number
    promptFile?: string
  }
}

// ============================================
// Config definition (from YAML)
// ============================================

export interface AgentmineConfig {
  project?: {
    name?: string
    description?: string
  }
  database?: {
    url?: string // default: file:.agentmine/data.db
  }
  git: {
    baseBranch: string
    branchPrefix?: string // default: task-
    commitConvention?: {
      enabled?: boolean
      format?: 'conventional' | 'simple' | 'custom'
    }
  }
  execution?: {
    parallel?: {
      enabled?: boolean
      maxWorkers?: number
      worktree?: {
        path?: string
        cleanup?: boolean
      }
    }
  }
  sessionLog?: {
    retention?: {
      enabled?: boolean
      days?: number
    }
  }
}
