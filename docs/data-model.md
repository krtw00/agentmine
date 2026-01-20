# Data Model

## Database Strategy

| 環境 | DB | 用途 |
|------|-----|------|
| **チーム開発（メイン）** | **PostgreSQL** | 共有DB、Redmine的運用、リアルタイム協業 |
| ローカル開発（サブ） | SQLite | 個人利用、お試し、オフライン |

**DBがマスター。** すべてのデータはDBで管理し、ファイル出力は必要時に行う。

```
┌─────────────────────────────────────────────────────────────────┐
│  Redmine的運用                                                   │
│                                                                 │
│  チーム全員 ───→ 共有PostgreSQL ───→ 単一の真実源               │
│                                                                 │
│  Web UI ──┐                                                      │
│  CLI ─────┼──→ DB (マスター) ──→ Worker用ファイル出力           │
│  MCP ─────┘                                                      │
│                                                                 │
│  .agentmine/ は .gitignore（リポジトリには含めない）            │
└─────────────────────────────────────────────────────────────────┘
```

Drizzle ORMにより、両DBで共通のクエリAPIを使用。

## ER Diagram

```
┌─────────────────┐
│     Project     │
├─────────────────┤
│ id          PK  │
│ name            │
│ description     │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
    ┌────┴────────────────────────────────────────┐
    │                    │                        │
    ▼                    ▼                        ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│      Task       │  │     Agent       │  │     Memory      │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ id          PK  │  │ id          PK  │  │ id          PK  │
│ project_id  FK  │  │ project_id  FK  │  │ project_id  FK  │
│ parent_id   FK  │  │ name            │  │ category        │
│ title           │  │ description     │  │ title           │
│ description     │  │ client          │  │ content         │
│ status          │  │ model           │  │ version         │
│ priority        │  │ scope       {}  │  │ created_by      │
│ type            │  │ config      {}  │  │ created_at      │
│ assignee_type   │  │ prompt_content  │  │ updated_at      │
│ assignee_name   │  │ version         │  └────────┬────────┘
│ branch_name     │  │ created_by      │           │
│ pr_url          │  │ created_at      │           ▼
│ complexity      │  │ updated_at      │  ┌─────────────────┐
│ created_at      │  └────────┬────────┘  │ MemoryHistory   │
│ updated_at      │           │           ├─────────────────┤
└────────┬────────┘           ▼           │ id          PK  │
         │           ┌─────────────────┐  │ memory_id   FK  │
         ▼           │  AgentHistory   │  │ content         │
┌─────────────────┐  ├─────────────────┤  │ version         │
│     Session     │  │ id          PK  │  │ changed_by      │
├─────────────────┤  │ agent_id    FK  │  │ changed_at      │
│ id          PK  │  │ snapshot    {}  │  │ change_summary  │
│ task_id     FK  │  │ version         │  └─────────────────┘
│ agent_name      │  │ changed_by      │
│ status          │  │ changed_at      │
│ started_at      │  │ change_summary  │
│ completed_at    │  └─────────────────┘
│ duration_ms     │
│ exit_code       │           ┌─────────────────┐
│ dod_result      │           │   AuditLog      │
│ artifacts   []  │           ├─────────────────┤
│ error       {}  │           │ id          PK  │
└─────────────────┘           │ project_id  FK  │
                              │ user_id         │
┌─────────────────┐           │ action          │
│    Settings     │           │ entity_type     │
├─────────────────┤           │ entity_id       │
│ id          PK  │           │ changes     {}  │
│ project_id  FK  │           │ created_at      │
│ key             │           └─────────────────┘
│ value       {}  │
│ updated_by      │
│ updated_at      │
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
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

### agents（NEW: DBで管理）

```typescript
export const agents = sqliteTable('agents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),

  name: text('name').notNull(),
  description: text('description'),

  client: text('client', {
    enum: ['claude-code', 'codex', 'aider', 'gemini-cli', 'opencode']
  }).notNull(),
  model: text('model').notNull(),

  // スコープ設定（JSON）
  scope: text('scope', { mode: 'json' })
    .$type<{
      read: string[];
      write: string[];
      exclude: string[];
    }>()
    .notNull()
    .default({ read: ['**/*'], write: [], exclude: [] }),

  // 追加設定（JSON）
  config: text('config', { mode: 'json' })
    .$type<{
      temperature?: number;
      maxTokens?: number;
    }>()
    .default({}),

  // プロンプト内容（DB内で管理）
  promptContent: text('prompt_content'),

  // バージョン管理
  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ユニーク制約: プロジェクト内でエージェント名は一意
// CREATE UNIQUE INDEX idx_agents_name ON agents(project_id, name);
```

### agent_history（NEW: 変更履歴）

```typescript
export const agentHistory = sqliteTable('agent_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  agentId: integer('agent_id')
    .references(() => agents.id)
    .notNull(),

  // 変更前のスナップショット（全フィールド）
  snapshot: text('snapshot', { mode: 'json' })
    .$type<{
      name: string;
      description?: string;
      client: string;
      model: string;
      scope: object;
      config: object;
      promptContent?: string;
    }>()
    .notNull(),

  version: integer('version').notNull(),
  changedBy: text('changed_by'),
  changedAt: integer('changed_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  changeSummary: text('change_summary'), // 変更内容の要約
});
```

### memories（NEW: Memory BankをDB管理）

```typescript
export const memories = sqliteTable('memories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),

  category: text('category', {
    enum: ['architecture', 'tooling', 'convention', 'rule', 'decision']
  }).notNull(),

  title: text('title').notNull(),
  content: text('content').notNull(), // Markdown

  // バージョン管理
  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

### memory_history（NEW: Memory変更履歴）

```typescript
export const memoryHistory = sqliteTable('memory_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  memoryId: integer('memory_id')
    .references(() => memories.id)
    .notNull(),

  content: text('content').notNull(), // 変更前の内容
  version: integer('version').notNull(),
  changedBy: text('changed_by'),
  changedAt: integer('changed_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  changeSummary: text('change_summary'),
});
```

### settings（NEW: 設定をDB管理）

```typescript
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),

  key: text('key').notNull(), // e.g., 'git.baseBranch', 'execution.maxWorkers'
  value: text('value', { mode: 'json' }).notNull(),

  updatedBy: text('updated_by'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ユニーク制約: プロジェクト内で設定キーは一意
// CREATE UNIQUE INDEX idx_settings_key ON settings(project_id, key);
```

### audit_logs（NEW: 監査ログ）

```typescript
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),

  userId: text('user_id'), // 操作者（人間 or AI識別子）
  action: text('action', {
    enum: ['create', 'update', 'delete', 'start', 'stop', 'export']
  }).notNull(),

  entityType: text('entity_type', {
    enum: ['task', 'agent', 'memory', 'session', 'settings']
  }).notNull(),
  entityId: integer('entity_id'),

  changes: text('changes', { mode: 'json' })
    .$type<{
      before?: object;
      after?: object;
      summary?: string;
    }>(),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

### sessions

```typescript
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  taskId: integer('task_id')
    .references(() => tasks.id)
    .unique(),  // 1タスク1セッション制約
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
  signal: text('signal'),

  // DoD判定結果
  dodResult: text('dod_result', {
    enum: ['pending', 'merged', 'timeout', 'error']
  }).default('pending'),

  // 成果物
  artifacts: text('artifacts', { mode: 'json' })
    .$type<string[]>()
    .default([]),

  // エラー情報
  error: text('error', { mode: 'json' })
    .$type<SessionError | null>()
    .default(null),
});

interface SessionError {
  type: 'timeout' | 'crash' | 'signal' | 'unknown';
  message: string;
  details?: Record<string, any>;
}
```

## Worker用ファイル出力

Worker実行時、DBからworktreeへ必要なファイルを出力する。

```
Worker起動時:
1. DB から Agent定義を取得
2. worktree に一時ファイルとして出力
   └── .agentmine-worker/
       ├── agent.yaml      # このWorker用のAgent定義
       ├── prompt.md       # プロンプト
       └── memory/         # 関連Memory（スナップショット）
           ├── architecture/
           └── tooling/
3. Worker実行
4. 完了後、一時ファイルは削除（設定による）
```

```typescript
// Worker起動時のファイル出力
async function exportForWorker(taskId: number, worktreePath: string) {
  const task = await taskService.get(taskId);
  const agent = await agentService.getByName(task.assigneeName);
  const memories = await memoryService.getAll();

  const outputDir = path.join(worktreePath, '.agentmine-worker');
  await fs.mkdir(outputDir, { recursive: true });

  // Agent定義をYAML出力
  await fs.writeFile(
    path.join(outputDir, 'agent.yaml'),
    yaml.stringify(agent)
  );

  // プロンプト出力
  if (agent.promptContent) {
    await fs.writeFile(
      path.join(outputDir, 'prompt.md'),
      agent.promptContent
    );
  }

  // Memory出力
  for (const memory of memories) {
    const memoryPath = path.join(outputDir, 'memory', memory.category);
    await fs.mkdir(memoryPath, { recursive: true });
    await fs.writeFile(
      path.join(memoryPath, `${memory.title}.md`),
      memory.content
    );
  }
}
```

## Status Transitions

### Task Status

```
┌──────┐      ┌───────────┐      ┌──────┐
│ open │─────▶│in_progress│─────▶│ done │
└──────┘      └───────────┘      └──────┘
                    │
                    │ (Worker異常終了)
                    ▼
              ┌──────────┐
              │  failed  │
              └──────────┘

Any state → cancelled
failed → open (再試行時)
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

-- Agent queries
CREATE UNIQUE INDEX idx_agents_name ON agents(project_id, name);

-- Memory queries
CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_project ON memories(project_id);

-- Settings queries
CREATE UNIQUE INDEX idx_settings_key ON settings(project_id, key);

-- Audit log queries
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

## PostgreSQL拡張: pgvector（将来）

本番環境（PostgreSQL）では、pgvectorを使用したベクトル検索が利用可能。

### memories（PostgreSQL版 + ベクトル）

```typescript
import { pgTable, serial, text, integer, timestamp, vector } from 'drizzle-orm/pg-core';

export const memories = pgTable('memories', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),

  category: text('category').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),

  // ベクトル埋め込み（セマンティック検索用）
  embedding: vector('embedding', { dimensions: 1536 }),

  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at'),
});
```

### セマンティック検索（将来）

```typescript
// 関連するMemoryを検索
const similarMemories = await db.execute(sql`
  SELECT id, title, content,
         1 - (embedding <=> ${queryEmbedding}) as similarity
  FROM memories
  WHERE project_id = ${projectId}
  ORDER BY embedding <=> ${queryEmbedding}
  LIMIT 5
`);
```

## Migration Strategy

### 初期マイグレーション

```bash
# マイグレーション生成
agentmine db migrate:generate

# マイグレーション実行
agentmine db migrate

# ロールバック
agentmine db migrate:rollback
```

### 既存YAMLからのインポート（移行用）

```bash
# 既存の.agentmine/からDBへインポート
agentmine db import --from .agentmine/

# 個別インポート
agentmine agent import --file .agentmine/agents/coder.yaml
agentmine memory import --dir .agentmine/memory/
```

## エクスポート機能

DBからファイルへのエクスポート（バックアップ、共有用）。

```bash
# 全データエクスポート
agentmine export --output ./backup/

# 個別エクスポート
agentmine agent export coder --output ./coder.yaml
agentmine memory export --output ./memory/
```

```
./backup/
├── agents/
│   ├── coder.yaml
│   └── reviewer.yaml
├── memory/
│   ├── architecture/
│   │   └── 001-monorepo.md
│   └── tooling/
│       └── 001-vitest.md
└── settings.yaml
```
