# Data Model

## Database Strategy

| 環境 | DB | 用途 |
|------|-----|------|
| ローカル開発 | **SQLite** | ゼロ設定、ポータブル |
| 本番環境 | **PostgreSQL** | AI機能（pgvector）、スケーラビリティ |

Drizzle ORMにより、両DBで共通のクエリAPIを使用。スキーマ定義は若干異なるが、アプリケーションコードは共通化可能。

**参考:** [ADR-002: Database Strategy](./adr/002-sqlite-default.md)

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
         ▼
┌─────────────────┐
│      Task       │
├─────────────────┤
│ id          PK  │
│ project_id  FK  │
│ parent_id   FK  │──┐ (self-ref)
│ title           │  │
│ description     │  │
│ status          │◄─┘
│ priority        │
│ type            │
│ assignee_type   │
│ assignee_name   │
│ branch_name     │
│ pr_url          │
│ complexity      │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌───────────────────┐
│     Session     │       │ ProjectDecision   │
├─────────────────┤       ├───────────────────┤
│ id          PK  │       │ id            PK  │
│ task_id     FK  │       │ category          │
│ agent_name      │       │ title             │
│ status          │       │ decision          │
│ started_at      │       │ reason            │
│ completed_at    │       │ related_task_id FK│
│ duration_ms     │       │ created_at        │
│ artifacts   []  │       │ updated_at        │
│ error       {}  │       └───────────────────┘
└─────────────────┘

※ Agent定義はDBではなくYAMLファイルで管理
  (.agentmine/agents/*.yaml)
```

**Note:**
- スキル管理は agentmine の範囲外（各AIツールに委ねる）
- ツール制限も agentmine では制御不可（AIクライアント側の責務）

## Schema Definition (Drizzle)

### tasks

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),
  parentId: integer('parent_id').references(() => tasks.id),
  // Note: 循環依存はアプリケーション層で防止（DB制約では不可）

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

### agents

**Note:** エージェント定義はYAMLファイル（`.agentmine/agents/*.yaml`）で管理。DBには保存しない。

詳細は [Agent System](./features/agent-system.md) を参照。

```typescript
// YAMLから読み込まれる型定義
interface Agent {
  name: string;
  description: string;
  client: string;          // claude-code, opencode, codex等
  model: string;           // opus, sonnet, gpt-5等
  scope: {
    read: string[];        // 参照可能（globパターン）
    write: string[];       // 編集可能（globパターン）
    exclude: string[];     // アクセス不可（globパターン）
  };
  config: {
    temperature?: number;
    maxTokens?: number;
    promptFile?: string;   // プロンプトファイルパス
  };
}
```

**Note:**
- `tools` フィールドは削除。ツール制限はAIクライアント側の責務。
- `skills` フィールドも削除。スキル管理は agentmine の範囲外。

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
  exitCode: integer('exit_code'),     // プロセス終了コード
  signal: text('signal'),              // 終了シグナル（SIGTERM等）

  // DoD判定結果
  dodResult: text('dod_result', {
    enum: ['pending', 'merged', 'timeout', 'error']
  }).default('pending'),

  // 成果物（変更されたファイルパス、worktreeルートからの相対パス）
  artifacts: text('artifacts', { mode: 'json' })
    .$type<string[]>()
    .default([]),

  // エラー情報（失敗時）
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

**Note:**
- `tokenUsage` は測定不可のため削除。Orchestrator が観測可能な範囲のみ記録。
- `taskId` にUNIQUE制約を追加。1タスク1セッションをDB層で保証。

### Session 再実行フロー

1タスク1セッション制約のため、タスクを再実行するにはセッションを削除する必要がある。

```
タスク#1 (failed)
    ↓
1. agentmine session cleanup 123  # セッション削除
    ↓
2. agentmine session start 1 --agent coder  # 新セッション作成
    ↓
3. Worker起動（Orchestrator）
```

**複数クライアント競合時:**
- DB制約（UNIQUE）によりエラー
- リトライはOrchestratorの責務
- agentmineは調停しない（Blackboard設計）

### Memory Bank

**ファイルベースのみ**（DBテーブルなし）

```
.agentmine/memory/
├── architecture/
│   └── 001-monorepo.md
├── tooling/
│   └── 001-vitest.md
└── convention/
    └── 001-commit-format.md
```

**理由:**
- Markdownで人間も読める
- Gitで履歴管理可能
- DBとの同期複雑性を回避

詳細は [Memory Bank](./features/memory-bank.md) を参照。

**Note:** `skills` テーブルは削除。スキル管理は agentmine の範囲外。

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

### ステータス判定ロジック

```
Orchestratorもworkerも「完了」を報告する権限を持たない。
ステータスは以下の観測可能な事実に基づいて判定する：

【done判定】
  ブランチがbaseBranchにマージされた
  → git log --oneline baseBranch..task-branch が空

【failed判定】
  Worker プロセスが異常終了した
  → exit code != 0
  → シグナル受信（SIGTERM, SIGKILL等）
  → タイムアウト（設定時間超過）

【in_progress判定】
  Worker起動後、done/failedどちらでもない状態
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

## 制約・検証

### タスク循環依存の防止

親子関係による循環依存（A→B→A）はアプリケーション層で防止する。

```typescript
// packages/core/src/services/task-service.ts
async function setParent(taskId: number, parentId: number): Promise<void> {
  // 循環チェック
  if (await wouldCreateCycle(taskId, parentId)) {
    throw new Error('Circular dependency detected');
  }
  // ...
}

async function wouldCreateCycle(taskId: number, parentId: number): Promise<boolean> {
  let current = parentId;
  const visited = new Set<number>();

  while (current !== null) {
    if (current === taskId || visited.has(current)) {
      return true;
    }
    visited.add(current);
    const parent = await db.query.tasks.findFirst({
      where: eq(tasks.id, current),
      columns: { parentId: true }
    });
    current = parent?.parentId ?? null;
  }
  return false;
}
```

### 同時更新の扱い

SQLiteの制約上、同時書き込みは直列化される（WALモード使用時）。
`updatedAt`フィールドは記録用であり、楽観的ロックには使用しない。

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

-- Project decisions queries
CREATE INDEX idx_decisions_category ON project_decisions(category);
```

## Configuration Schema (YAML)

### ファイル構造

```
.agentmine/
├── config.yaml           # 基本設定
├── agents/               # エージェント定義（1ファイル1エージェント）
│   ├── coder.yaml
│   ├── reviewer.yaml
│   └── ...
└── prompts/              # 詳細指示（Markdown）
    ├── coder.md
    ├── reviewer.md
    └── ...
```

### config.yaml

```yaml
# Project configuration
project:
  name: string          # optional（1プロジェクト=1agentmine）
  description: string   # optional

# Database configuration
database:
  url: string           # file:./data.db or postgres://...

# Git integration
git:
  baseBranch: string    # required（マージ先ブランチ）
  branchPrefix: string  # default: "task-"
  commitConvention:
    enabled: boolean    # default: true
    format: string      # conventional | simple | custom

# Execution settings
execution:
  parallel:
    enabled: boolean
    maxWorkers: number
    worktree:
      path: string      # default: ".worktrees/"
      cleanup: boolean  # default: true

# Session log retention
sessionLog:
  retention:
    enabled: boolean    # default: false
    days: number        # 保持日数
```

### agents/*.yaml

```yaml
# .agentmine/agents/coder.yaml
name: string              # required, unique
description: string
client: string            # claude-code | opencode | codex | ...
model: string             # opus | sonnet | haiku | gpt-5 | ...
scope:
  read: string[]          # 参照可能（globパターン）
  write: string[]         # 編集可能（globパターン）
  exclude: string[]       # アクセス不可（globパターン）
config:
  temperature: number     # 0.0 - 1.0
  maxTokens: number
  promptFile: string      # プロンプトファイルパス（相対パス）
```

詳細は [Agent System](./features/agent-system.md) を参照。

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

## PostgreSQL拡張: pgvector（将来）

本番環境（PostgreSQL）では、pgvectorを使用したベクトル検索が利用可能。

### project_decisions（PostgreSQL版）

```typescript
import { pgTable, serial, text, integer, timestamp, vector } from 'drizzle-orm/pg-core';

export const projectDecisions = pgTable('project_decisions', {
  id: serial('id').primaryKey(),

  category: text('category', {
    enum: ['architecture', 'tooling', 'convention', 'rule']
  }).notNull(),

  title: text('title').notNull(),
  decision: text('decision').notNull(),
  reason: text('reason'),

  relatedTaskId: integer('related_task_id').references(() => tasks.id),

  // ベクトル埋め込み（将来追加）
  embedding: vector('embedding', { dimensions: 1536 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at'),
});
```

### ベクトル検索インデックス

```sql
-- pgvector拡張を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSWインデックス（高速な近似最近傍検索）
CREATE INDEX ON project_decisions
USING hnsw (embedding vector_cosine_ops);
```

### セマンティック検索クエリ（将来）

```typescript
import { sql } from 'drizzle-orm';

// 類似する決定事項を検索
const similarDecisions = await db.execute(sql`
  SELECT id, title, decision, reason,
         1 - (embedding <=> ${queryEmbedding}) as similarity
  FROM project_decisions
  ORDER BY embedding <=> ${queryEmbedding}
  LIMIT 5
`);
```

### ユースケース（将来）

| 機能 | 説明 |
|------|------|
| 決定事項のセマンティック検索 | 関連する過去の決定を検索 |
| タスク類似検索 | 「似たタスクを探す」 |
| 重複検出 | 同様の決定を検出 |
