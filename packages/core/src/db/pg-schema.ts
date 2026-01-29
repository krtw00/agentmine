import { pgTable, text, integer, serial, unique, jsonb, timestamp } from 'drizzle-orm/pg-core'

// ============================================
// PostgreSQL Schema
// Based on docs/04-data/data-model.md
// ============================================

/**
 * Projects table
 */
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * Tasks table
 */
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  parentId: integer('parent_id'),

  title: text('title').notNull(),
  description: text('description'),

  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('medium'),
  type: text('type').notNull().default('task'),

  assigneeType: text('assignee_type'),
  assigneeName: text('assignee_name'),

  selectedSessionId: integer('selected_session_id'),

  labels: jsonb('labels').$type<string[]>().default([]),

  complexity: integer('complexity'),

  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * Sessions table
 */
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),

  taskId: integer('task_id').references(() => tasks.id),
  agentName: text('agent_name').notNull(),

  status: text('status').notNull().default('running'),

  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  durationMs: integer('duration_ms'),

  sessionGroupId: text('session_group_id'),
  idempotencyKey: text('idempotency_key').unique(),

  branchName: text('branch_name'),
  prUrl: text('pr_url'),

  worktreePath: text('worktree_path'),

  exitCode: integer('exit_code'),
  signal: text('signal'),

  dodResult: text('dod_result'),

  artifacts: jsonb('artifacts').$type<string[]>().default([]),

  error: jsonb('error').$type<SessionError | null>().default(null),

  pid: integer('pid'),

  reviewStatus: text('review_status').default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: integer('reviewed_at'),
  reviewComment: text('review_comment'),
})

/**
 * Agents table
 */
export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),

  name: text('name').notNull(),
  description: text('description'),

  client: text('client').notNull(),
  model: text('model').notNull(),

  scope: jsonb('scope').$type<AgentScope>().notNull().default({ write: [], exclude: [] }),

  config: jsonb('config').$type<AgentConfig>().default({}),

  promptContent: text('prompt_content'),

  dod: jsonb('dod').$type<string[]>().default([]),

  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),

  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  uniqueNamePerProject: unique().on(table.projectId, table.name),
}))

/**
 * Agent history table
 */
export const agentHistory = pgTable('agent_history', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id')
    .references(() => agents.id)
    .notNull(),

  snapshot: jsonb('snapshot').$type<AgentSnapshot>().notNull(),

  version: integer('version').notNull(),
  changedBy: text('changed_by'),
  changeSummary: text('change_summary'),

  changedAt: integer('changed_at').notNull(),
})

/**
 * Memories table
 */
export const memories = pgTable('memories', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),

  category: text('category').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),

  content: text('content').notNull(),

  status: text('status').notNull().default('active'),

  tags: jsonb('tags').$type<string[]>().default([]),

  relatedTaskId: integer('related_task_id').references(() => tasks.id),

  version: integer('version').notNull().default(1),

  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * Memory history table
 */
export const memoryHistory = pgTable('memory_history', {
  id: serial('id').primaryKey(),
  memoryId: integer('memory_id')
    .references(() => memories.id)
    .notNull(),

  snapshot: jsonb('snapshot').$type<MemorySnapshot>().notNull(),

  version: integer('version').notNull(),
  changedBy: text('changed_by'),
  changeSummary: text('change_summary'),

  changedAt: integer('changed_at').notNull(),
})

/**
 * Settings table
 */
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),

  key: text('key').notNull(),
  value: jsonb('value').$type<unknown>().notNull(),

  updatedBy: text('updated_by'),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  uniqueKeyPerProject: unique().on(table.projectId, table.key),
}))

/**
 * Audit logs table
 */
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),

  userId: text('user_id').notNull(),

  action: text('action').notNull(),

  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),

  changes: jsonb('changes').$type<AuditLogChanges>().default({}),

  createdAt: integer('created_at').notNull(),
})

/**
 * Task dependencies table
 */
export const taskDependencies = pgTable('task_dependencies', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => tasks.id)
    .notNull(),
  dependsOnTaskId: integer('depends_on_task_id')
    .references(() => tasks.id)
    .notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  uniqueDep: unique().on(table.taskId, table.dependsOnTaskId),
}))

/**
 * Project decisions table (Legacy)
 */
export const projectDecisions = pgTable('project_decisions', {
  id: serial('id').primaryKey(),

  category: text('category').notNull(),

  title: text('title').notNull(),
  decision: text('decision').notNull(),
  reason: text('reason'),

  relatedTaskId: integer('related_task_id').references(() => tasks.id),

  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at'),
})

// ============================================
// Type definitions (shared with SQLite schema)
// ============================================

export interface SessionError {
  type: 'timeout' | 'crash' | 'signal' | 'unknown'
  message: string
  details?: Record<string, unknown>
}

export interface AgentScope {
  read?: string[]
  write: string[]
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
  status: 'draft' | 'active' | 'archived'
  tags?: string[]
}

export interface AuditLogChanges {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}
