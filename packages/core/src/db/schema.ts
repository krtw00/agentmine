import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { pgTable, varchar, serial, timestamp, text as pgText, integer as pgInteger } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ============================================
// SQLite Schema
// ============================================

export const sqliteProjects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  path: text('path').notNull(),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteTasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => sqliteProjects.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['open', 'in_progress', 'review', 'done', 'cancelled'] }).notNull().default('open'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'critical'] }).notNull().default('medium'),
  type: text('type', { enum: ['task', 'feature', 'bug', 'refactor'] }).notNull().default('task'),
  assigneeType: text('assignee_type', { enum: ['ai', 'human'] }),
  assigneeName: text('assignee_name'),
  branchName: text('branch_name'),
  prUrl: text('pr_url'),
  parentId: integer('parent_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
})

export const sqliteHistories = sqliteTable('histories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => sqliteTasks.id),
  action: text('action').notNull(),
  actorType: text('actor_type', { enum: ['ai', 'human'] }).notNull(),
  actorName: text('actor_name').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  comment: text('comment'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteAgents = sqliteTable('agents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => sqliteProjects.id),
  name: text('name').notNull(),
  description: text('description'),
  model: text('model').default('claude-sonnet'),
  tools: text('tools'), // JSON array
  skills: text('skills'), // JSON array
  systemPrompt: text('system_prompt'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteSkills = sqliteTable('skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => sqliteProjects.id),
  name: text('name').notNull(),
  description: text('description'),
  source: text('source', { enum: ['builtin', 'local', 'remote'] }).notNull().default('local'),
  path: text('path'),
  url: text('url'),
  prompt: text('prompt'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteSessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').references(() => sqliteTasks.id),
  agentName: text('agent_name').notNull(),
  status: text('status', { enum: ['running', 'completed', 'failed', 'cancelled'] }).notNull().default('running'),
  input: text('input'),
  output: text('output'),
  tokenUsage: integer('token_usage'),
  startedAt: text('started_at').default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at'),
})

// ============================================
// PostgreSQL Schema
// ============================================

export const pgProjects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  path: varchar('path', { length: 1024 }).notNull(),
  description: pgText('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const pgTasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  projectId: pgInteger('project_id').notNull().references(() => pgProjects.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: pgText('description'),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  type: varchar('type', { length: 20 }).notNull().default('task'),
  assigneeType: varchar('assignee_type', { length: 10 }),
  assigneeName: varchar('assignee_name', { length: 255 }),
  branchName: varchar('branch_name', { length: 255 }),
  prUrl: varchar('pr_url', { length: 1024 }),
  parentId: pgInteger('parent_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
})

export const pgHistories = pgTable('histories', {
  id: serial('id').primaryKey(),
  taskId: pgInteger('task_id').notNull().references(() => pgTasks.id),
  action: varchar('action', { length: 50 }).notNull(),
  actorType: varchar('actor_type', { length: 10 }).notNull(),
  actorName: varchar('actor_name', { length: 255 }).notNull(),
  oldValue: pgText('old_value'),
  newValue: pgText('new_value'),
  comment: pgText('comment'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const pgAgents = pgTable('agents', {
  id: serial('id').primaryKey(),
  projectId: pgInteger('project_id').references(() => pgProjects.id),
  name: varchar('name', { length: 100 }).notNull(),
  description: pgText('description'),
  model: varchar('model', { length: 100 }).default('claude-sonnet'),
  tools: pgText('tools'), // JSON array
  skills: pgText('skills'), // JSON array
  systemPrompt: pgText('system_prompt'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const pgSkills = pgTable('skills', {
  id: serial('id').primaryKey(),
  projectId: pgInteger('project_id').references(() => pgProjects.id),
  name: varchar('name', { length: 100 }).notNull(),
  description: pgText('description'),
  source: varchar('source', { length: 20 }).notNull().default('local'),
  path: varchar('path', { length: 1024 }),
  url: varchar('url', { length: 1024 }),
  prompt: pgText('prompt'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const pgSessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  taskId: pgInteger('task_id').references(() => pgTasks.id),
  agentName: varchar('agent_name', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('running'),
  input: pgText('input'),
  output: pgText('output'),
  tokenUsage: pgInteger('token_usage'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
})

// ============================================
// Type exports (database-agnostic)
// ============================================

export type TaskStatus = 'open' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskType = 'task' | 'feature' | 'bug' | 'refactor'
export type AssigneeType = 'ai' | 'human'
export type SkillSource = 'builtin' | 'local' | 'remote'
export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export type Project = {
  id: number
  name: string
  path: string
  description: string | null
  createdAt: string | Date | null
  updatedAt: string | Date | null
}

export type Task = {
  id: number
  projectId: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  type: TaskType
  assigneeType: AssigneeType | null
  assigneeName: string | null
  branchName: string | null
  prUrl: string | null
  parentId: number | null
  createdAt: string | Date | null
  updatedAt: string | Date | null
  startedAt: string | Date | null
  completedAt: string | Date | null
}

export type History = {
  id: number
  taskId: number
  action: string
  actorType: AssigneeType
  actorName: string
  oldValue: string | null
  newValue: string | null
  comment: string | null
  createdAt: string | Date | null
}

export type Agent = {
  id: number
  projectId: number | null
  name: string
  description: string | null
  model: string | null
  tools: string | null
  skills: string | null
  systemPrompt: string | null
  createdAt: string | Date | null
  updatedAt: string | Date | null
}

export type Skill = {
  id: number
  projectId: number | null
  name: string
  description: string | null
  source: SkillSource
  path: string | null
  url: string | null
  prompt: string | null
  createdAt: string | Date | null
  updatedAt: string | Date | null
}

export type Session = {
  id: number
  taskId: number | null
  agentName: string
  status: SessionStatus
  input: string | null
  output: string | null
  tokenUsage: number | null
  startedAt: string | Date | null
  completedAt: string | Date | null
}
