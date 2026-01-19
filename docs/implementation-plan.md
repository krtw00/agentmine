# Implementation Plan

## 概要

agentmineの実装順序と各フェーズの詳細計画。

```
Phase 0: @core (基盤)
    ↓
Phase 1: @cli (コマンド)
    ↓
Phase 2: @web (UI)
```

---

## Phase 0: @core

### 0.1 プロジェクトセットアップ

```bash
# packages/core/ の初期化
pnpm init
pnpm add drizzle-orm better-sqlite3 yaml zod
pnpm add -D drizzle-kit @types/better-sqlite3 typescript
```

**成果物:**
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/src/index.ts`

### 0.2 DB Schema (Drizzle)

**ファイル:** `packages/core/src/db/schema.ts`

| テーブル | 説明 |
|----------|------|
| `projects` | プロジェクト（将来用、当面は単一プロジェクト） |
| `tasks` | タスク管理 |
| `sessions` | エージェント実行セッション |

**成果物:**
- `src/db/schema.ts` - スキーマ定義
- `src/db/client.ts` - DB接続
- `src/db/migrate.ts` - マイグレーション実行

### 0.3 Services

| Service | 責務 |
|---------|------|
| `TaskService` | タスクCRUD、ステータス管理 |
| `SessionService` | セッション管理、開始/終了 |
| `AgentService` | YAML読み込み、定義提供 |
| `MemoryService` | Memory Bankファイル操作 |
| `ConfigService` | config.yaml 読み込み・検証 |

**各Serviceの主要メソッド:**

```typescript
// TaskService
interface TaskService {
  create(data: NewTask): Promise<Task>;
  findById(id: number): Promise<Task | null>;
  findAll(filters?: TaskFilters): Promise<Task[]>;
  update(id: number, data: Partial<Task>): Promise<Task>;
  delete(id: number): Promise<void>;
}

// SessionService
interface SessionService {
  start(taskId: number, agentName: string): Promise<Session>;
  end(sessionId: number, result: SessionResult): Promise<Session>;
  findByTask(taskId: number): Promise<Session | null>;
  findAll(filters?: SessionFilters): Promise<Session[]>;
  cleanup(sessionId: number): Promise<void>;
}

// AgentService
interface AgentService {
  findAll(): Promise<Agent[]>;
  findByName(name: string): Promise<Agent | null>;
  // Note: CRUD はファイル操作（YAMLの読み書き）
}

// MemoryService
interface MemoryService {
  list(category?: string): Promise<MemoryEntry[]>;
  add(entry: NewMemoryEntry): Promise<MemoryEntry>;
  edit(path: string, content: string): Promise<MemoryEntry>;
  remove(path: string): Promise<void>;
  preview(): Promise<string>; // AIに渡すフォーマット
}

// ConfigService
interface ConfigService {
  load(): Promise<Config>;
  validate(config: unknown): Config; // Zodでバリデーション
  getBaseBranch(): string;
  getDbUrl(): string;
}
```

### 0.4 Types & Validation

**ファイル:** `packages/core/src/types/`

```typescript
// types/task.ts
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'task' | 'feature' | 'bug' | 'refactor';
export type AssigneeType = 'ai' | 'human';

// types/session.ts
export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type DodResult = 'pending' | 'merged' | 'timeout' | 'error';

// types/config.ts (Zod schema)
export const configSchema = z.object({
  project: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
  database: z.object({
    url: z.string().default('file:.agentmine/data.db'),
  }),
  git: z.object({
    baseBranch: z.string(),
    branchPrefix: z.string().default('task-'),
    commitConvention: z.object({
      enabled: z.boolean().default(true),
      format: z.enum(['conventional', 'simple', 'custom']).default('conventional'),
    }).optional(),
  }),
  // ...
});
```

### @core ディレクトリ構造

```
packages/core/
├── src/
│   ├── index.ts              # Public API (re-exports)
│   ├── db/
│   │   ├── schema.ts         # Drizzle スキーマ
│   │   ├── client.ts         # DB接続
│   │   └── migrate.ts        # マイグレーション
│   ├── services/
│   │   ├── task-service.ts
│   │   ├── session-service.ts
│   │   ├── agent-service.ts
│   │   ├── memory-service.ts
│   │   └── config-service.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── task.ts
│   │   ├── session.ts
│   │   ├── agent.ts
│   │   └── config.ts
│   └── utils/
│       └── paths.ts          # .agentmine/ パス解決
├── package.json
└── tsconfig.json
```

---

## Phase 1: @cli

### 1.1 プロジェクトセットアップ

```bash
# packages/cli/ の初期化
pnpm init
pnpm add commander chalk @agentmine/core
pnpm add -D typescript @types/node
```

### 1.2 基本構造

```
packages/cli/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── commands/
│   │   ├── init.ts
│   │   ├── task.ts
│   │   ├── agent.ts
│   │   ├── session.ts
│   │   ├── worker.ts
│   │   ├── memory.ts
│   │   ├── db.ts
│   │   ├── mcp.ts
│   │   └── ui.ts
│   └── utils/
│       ├── output.ts         # フォーマット（table, color）
│       └── errors.ts         # エラーハンドリング
├── package.json
└── tsconfig.json
```

### 1.3 コマンド実装順序

| Step | コマンド | 依存 |
|------|----------|------|
| 1 | `init` | ConfigService |
| 2 | `task add` | TaskService |
| 3 | `task list` | TaskService |
| 4 | `task show` | TaskService |
| 5 | `task update` | TaskService |
| 6 | `task delete` | TaskService |
| 7 | `agent list` | AgentService |
| 8 | `agent show` | AgentService |
| 9 | `session start` | SessionService |
| 10 | `session end` | SessionService |
| 11 | `session list` | SessionService |
| 12 | `session show` | SessionService |
| 13 | `session cleanup` | SessionService |
| 14 | `memory list` | MemoryService |
| 15 | `memory add` | MemoryService |
| 16 | `memory edit` | MemoryService |
| 17 | `memory remove` | MemoryService |
| 18 | `memory preview` | MemoryService |
| 19 | `worker command` | TaskService, AgentService |
| 20 | `db migrate` | DB |
| 21 | `db reset` | DB |
| 22 | `mcp serve` | 全Service |
| 23 | `ui` | (Phase 2完了後) |

### 1.4 出力フォーマット

```typescript
// utils/output.ts
export interface OutputOptions {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

// 通常出力（人間向け）
export function printTask(task: Task, options: OutputOptions): void;
export function printTaskList(tasks: Task[], options: OutputOptions): void;

// JSON出力（AI向け）
export function printJson(data: unknown): void;

// エラー出力
export function printError(error: Error, options: OutputOptions): void;
```

---

## Phase 2: @web

> Phase 1完了後に実装。詳細は `docs/features/web-ui.md` を参照。

---

## 実装スケジュール

### Milestone 1: MVP (Core + Basic CLI)

| Task | 内容 |
|------|------|
| M1.1 | @core セットアップ + DB Schema |
| M1.2 | TaskService 実装 |
| M1.3 | CLI基本構造 + init |
| M1.4 | task add/list/show |
| M1.5 | テスト + 動作確認 |

**完了条件:**
- `agentmine init` でプロジェクト初期化
- `agentmine task add/list/show` が動作

### Milestone 2: Session & Agent

| Task | 内容 |
|------|------|
| M2.1 | SessionService 実装 |
| M2.2 | AgentService 実装 |
| M2.3 | session コマンド群 |
| M2.4 | agent コマンド群 |
| M2.5 | worker command |

**完了条件:**
- エージェント定義の読み込み
- セッションの開始/終了

### Milestone 3: Memory & MCP

| Task | 内容 |
|------|------|
| M3.1 | MemoryService 実装 |
| M3.2 | memory コマンド群 |
| M3.3 | MCPサーバー実装 |
| M3.4 | MCP Tools定義 |

**完了条件:**
- Memory Bankの操作
- MCPクライアントからの接続

### Milestone 4: Web UI

| Task | 内容 |
|------|------|
| M4.1 | Next.js セットアップ |
| M4.2 | Dashboard |
| M4.3 | Tasks |
| M4.4 | Sessions |
| M4.5 | Agents |
| M4.6 | Memory Bank |
| M4.7 | Settings |

**完了条件:**
- Web UIで全機能が使用可能

---

## 技術詳細

### Drizzle ORM セットアップ

```typescript
// packages/core/src/db/client.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;
```

### エラーハンドリング

```typescript
// packages/core/src/errors.ts
export class AgentmineError extends Error {
  constructor(
    message: string,
    public code: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentmineError';
  }
}

export class TaskNotFoundError extends AgentmineError {
  constructor(id: number) {
    super(`Task #${id} not found`, 5, { taskId: id });
  }
}

export class SessionAlreadyRunningError extends AgentmineError {
  constructor(taskId: number) {
    super(`Task #${taskId} already has a running session`, 6, { taskId });
  }
}
```

### テスト戦略

```
packages/core/
├── src/
└── tests/
    ├── services/
    │   ├── task-service.test.ts
    │   ├── session-service.test.ts
    │   └── ...
    └── fixtures/
        └── test-db.ts

packages/cli/
├── src/
└── tests/
    ├── commands/
    │   ├── task.test.ts
    │   └── ...
    └── helpers/
        └── cli-runner.ts
```

**Vitest設定:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```
