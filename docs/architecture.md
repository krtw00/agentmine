# Architecture

## Design Philosophy

**agentmineは並列AI開発の実行環境**。Redmine的運用でチーム協業をサポート。

```
┌─────────────────────────────────────────────────────────────────┐
│  Redmine的運用                                                   │
│                                                                 │
│  チーム全員 ───→ 共有PostgreSQL ───→ 単一の真実源               │
│                                                                 │
│  Human A ──┐                                                     │
│  Human B ──┼──→ Web UI ──┐                                       │
│  Orchestrator ──→ CLI ──┼──→ DB (マスター) ──→ Worker           │
│                         └──→ MCP ─────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

- **人間**: Web UIで完結（タスク管理、Agent定義、Worker監視）
- **Orchestrator**: CLI/MCPで自動化（Claude Code等）
- **Worker**: 隔離されたworktreeでコードを書くAI
- **agentmine**: すべてのデータをDB管理（Redmine的な単一真実源）

### 重要な設計原則

1. **Single Source of Truth (DBマスター)**: すべてのデータ（タスク、Agent、Memory、設定）はDBで管理
2. **Collaborative by Design (Redmine的運用)**: チーム全員が同じDBを参照、リアルタイム協業
3. **AI as Orchestrator**: 計画・判断はAI、agentmineは実行基盤・記録・提供のみ担当
4. **Isolation & Safety**: Worker隔離（worktree） + スコープ制御（sparse-checkout + chmod）
5. **Observable & Deterministic**: ステータスはexit code, merge状態等の客観事実で判定
6. **Fail Fast**: エラーは即座に失敗させ、リカバリーは上位層（Orchestrator）の責務

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              agentmine                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │   CLI       │  │  Web UI     │  │ MCP Server  │                     │
│  │             │  │  (Next.js)  │  │             │                     │
│  │  @cli       │  │  @web       │  │  @cli/mcp   │                     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                     │
│         │                │                │                             │
│         └────────────────┴────────────────┘                             │
│                                   │                                      │
│                                   ▼                                      │
│                    ┌──────────────────────────────┐                     │
│                    │           @core              │                     │
│                    │                              │                     │
│                    │  ┌────────┐  ┌────────────┐ │                     │
│                    │  │Services│  │   Models   │ │                     │
│                    │  └────────┘  └────────────┘ │                     │
│                    │  ┌────────┐  ┌────────────┐ │                     │
│                    │  │   DB   │  │   Config   │ │                     │
│                    │  │Drizzle │  │   Parser   │ │                     │
│                    │  └────────┘  └────────────┘ │                     │
│                    └──────────────┬──────────────┘                     │
│                                   │                                      │
│                                   ▼                                      │
│                    ┌──────────────────────────────┐                     │
│                    │     SQLite / PostgreSQL      │                     │
│                    └──────────────────────────────┘                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        File System                               │   │
│  │  .agentmine/                                                     │   │
│  │  ├── config.yaml      # 設定スナップショット（DBインポート用）    │   │
│  │  ├── data.db          # SQLiteデータベース                        │   │
│  │  ├── agents/          # エージェント定義スナップショット（YAML）  │   │
│  │  ├── prompts/         # プロンプトスナップショット（任意）        │   │
│  │  ├── memory/          # Memory Bankスナップショット              │   │
│  │  └── worktrees/       # Worker用隔離作業領域                     │   │
│  │       └── task-<id>/  # タスク毎のgit worktree                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Worker Execution Flow

Orchestratorは`agentmine worker`コマンドでWorkerを起動・管理する。

```bash
# 単一Worker起動（フォアグラウンド）
agentmine worker run <taskId> --exec

# 並列実行（バックグラウンド）
agentmine worker run 1 --exec --detach
agentmine worker run 2 --exec --detach
agentmine worker wait 1 2    # 完了待機

# Worker管理
agentmine worker status      # 状態確認
agentmine worker stop 1      # 停止
agentmine worker done 1      # セッション終了・クリーンアップ
```

**worker runの動作:**
1. タスク情報取得
2. セッション開始（DBに記録、ID確定）
3. ブランチ作成（`task-<id>-s<sessionId>`）
4. Git worktree作成（`.agentmine/worktrees/task-<id>/`）
5. スコープ適用
   - `exclude`: sparse-checkoutで物理的に除外
   - `write`: 対象外ファイルをchmodで読み取り専用に
6. Worker AI起動
   - `--exec`: フォアグラウンドで起動、完了を待機
   - `--exec --detach`: バックグラウンドで起動、PIDを記録して即座に戻る

**対応AIクライアント:**
- claude-code: `--dangerously-skip-permissions`
- codex: `--full-auto`
- aider: `--yes`
- gemini: `-y`

## Package Structure

```
agentmine/
├── packages/
│   ├── cli/                    # CLIアプリケーション
│   │   ├── src/
│   │   │   ├── index.ts        # エントリーポイント
│   │   │   ├── commands/       # コマンド定義
│   │   │   │   ├── init.ts
│   │   │   │   ├── task.ts
│   │   │   │   ├── agent.ts
│   │   │   │   ├── memory.ts
│   │   │   │   └── ui.ts
│   │   │   ├── mcp/            # MCPサーバー
│   │   │   │   ├── server.ts
│   │   │   │   ├── tools.ts
│   │   │   │   └── resources.ts
│   │   │   └── utils/          # ユーティリティ
│   │   │       └── output.ts   # 出力フォーマット
│   │   └── package.json
│   │
│   ├── web/                    # Web UI
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx    # Dashboard
│   │   │   │   ├── tasks/      # タスク管理
│   │   │   │   ├── agents/     # エージェント定義閲覧
│   │   │   │   └── api/        # API Routes
│   │   │   └── components/     # UIコンポーネント
│   │   │       ├── kanban/
│   │   │       ├── task-card/
│   │   │       └── sidebar/
│   │   └── package.json
│   │
│   └── core/                   # 共有ロジック
│       ├── src/
│       │   ├── index.ts        # Public API
│       │   ├── db/             # データベース
│       │   │   ├── schema.ts   # Drizzle スキーマ
│       │   │   ├── client.ts   # DB接続
│       │   │   └── migrate.ts  # マイグレーション
│       │   ├── models/         # ドメインモデル
│       │   │   ├── task.ts
│       │   │   └── session.ts
│       │   ├── services/       # ビジネスロジック
│       │   │   ├── task-service.ts
│       │   │   ├── agent-service.ts   # YAML読み込み、定義提供
│       │   │   └── memory-service.ts
│       │   ├── config/         # 設定管理
│       │   │   ├── parser.ts   # YAML解析
│       │   │   └── schema.ts   # 設定スキーマ
│       │   └── types/          # 型定義
│       │       └── index.ts
│       └── package.json
│
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

**Note:** `executor/` は削除。Worker起動・実行はOrchestrator（AIクライアント）の責務。

## Data Flow

### 1. CLI → Core → DB

```
User Input
    │
    ▼
┌─────────────────┐
│  CLI Command    │  agentmine task add "..."
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  TaskService    │  @core/services/task-service.ts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Drizzle ORM    │  @core/db/client.ts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SQLite/PG      │  .agentmine/data.db
└─────────────────┘
```

### 2. Web UI → API → Core → DB

```
Browser
    │
    ▼
┌─────────────────┐
│  Next.js Page   │  /tasks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Route      │  /api/tasks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  TaskService    │  @core (shared)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Database       │
└─────────────────┘
```

### 3. MCP Client → MCP Server → Core

```
Cursor/Windsurf
    │
    ▼
┌─────────────────┐
│  MCP Protocol   │  JSON-RPC over stdio
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MCP Server     │  agentmine mcp serve
│  (Tools/Res)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Core Services  │
└─────────────────┘
```

## Key Design Decisions

### 1. Monorepo with pnpm + Turborepo

**理由:**
- CLI/Web/Coreで型定義を共有
- 一貫したビルド・テスト環境
- Turborepoのキャッシュで高速ビルド

### 2. PostgreSQL メイン + SQLite サブ（Redmine的運用）

**戦略:**

| 環境 | DB | 用途 |
|------|-----|------|
| **チーム開発（メイン）** | **PostgreSQL** | 共有DB、Redmine的運用、リアルタイム協業 |
| ローカル開発（サブ） | SQLite | 個人利用、お試し、オフライン |

**DBがマスター:**
- すべてのデータ（タスク、Agent定義、Memory Bank、設定）はDBで管理
- ファイル出力は必要時に行う（Worker起動時、エクスポート時）
- `.agentmine/`は`.gitignore`（リポジトリには含めない）

**PostgreSQLメインの理由:**
- 複数人でのリアルタイム協業（Redmine的運用）
- トランザクション・排他制御
- pgvectorによるベクトル検索（将来）
- 変更履歴・監査ログの一元管理

**SQLiteの位置づけ:**
- 個人開発・お試し用
- オフライン環境
- `agentmine init`で即使用可能（PostgreSQL設定なしでも動作）

### 3. DB-based Memory Bank & Agent定義

**理由:**
- チーム間でリアルタイム共有
- Web UIでの編集が自然
- バージョン管理（履歴テーブル）
- 検索・フィルタリングが効率的

**Worker用ファイル出力:**
- Worker起動時にDBから `.agentmine/memory/` をスナップショット生成（read-only）
- worktreeには `.agentmine/memory/` のみ含め、エージェント/設定/プロンプトのスナップショットは除外
- 再生成は `worker run` 実行時に行う（設定による）

### 4. YAML/Markdown エクスポート

**理由:**
- バックアップ・移行用
- 人間が読める形式での確認
- 他プロジェクトへの設定コピー

## Technology Stack

### 確定スタック

| カテゴリ | 技術 | 理由 |
|---------|------|------|
| パッケージマネージャ | **pnpm** | モノレポ最適、高速、ディスク効率 |
| モノレポ管理 | **Turborepo** | キャッシュ、並列ビルド |
| 言語 | **TypeScript** | 型安全、IDE支援 |
| CLI | **Commander.js** | 標準的、ドキュメント充実 |
| ORM | **Drizzle ORM** | 型安全、軽量、SQLite/PG両対応 |
| マイグレーション | **Drizzle Kit** | スキーマから自動生成 |
| Web UI | **Next.js 14+** (App Router) | React最新、SSR/SSG対応 |
| UIコンポーネント | **shadcn/ui + Tailwind CSS** | カスタマイズ性、モダン |
| テスト | **Vitest** | 高速、TypeScript対応、Jest互換 |
| 配布 | **npm公開** | 標準的、`npx`対応 |

### インストール方法（ユーザー向け）

```bash
# グローバルインストール
npm install -g agentmine

# または npx で直接実行
npx agentmine init
```

### MCP設定例（Claude Code）

```json
{
  "mcpServers": {
    "agentmine": {
      "command": "npx",
      "args": ["agentmine", "mcp", "serve"]
    }
  }
}
```

## Security Considerations

### 1. Sandbox Execution（将来）

並列実行時はDockerコンテナで隔離：

```
┌──────────────────────────────────────┐
│  Host                                │
│  ┌────────────┐  ┌────────────┐     │
│  │ Container  │  │ Container  │     │
│  │  Task #1   │  │  Task #2   │     │
│  │  (isolated)│  │  (isolated)│     │
│  └────────────┘  └────────────┘     │
└──────────────────────────────────────┘
```

### 2. API Key Management

- 環境変数で管理（`.env`）
- 設定ファイルには含めない
- MCP経由でのキー露出を防ぐ

## Extensibility

### 1. Plugin System（将来）

```typescript
// プラグインインターフェース
interface AgentminePlugin {
  name: string;
  hooks: {
    onTaskCreate?: (task: Task) => void;
    onTaskComplete?: (task: Task) => void;
    onWorktreeCreate?: (worktree: Worktree) => void;
  };
  commands?: Command[];
  mcpTools?: MCPTool[];
}
```

### 2. Custom Agents

エージェント定義はDBに保存。YAMLは作成/編集・インポート/エクスポート用のスナップショット。

```yaml
# custom-agent.yaml (snapshot)
name: custom-agent
description: "カスタムエージェント"
client: claude-code
model: sonnet
scope:
  read: ["**/*"]
  write: ["src/**"]
  exclude: ["**/*.env"]
config:
  temperature: 0.7
  maxTokens: 4096
promptContent: |
  # カスタムエージェント
  プロジェクトのガイドラインに従って作業すること。
```

詳細は [Agent System](./features/agent-system.md) を参照。
