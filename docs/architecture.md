# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              agentmine                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   CLI       │  │  Web UI     │  │ MCP Server  │  │  Executor   │    │
│  │             │  │  (Next.js)  │  │             │  │  (Worker)   │    │
│  │  @cli       │  │  @web       │  │  @cli/mcp   │  │  @cli/exec  │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
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
│  │  ├── config.yaml      # プロジェクト設定                          │   │
│  │  ├── data.db          # SQLiteデータベース                        │   │
│  │  ├── memory/          # Memory Bank（コンテキスト）               │   │
│  │  └── skills/          # ローカルスキル                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

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
│   │   │   │   ├── skill.ts
│   │   │   │   ├── context.ts
│   │   │   │   └── ui.ts
│   │   │   ├── mcp/            # MCPサーバー
│   │   │   │   ├── server.ts
│   │   │   │   ├── tools.ts
│   │   │   │   └── resources.ts
│   │   │   └── executor/       # エージェント実行エンジン
│   │   │       ├── runner.ts
│   │   │       ├── parallel.ts
│   │   │       └── sandbox.ts
│   │   └── package.json
│   │
│   ├── web/                    # Web UI
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx    # Dashboard
│   │   │   │   ├── tasks/      # タスク管理
│   │   │   │   ├── agents/     # エージェント管理
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
│       │   │   ├── agent.ts
│       │   │   ├── session.ts
│       │   │   └── skill.ts
│       │   ├── services/       # ビジネスロジック
│       │   │   ├── task-service.ts
│       │   │   ├── agent-service.ts
│       │   │   ├── memory-service.ts
│       │   │   └── skill-service.ts
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

### 2. SQLite as Default, PostgreSQL for Teams

**理由:**
- SQLite: ゼロ設定、ポータブル、ローカル開発に最適
- PostgreSQL: チーム共有、スケーラビリティ
- Drizzle ORMで両方をサポート

### 3. File-based Memory Bank

**理由:**
- Markdownで人間も読める
- Gitで履歴管理可能
- AIエージェントが直接読み書き可能

### 4. YAML Configuration

**理由:**
- 人間が読みやすい
- コメント記述可能
- 既存ツール（Claude Code等）との親和性

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

### 3. Skill Validation

リモートスキル読み込み時：
- HTTPSのみ許可
- 署名検証（将来）
- ホワイトリスト制御

## Extensibility

### 1. Plugin System（将来）

```typescript
// プラグインインターフェース
interface AgentminePlugin {
  name: string;
  hooks: {
    onTaskCreate?: (task: Task) => void;
    onTaskComplete?: (task: Task) => void;
    onSessionStart?: (session: Session) => void;
  };
  commands?: Command[];
  mcpTools?: MCPTool[];
}
```

### 2. Custom Agents

```yaml
# .agentmine/config.yaml
agents:
  custom-agent:
    description: "カスタムエージェント"
    model: claude-sonnet
    tools: [Read, Write]
    skills: [my-skill]
    # カスタム設定
    config:
      temperature: 0.7
      maxTokens: 4096
```

### 3. Skill Marketplace（将来）

```bash
# コミュニティスキルのインストール
agentmine skill install @community/security-audit
agentmine skill install @company/internal-review
```
