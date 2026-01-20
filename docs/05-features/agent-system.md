# Agent System

役割別エージェント定義・実行システム。

## 概要

プロジェクトで使用するAIエージェント（Worker）を定義し、タスクに応じて適切なエージェントを選択・実行。

**エージェント定義はDBで管理。** Web UI/CLI/MCPから編集可能で、チーム間でリアルタイム共有。

## Orchestrator/Worker モデル

```
Human (ユーザー)
  │
  ├─→ Web UI (直接操作)
  │
  └─→ Orchestrator AI (Claude Code等)
        │
        └─→ agentmine (データ層)
              │
              └─→ Worker (サブエージェント)
                    │
                    └─→ 隔離されたworktree
```

- **Orchestrator**: ユーザーと会話し、タスクを割り振るAI（例: Claude Code本体）
- **Worker**: 実際にタスクを実行するAI（例: Taskサブエージェント）
- **Agent定義**: Workerの能力・制約を定義したもの（**DBに保存**）

## 設計目標

1. **役割分離**: 設計者・実装者・レビュアー等の役割を明確化
2. **設定可能**: クライアント・モデル・スコープを柔軟に設定
3. **リアルタイム共有**: チーム全員が同じエージェント定義を参照
4. **バージョン管理**: 変更履歴をDB内で追跡

## データ管理（DBマスター）

```
┌─────────────────────────────────────────────────────────────────┐
│  DBマスター設計                                                  │
│                                                                 │
│  Web UI ──┐                                                      │
│  CLI ─────┼──→ DB (マスター)                                     │
│  MCP ─────┘       │                                              │
│                   ├── agents テーブル（定義）                    │
│                   ├── agent_history テーブル（変更履歴）         │
│                   └── prompt_content フィールド（プロンプト）    │
│                                                                 │
│  Worker起動時 → worktree に一時ファイル出力                      │
└─────────────────────────────────────────────────────────────────┘
```

### agentsテーブル

```typescript
export const agents = sqliteTable('agents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),

  name: text('name').notNull(),           // ユニーク（プロジェクト内）
  description: text('description'),

  client: text('client').notNull(),       // claude-code, codex, etc.
  model: text('model').notNull(),         // opus, sonnet, gpt-5, etc.

  scope: text('scope', { mode: 'json' })  // { read, write, exclude }
    .notNull()
    .default({ read: ['**/*'], write: [], exclude: [] }),

  config: text('config', { mode: 'json' }) // { temperature, maxTokens }
    .default({}),

  promptContent: text('prompt_content'),  // プロンプト内容（Markdown）

  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
```

## エージェント定義

### 基本構造

Web UIまたはCLIで編集（DB保存）:

```yaml
# 論理的な構造（DB内のJSONフィールド）
name: coder
description: "コード実装担当"
client: claude-code              # AIクライアント
model: sonnet                    # AIモデル
scope:                           # アクセス範囲（物理的に強制）
  read:                          # 参照可能（全ファイル存在）
    - "**/*"
  write:                         # 編集可能（それ以外は書き込み禁止）
    - "src/**"
    - "tests/**"
  exclude:                       # 読み取りも禁止（物理的に削除）
    - "**/*.env"
    - "**/secrets/**"
config:
  temperature: 0.3
  maxTokens: 8192
promptContent: |
  # コード実装担当

  ## あなたの役割
  あなたはコード実装を担当するWorkerです。
  ...
```

### YAMLによる作成/編集

人間とAIが扱いやすいよう、**YAMLを作成・編集フォーマット**として提供する。
ただし、YAMLは**DBへ取り込まれる入力形式**であり、**単一の真実源はDB**。

- Web UIのYAML編集モードはDBに保存される
- CLIの`agent import`/`agent export`でYAMLスナップショットを入出力できる
- `promptContent`はYAML内に直接記述可能
- 互換性のため`promptFile`を指定した場合は、インポート時に内容を読み込み`promptContent`へ格納

### 組み込みエージェント（初期データ）

`agentmine init` 実行時にDBに以下の初期エージェントを作成:

#### planner

```yaml
name: planner
description: "設計・計画・見積もり担当"
client: claude-code
model: opus
scope:
  read: ["**/*"]
  write: []                      # 読み取り専用（ファイル変更なし）
  exclude: ["**/*.env", "**/secrets/**"]
config:
  temperature: 0.7
```

#### coder

```yaml
name: coder
description: "コード実装担当"
client: claude-code
model: sonnet
scope:
  read: ["**/*"]                 # 全ファイル参照可能
  write:                         # 編集はこれらのみ
    - "src/**"
    - "tests/**"
    - "package.json"
    - "tsconfig.json"
  exclude:
    - "**/*.env"
    - "**/secrets/**"
config:
  temperature: 0.3
  maxTokens: 8192
```

#### reviewer

```yaml
name: reviewer
description: "コードレビュー担当（読み取り専用）"
client: claude-code
model: haiku
scope:
  read: ["**/*"]
  write: []                      # 読み取り専用
  exclude: ["**/*.env"]
config:
  temperature: 0.5
```

#### writer

```yaml
name: writer
description: "ドキュメント作成担当"
client: claude-code
model: sonnet
scope:
  read: ["**/*"]
  write:                         # ドキュメントのみ編集可能
    - "docs/**"
    - "README.md"
    - "*.md"
  exclude: ["**/*.env"]
config:
  temperature: 0.6
```

## プロンプト管理

### promptContent フィールド

プロンプトはエージェント定義の `promptContent` フィールドにMarkdownで保存。

```markdown
# コード実装担当

## あなたの役割
あなたはコード実装を担当するWorkerです。
Orchestratorから割り当てられたタスクを実装してください。

## 作業フロー
1. タスク詳細を確認
2. 既存コードを理解してから変更
3. 小さな変更を積み重ねる
4. テストを書く/実行する
5. 完了報告

## コーディング規約
- TypeScript strict mode を使用
- ESLint/Prettier の設定に従う
- 関数は単一責任の原則に従う
- エラーハンドリングを適切に行う

## 禁止事項
- スコープ外のファイルを変更しない
- 環境変数ファイル（.env）を変更しない
- 破壊的な変更を行う前にOrchestratorに確認する
```

### Worker起動時の展開

Worker起動時、DBのMemory Bankをworktreeへスナップショット出力する。
エージェント定義とプロンプトは `worker run` が生成し、AIに直接渡す（ファイル出力しない）。

```
.agentmine/memory/
├── architecture/
├── tooling/
├── convention/
└── rule/
```

## スコープ制御

### 概要

`scope` はWorkerのファイルアクセス範囲を**物理的に**制限する。

| フィールド | 説明 | 物理的な実装 |
|-----------|------|-------------|
| `read` | 参照可能なファイル | worktreeに存在 |
| `write` | 編集可能なファイル | 書き込み権限あり |
| `exclude` | アクセス不可 | worktreeから削除 |

### 物理的な強制方法

スコープ優先順位: `exclude → read → write`

```bash
# Worker起動時にagentmineが実行
cd .agentmine/worktrees/task-5

# 1. exclude対象をsparse-checkoutで物理的に除外
git sparse-checkout set --no-cone '/*' '!**/*.env' '!**/secrets/**'

# 2. write対象外のファイルを読み取り専用に（chmod a-w）
find . -type f \
  ! -path './src/*' \
  ! -path './tests/*' \
  -exec chmod a-w {} \;
```

詳細は [Worktree & Scope Control](./worktree-scope.md) を参照。

### パターン構文

```yaml
scope:
  read:
    - "**/*"             # 全ファイル参照可能
  write:
    - "src/**"           # srcディレクトリ以下は編集可能
    - "tests/**/*.ts"    # testsのTypeScriptファイルは編集可能
    - "package.json"     # 特定ファイル
  exclude:
    - "**/*.env"         # 全ての.envファイル（存在しない）
    - "**/secrets/**"    # secretsディレクトリ（存在しない）
```

## API

### AgentService

```typescript
// packages/core/src/services/agent-service.ts

export class AgentService {
  constructor(private db: Database) {}

  // エージェント一覧
  async list(): Promise<Agent[]>;

  // エージェント取得
  async getByName(name: string): Promise<Agent>;
  async getById(id: number): Promise<Agent>;

  // エージェント作成
  async create(input: NewAgent): Promise<Agent>;

  // エージェント更新（履歴作成）
  async update(id: number, input: UpdateAgent, changedBy?: string): Promise<Agent>;

  // エージェント削除
  async delete(id: number): Promise<void>;

  // Worker用ファイル出力
  async exportForWorker(agentId: number, outputDir: string): Promise<void>;

  // 履歴取得
  async getHistory(agentId: number): Promise<AgentHistory[]>;

  // 過去バージョンに戻す
  async rollback(agentId: number, version: number): Promise<Agent>;
}
```

### Agent型

```typescript
interface Agent {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  client: ClientType;
  model: string;
  scope: AgentScope;
  config: AgentConfig;
  promptContent?: string;
  version: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentScope {
  read: string[];
  write: string[];
  exclude: string[];
}

interface AgentConfig {
  temperature?: number;
  maxTokens?: number;
}

type ClientType =
  | 'claude-code'
  | 'opencode'
  | 'codex'
  | 'gemini-cli'
  | 'aider'
  | string;

interface AgentHistory {
  id: number;
  agentId: number;
  snapshot: Agent;  // 変更前のスナップショット
  version: number;
  changedBy?: string;
  changedAt: Date;
  changeSummary?: string;
}
```

## 実行フロー

```
┌──────────────────────────────────────────────────────────────┐
│                    Worker Execution Flow                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. タスク作成・Agent割り当て                                 │
│     Web UI or CLI → DB (tasks.assigneeName = "coder")        │
│                                                              │
│  2. Worker起動                                                │
│     agentmine worker run <taskId> --exec                     │
│       ├── worktree作成                                       │
│       ├── DBからAgent定義取得                                 │
│       ├── Memory Bankを `.agentmine/memory/` にスナップショット│
│       ├── スコープ適用（sparse-checkout + chmod）             │
│       ├── プロンプト生成（Agent定義 + Memory Bank）           │
│       └── AIクライアント起動                                  │
│                                                              │
│  3. Worker作業                                                │
│     - 隔離されたworktreeで作業                                │
│     - `.agentmine/memory/` を参照                            │
│     - スコープ内でのみファイル編集可能                        │
│                                                              │
│  4. 完了                                                      │
│     - Worker終了                                              │
│     - worktreeクリーンアップ（設定による）                    │
│     - セッション記録更新                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## CLI

```bash
# エージェント一覧
agentmine agent list

# エージェント詳細
agentmine agent show coder

# エージェント作成
agentmine agent create --name security-auditor --client claude-code --model opus

# エージェント更新
agentmine agent update coder --model opus --temperature 0.5

# プロンプト編集（エディタ起動）
agentmine agent edit coder --prompt

# エージェント削除
agentmine agent delete security-auditor

# 履歴表示
agentmine agent history coder

# 過去バージョンに戻す
agentmine agent rollback coder --version 3

# エクスポート（バックアップ用）
agentmine agent export coder --output ./coder.yaml

# インポート（移行用）
agentmine agent import --file ./coder.yaml
```

## Web UI

### エージェント一覧

```
┌─ Agents ──────────────────────────────────────────────────────┐
│ [+ New Agent]                                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌─ coder ─────────────────────────────────────────────────┐   │
│ │ コード実装担当                                           │   │
│ │                                                         │   │
│ │ Client: claude-code    Model: sonnet    Version: 3      │   │
│ │ Write: src/**, tests/**                                 │   │
│ │                                                         │   │
│ │ [Edit] [History] [Duplicate] [Delete]                   │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                │
│ ┌─ reviewer ──────────────────────────────────────────────┐   │
│ │ コードレビュー担当（読み取り専用）                       │   │
│ │ ...                                                     │   │
│ └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### エージェント編集

UI編集モードとYAML編集モードの両方をサポート（docs/features/web-ui.md参照）。

## カスタムエージェント

### セキュリティ監査担当

```yaml
name: security-auditor
description: "セキュリティ監査担当（読み取り専用）"
client: claude-code
model: opus
scope:
  read: ["**/*"]
  write: []
  exclude: []
config:
  temperature: 0.2
promptContent: |
  # セキュリティ監査担当

  ## あなたの役割
  セキュリティ脆弱性の検出を担当します。

  ## 監査観点
  - OWASP Top 10
  - 認証・認可の実装
  - 入力検証
  - 機密情報の取り扱い
```

### フロントエンド専門

```yaml
name: frontend-coder
description: "フロントエンド実装担当"
client: claude-code
model: sonnet
scope:
  read: ["**/*"]
  write:
    - "src/components/**"
    - "src/pages/**"
    - "src/styles/**"
    - "src/hooks/**"
  exclude:
    - "**/*.env"
    - "**/secrets/**"
config:
  temperature: 0.3
```

### 別クライアント使用例

```yaml
name: fast-coder
description: "高速実装担当"
client: codex
model: gpt-4.1
scope:
  read: ["**/*"]
  write: ["src/**", "tests/**"]
  exclude: ["**/*.env"]
config:
  temperature: 0.2
```
