import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ============================================
// SQLite Schema (Primary for local development)
// Based on docs/04-data/data-model.md
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

  // Status: dod_failed added per design doc
  status: text('status', {
    enum: ['open', 'in_progress', 'done', 'failed', 'dod_failed', 'cancelled']
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

  // Selected session (for parallel comparison)
  selectedSessionId: integer('selected_session_id'),

  // Labels (for tagging)
  labels: text('labels', { mode: 'json' })
    .$type<string[]>()
    .default([]),

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
 * 1タスク複数セッション可（並列比較サポート）
 */
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // No UNIQUE constraint - allows multiple sessions per task
  taskId: integer('task_id')
    .references(() => tasks.id),
  agentName: text('agent_name').notNull(),

  // Session status
  status: text('status', {
    enum: ['running', 'completed', 'failed', 'cancelled']
  }).notNull().default('running'),

  // Execution timing
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),

  // Parallel execution support
  sessionGroupId: text('session_group_id'), // 同時実行グループID
  idempotencyKey: text('idempotency_key').unique(), // 重複実行防止キー

  // Git info (moved from tasks per design doc)
  branchName: text('branch_name'),
  prUrl: text('pr_url'),

  // Worktree info
  worktreePath: text('worktree_path'),

  // Worker termination info (observable facts)
  exitCode: integer('exit_code'),
  signal: text('signal'), // SIGTERM, SIGKILL等

  // DoD result per design doc: passed, failed, skipped, timeout
  dodResult: text('dod_result', {
    enum: ['passed', 'failed', 'skipped', 'timeout']
  }),

  // Artifacts (JSON array: changed file paths)
  artifacts: text('artifacts', { mode: 'json' })
    .$type<string[]>()
    .default([]),

  // Error info (JSON: failure details)
  error: text('error', { mode: 'json' })
    .$type<SessionError | null>()
    .default(null),

  // Detach mode: process info
  pid: integer('pid'), // Background process PID

  // Review info
  reviewStatus: text('review_status', {
    enum: ['pending', 'approved', 'rejected', 'needs_work']
  }).default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  reviewComment: text('review_comment'),
})

/**
 * Agents table
 * エージェント定義（DBマスター）
 */
export const agents = sqliteTable('agents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),

  name: text('name').notNull(),
  description: text('description'),

  client: text('client').notNull(), // claude-code, codex, gemini-cli等
  model: text('model').notNull(),   // opus, sonnet, haiku, gpt-4等

  // Scope control (JSON)
  // { read?: string[], write: string[], exclude: string[] }
  scope: text('scope', { mode: 'json' })
    .$type<AgentScope>()
    .notNull()
    .default({ write: [], exclude: [] }),

  // Additional config (JSON)
  config: text('config', { mode: 'json' })
    .$type<AgentConfig>()
    .default({}),

  // Prompt content (Markdown)
  promptContent: text('prompt_content'),

  // DoD verification commands (JSON array) - per design doc
  dod: text('dod', { mode: 'json' })
    .$type<string[]>()
    .default([]),

  // Version management
  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  uniqueNamePerProject: unique().on(table.projectId, table.name),
}))

/**
 * Agent history table
 * エージェント定義の変更履歴
 */
export const agentHistory = sqliteTable('agent_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  agentId: integer('agent_id')
    .references(() => agents.id)
    .notNull(),

  // Snapshot of previous state (JSON)
  snapshot: text('snapshot', { mode: 'json' })
    .$type<AgentSnapshot>()
    .notNull(),

  version: integer('version').notNull(),
  changedBy: text('changed_by'),
  changeSummary: text('change_summary'),

  changedAt: integer('changed_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Memories table
 * Memory Bank（DBマスター）
 */
export const memories = sqliteTable('memories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),

  category: text('category').notNull(), // architecture, convention, tooling, rule等
  title: text('title').notNull(),
  summary: text('summary'), // 短い要約（AIコンテキスト用）

  content: text('content').notNull(), // 本文（Markdown）

  status: text('status', {
    enum: ['draft', 'active', 'archived']
  }).notNull().default('active'),

  // Metadata
  tags: text('tags', { mode: 'json' })
    .$type<string[]>()
    .default([]),

  relatedTaskId: integer('related_task_id').references(() => tasks.id),

  // Version management - per design doc
  version: integer('version').notNull().default(1),

  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Memory history table
 * Memory変更履歴 - per design doc
 */
export const memoryHistory = sqliteTable('memory_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  memoryId: integer('memory_id')
    .references(() => memories.id)
    .notNull(),

  // Snapshot of previous state (JSON)
  snapshot: text('snapshot', { mode: 'json' })
    .$type<MemorySnapshot>()
    .notNull(),

  version: integer('version').notNull(),
  changedBy: text('changed_by'),
  changeSummary: text('change_summary'),

  changedAt: integer('changed_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Settings table
 * プロジェクト設定（DBマスター） - per design doc
 */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),

  key: text('key').notNull(), // e.g., git.baseBranch, execution.maxWorkers
  value: text('value', { mode: 'json' })
    .$type<unknown>()
    .notNull(),

  updatedBy: text('updated_by'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  uniqueKeyPerProject: unique().on(table.projectId, table.key),
}))

/**
 * Audit logs table
 * 監査ログ - per design doc
 */
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),

  userId: text('user_id').notNull(), // 操作者（人間 or AI識別子）

  action: text('action', {
    enum: ['create', 'update', 'delete', 'start', 'stop', 'export']
  }).notNull(),

  entityType: text('entity_type', {
    enum: ['task', 'agent', 'memory', 'session', 'settings']
  }).notNull(),
  entityId: text('entity_id').notNull(),

  // Changes (JSON: before/after)
  changes: text('changes', { mode: 'json' })
    .$type<AuditLogChanges>()
    .default({}),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Task dependencies table
 * タスク間の依存関係（blockedBy/blocks）
 */
export const taskDependencies = sqliteTable('task_dependencies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id')
    .references(() => tasks.id)
    .notNull(),
  dependsOnTaskId: integer('depends_on_task_id')
    .references(() => tasks.id)
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  uniqueDep: unique().on(table.taskId, table.dependsOnTaskId),
}))

/**
 * Project decisions table (Legacy - kept for backward compatibility)
 * Note: Prefer using memories table with category='decision'
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

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'failed' | 'dod_failed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskType = 'task' | 'feature' | 'bug' | 'refactor'
export type AssigneeType = 'ai' | 'human'
export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled'
export type DodResult = 'passed' | 'failed' | 'skipped' | 'timeout'
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_work'
export type DecisionCategory = 'architecture' | 'tooling' | 'convention' | 'rule'
export type MemoryStatus = 'draft' | 'active' | 'archived'
export type AuditAction = 'create' | 'update' | 'delete' | 'start' | 'stop' | 'export'
export type EntityType = 'task' | 'agent' | 'memory' | 'session' | 'settings'

export interface SessionError {
  type: 'timeout' | 'crash' | 'signal' | 'unknown'
  message: string
  details?: Record<string, unknown>
}

export interface AgentScope {
  /** 参照可能（globパターン）- 省略時はexcludeを除く全ファイル */
  read?: string[]
  /** 編集可能（globパターン） */
  write: string[]
  /** アクセス不可（globパターン） */
  exclude: string[]
}

export interface AgentConfig {
  temperature?: number
  maxTokens?: number
  promptFile?: string
  [key: string]: unknown
}

export interface AgentSnapshot {
  name: string
  description?: string
  client: string
  model: string
  scope: AgentScope
  config?: AgentConfig
  promptContent?: string
  dod?: string[]
}

export interface MemorySnapshot {
  category: string
  title: string
  summary?: string
  content: string
  status: MemoryStatus
  tags?: string[]
}

export interface AuditLogChanges {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

// Legacy interface for backward compatibility
export interface AgentDefinition {
  name: string
  description?: string
  client: string
  model: string
  scope: AgentScope
  config?: AgentConfig
  promptContent?: string
  dod?: string[]
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

export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert

export type AgentHistoryRecord = typeof agentHistory.$inferSelect
export type NewAgentHistoryRecord = typeof agentHistory.$inferInsert

export type Memory = typeof memories.$inferSelect
export type NewMemory = typeof memories.$inferInsert

export type MemoryHistoryRecord = typeof memoryHistory.$inferSelect
export type NewMemoryHistoryRecord = typeof memoryHistory.$inferInsert

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

export type TaskDependency = typeof taskDependencies.$inferSelect
export type NewTaskDependency = typeof taskDependencies.$inferInsert

// ============================================
// Config definition (from YAML - legacy)
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
