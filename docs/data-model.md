# Data Model

## ER Diagram

```
┌─────────────────┐       ┌─────────────────┐
│     Project     │       │      Agent      │
├─────────────────┤       ├─────────────────┤
│ id          PK  │       │ id          PK  │
│ name            │       │ name            │
│ description     │       │ description     │
│ created_at      │       │ model           │
│ updated_at      │       │ tools       []  │
└────────┬────────┘       │ skills      []  │
         │                │ config      {}  │
         │                │ created_at      │
         │                └────────┬────────┘
         │                         │
         │    ┌────────────────────┤
         │    │                    │
         ▼    ▼                    │
┌─────────────────┐                │
│      Task       │                │
├─────────────────┤                │
│ id          PK  │                │
│ project_id  FK  │                │
│ parent_id   FK  │──┐ (self-ref)  │
│ title           │  │             │
│ description     │  │             │
│ status          │◄─┘             │
│ priority        │                │
│ type            │                │
│ assignee_type   │                │
│ assignee_name   │────────────────┘
│ branch_name     │
│ pr_url          │
│ complexity      │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         │
         ▼
┌─────────────────┐       ┌─────────────────┐
│     Session     │       │      Skill      │
├─────────────────┤       ├─────────────────┤
│ id          PK  │       │ id          PK  │
│ task_id     FK  │       │ name            │
│ agent_name      │       │ source          │
│ status          │       │ path            │
│ input           │       │ url             │
│ output          │       │ content         │
│ token_usage     │       │ created_at      │
│ started_at      │       └─────────────────┘
│ completed_at    │
│ context_file    │
└─────────────────┘

┌─────────────────┐
│  MemoryEntry    │
├─────────────────┤
│ id          PK  │
│ session_id  FK  │
│ type            │
│ content         │
│ metadata    {}  │
│ created_at      │
└─────────────────┘
```

## Schema Definition (Drizzle)

### tasks

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),
  parentId: integer('parent_id').references(() => tasks.id),
  
  title: text('title').notNull(),
  description: text('description'),
  
  status: text('status', { 
    enum: ['open', 'in_progress', 'review', 'done', 'cancelled'] 
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
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

### agents

```typescript
export const agents = sqliteTable('agents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  name: text('name').notNull().unique(),
  description: text('description'),
  model: text('model').notNull(), // claude-opus, claude-sonnet, etc.
  
  tools: text('tools', { mode: 'json' }).$type<string[]>().default([]),
  skills: text('skills', { mode: 'json' }).$type<string[]>().default([]),
  config: text('config', { mode: 'json' }).$type<AgentConfig>().default({}),
  
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

interface AgentConfig {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}
```

### sessions

```typescript
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  taskId: integer('task_id').references(() => tasks.id),
  agentName: text('agent_name').notNull(),
  
  status: text('status', { 
    enum: ['running', 'completed', 'failed', 'cancelled'] 
  }).notNull().default('running'),
  
  input: text('input'),
  output: text('output'),
  
  tokenUsage: integer('token_usage'),
  
  contextFile: text('context_file'), // .agentmine/memory/session-{id}.md
  
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});
```

### skills

```typescript
export const skills = sqliteTable('skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  name: text('name').notNull().unique(),
  description: text('description'),
  
  source: text('source', { 
    enum: ['builtin', 'local', 'remote'] 
  }).notNull(),
  
  path: text('path'),     // local: .agentmine/skills/xxx.md
  url: text('url'),       // remote: https://...
  content: text('content'), // builtin: 埋め込みコンテンツ
  
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

### memory_entries

```typescript
export const memoryEntries = sqliteTable('memory_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  sessionId: integer('session_id').references(() => sessions.id),
  
  type: text('type', { 
    enum: ['decision', 'context', 'error', 'progress', 'handover'] 
  }).notNull(),
  
  content: text('content').notNull(),
  
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

## Status Transitions

### Task Status

```
                    ┌─────────────┐
                    │             │
                    ▼             │
┌──────┐      ┌───────────┐      │     ┌──────┐
│ open │─────▶│in_progress│──────┼────▶│ done │
└──────┘      └───────────┘      │     └──────┘
                    │            │
                    ▼            │
              ┌──────────┐       │
              │  review  │───────┘
              └──────────┘
                    │
                    │ (reject)
                    ▼
              ┌───────────┐
              │in_progress│
              └───────────┘

Any state → cancelled
```

### Session Status

```
┌─────────┐      ┌───────────┐
│ running │─────▶│ completed │
└─────────┘      └───────────┘
     │
     │ (error)
     ▼
┌─────────┐
│ failed  │
└─────────┘

running → cancelled (manual stop)
```

## Indexes

```sql
-- Task queries
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_type, assignee_name);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);

-- Session queries
CREATE INDEX idx_sessions_task ON sessions(task_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- Memory queries
CREATE INDEX idx_memory_session ON memory_entries(session_id);
CREATE INDEX idx_memory_type ON memory_entries(type);
```

## Configuration Schema (YAML)

### .agentmine/config.yaml

```yaml
# Project configuration
project:
  name: string          # required
  description: string   # optional

# Database configuration
database:
  url: string           # file:./data.db or postgres://...

# Agent definitions
agents:
  [name]:
    description: string
    model: string       # claude-opus | claude-sonnet | claude-haiku | ...
    tools: string[]     # Read, Write, Edit, Bash, Grep, Glob, WebSearch
    skills: string[]    # skill names
    config:
      temperature: number    # 0.0 - 1.0
      maxTokens: number
      systemPrompt: string

# Skill definitions
skills:
  [name]:
    source: builtin | local | remote
    path: string        # if local
    url: string         # if remote

# Git integration
git:
  branchPrefix: string  # default: "task-"
  autoPr: boolean       # default: true
  prTemplate: string    # PR body template

# Memory configuration
memory:
  autoSave: boolean     # default: true
  summarizeAfter: number # tokens before auto-summarize
```

## Migration Strategy

### Initial Migration

```typescript
// packages/core/src/db/migrations/0001_initial.ts
import { sql } from 'drizzle-orm';

export async function up(db: Database) {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      parent_id INTEGER REFERENCES tasks(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      type TEXT NOT NULL DEFAULT 'task',
      assignee_type TEXT,
      assignee_name TEXT,
      branch_name TEXT,
      pr_url TEXT,
      complexity INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  
  // ... other tables
}

export async function down(db: Database) {
  await db.run(sql`DROP TABLE IF EXISTS tasks`);
}
```

### Running Migrations

```bash
# マイグレーション生成
agentmine db migrate:generate

# マイグレーション実行
agentmine db migrate

# ロールバック
agentmine db migrate:rollback
```
