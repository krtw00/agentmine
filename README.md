# agentmine

**Safe Parallel AI Development Environment**

> 複数AIを同時に、安全に、管理可能に

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

[English](./README.en.md) | 日本語

---

## Why agentmine?

**GitHub Issueで並列AI開発を管理しようとしたら、無理があった。**

Issueは「記録」であって「実行環境」ではない。
複数AIを同時に動かすには、**隔離・スコープ制御・安全な自動実行**が必要。

agentmineは、その課題を解決する**並列AI開発の実行環境**です。

---

## Core Value

```
┌─────────────────────────────────────────────────────────────────────┐
│                    agentmine のコア価値                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 並列AI管理                                                       │
│     • 複数AIを同時に動かす（worktree隔離）                           │
│     • 得意分野に合わせて割り当て                                     │
│     • コンテキスト限界時の切り替え                                   │
│                                                                     │
│  2. スコープ制御                                                     │
│     • 物理的なアクセス制限（sparse-checkout + chmod）                │
│     • Yes/No選択なしで安全に自動実行                                 │
│     • --dangerously-skip-permissions を安心して使える               │
│                                                                     │
│  3. 人間とAIの協業                                                   │
│     • Orchestrator AI経由でも、人間の直接操作でも                    │
│     • Web UIで全体把握・監視                                         │
│     • タスク定義は人間、実行はAI、承認は人間                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Issue vs agentmine

| 観点 | GitHub Issues | agentmine |
|------|---------------|-----------|
| **本質** | 記録・追跡 | 実行環境 |
| **並列実行** | ✗ 管理できない | ✓ worktree隔離 |
| **スコープ制御** | ✗ 概念がない | ✓ 物理的制限 |
| **自動承認** | ✗ 関係ない | ✓ 安全に可能 |
| **AI割り当て** | ✗ 手動でコメント | ✓ エージェント定義 |
| **状態** | Open/Closed | 実行状態（running/waiting/done） |

**Issueで管理、agentmineで実行。** 競合ではなく補完関係。

---

## How to Use

### For Humans: Web UI

```
http://localhost:3333
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  タスク作成 → エージェント選択 → Worker起動 → 監視 → 完了確認       │
│                                                                     │
│  すべてブラウザで完結。CLIを覚える必要なし。                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### For Orchestrator AI: CLI / MCP

Orchestrator AI（Claude Code等）がCLI/MCPを使って自動化：

```bash
# Orchestratorが実行
agentmine task add "認証機能" -t feature
agentmine worker run 1 --exec --detach
agentmine worker run 2 --exec --detach
agentmine worker wait 1 2
```

または MCP経由で直接操作：

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

**人間はWeb UI、AIはCLI/MCP。それぞれに最適なインターフェース。**

---

## Quick Start

```bash
# インストール
npm install -g agentmine

# プロジェクト初期化
agentmine init

# Web UI起動
agentmine ui
```

ブラウザで `http://localhost:3333` を開いて、タスク作成・Worker起動・監視まで完結。

### Orchestrator AI経由で使う場合

Claude CodeなどのOrchestratorにagentmineを使わせる：

```bash
# MCP設定後、Orchestratorに指示
「agentmineでタスクを管理して、並列でWorkerを動かして」
```

---

## Features

### 1. Web UI - 人間向けダッシュボード

```bash
agentmine ui  # http://localhost:3333
```

**人間はWeb UIで完結:**
- タスク作成・編集・削除
- エージェント選択・割り当て
- Worker起動・停止
- 進捗監視・完了確認
- 差分プレビュー

CLIを覚える必要なし。ブラウザだけで並列AI開発を管理。

### 2. Scope Control - スコープ制御

```yaml
# DB内のAgent定義（Web UIで編集可能）
name: coder
client: claude-code
model: sonnet
scope:
  read: ["**/*"]                    # 全ファイル参照可能
  write: ["src/**", "tests/**"]     # 編集はこれらのみ
  exclude: ["**/*.env", "**/secrets/**"]  # 物理的に削除
```

- **exclude**: sparse-checkoutでファイルを物理的に除外
- **write**: それ以外はchmodで読み取り専用
- **結果**: AIが触れる範囲を物理的に制限 → **安全に自動承認**

**Yes/No選択から解放。** スコープ内なら何をしても安全。

### 3. Parallel Execution - 並列AI実行

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Worker 1  │  │  Worker 2  │  │  Worker 3  │
│  (Claude)  │  │  (Codex)   │  │  (Gemini)  │
│ worktree-1 │  │ worktree-2 │  │ worktree-3 │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │
      └───────────────┴───────────────┘
                      │
                    Git
```

各Workerは独立したworktreeで作業。互いに干渉しない。

### 4. Multiple AI Clients - 複数AIクライアント対応

| クライアント | 自動承認モード | 対応状況 |
|-------------|--------------|---------|
| Claude Code | `--dangerously-skip-permissions` | ✓ |
| Codex | `--full-auto` | ✓ |
| Gemini CLI | `-y` | ✓ |
| Aider | `--yes` | ✓ |
| OpenCode | `--auto-approve` | ✓ |

得意分野に合わせてAIを使い分け。コンテキスト限界時は別AIに切り替え。

### 5. Agent Definitions - 役割別エージェント設定（DB管理）

**エージェント定義はDBで管理。** Web UIで編集、チーム間でリアルタイム共有。

```yaml
# DB内のAgent定義（Web UI/CLIで編集）
name: planner
description: "設計担当"
client: claude-code
model: opus            # 高性能モデル
scope:
  read: ["**/*"]
  write: []            # 読み取り専用
```

```yaml
name: coder
description: "実装担当"
client: claude-code
model: sonnet
scope:
  write: ["src/**", "tests/**"]
```

変更履歴も自動保存。過去バージョンへのロールバックも可能。

### 6. MCP / CLI - Orchestrator AI向け

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

Orchestrator AI（Claude Code等）がagentmineを自動操作。
CLIは人間ではなく、AI/スクリプト向け。

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Human ──────┬─────────────────────────────────────┐               │
│              │                                     │               │
│              ▼                                     ▼               │
│  ┌───────────────────┐                  ┌──────────────────┐      │
│  │ Orchestrator AI   │                  │  CLI / Web UI    │      │
│  │ (Claude Code)     │                  │  (直接操作)      │      │
│  └─────────┬─────────┘                  └────────┬─────────┘      │
│            │                                     │                 │
│            └──────────────┬──────────────────────┘                 │
│                           ▼                                        │
│            ┌──────────────────────────────┐                       │
│            │          agentmine           │                       │
│            │                              │                       │
│            │  • Task Management           │                       │
│            │  • Worktree + Scope Control  │                       │
│            │  • Worker Lifecycle          │                       │
│            │  • Session Recording         │                       │
│            └──────────────┬───────────────┘                       │
│                           │                                        │
│          ┌────────────────┼────────────────┐                      │
│          ▼                ▼                ▼                      │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│   │  Worker 1  │  │  Worker 2  │  │  Worker 3  │                 │
│   │  (Claude)  │  │  (Codex)   │  │  (Gemini)  │                 │
│   │ worktree-1 │  │ worktree-2 │  │ worktree-3 │                 │
│   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                 │
│         │               │               │                         │
│         └───────────────┴───────────────┘                         │
│                         │                                          │
│                         ▼                                          │
│                       Git                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## CLI Reference (for Orchestrator AI / Scripts)

> **Note:** CLIは人間向けではなく、Orchestrator AI/スクリプト向けです。
> 人間はWeb UIを使用してください。

### Task Management

```bash
agentmine task add <title> [options]     # タスク作成
agentmine task list [options]            # タスク一覧
agentmine task show <id>                 # タスク詳細
agentmine task update <id> [options]     # タスク更新
agentmine task delete <id>               # タスク削除
```

### Worker Management

```bash
agentmine worker run <task-id> --exec           # Worker起動
agentmine worker run <task-id> --exec --detach  # バックグラウンド起動
agentmine worker status [task-id]               # 状態確認
agentmine worker wait <task-ids...>             # 完了待機
agentmine worker stop <task-ids...>             # 停止
agentmine worker done <task-id>                 # クリーンアップ
```

### Other

```bash
agentmine init          # プロジェクト初期化
agentmine ui            # Web UI起動
agentmine mcp serve     # MCPサーバー起動
```

---

## Technology Stack

| カテゴリ | 技術 |
|---------|------|
| パッケージマネージャ | pnpm |
| モノレポ管理 | Turborepo |
| 言語 | TypeScript |
| CLI | Commander.js |
| Web UI | Next.js + React + shadcn/ui + Tailwind |
| ORM | Drizzle ORM |
| DB | **PostgreSQL（メイン）** / SQLite（サブ） |
| テスト | Vitest |

### データ管理（DBマスター）

すべてのデータ（タスク、Agent定義、Memory Bank、設定）はDBで管理。Redmine的運用でチーム協業。

```
チーム全員 ───→ 共有PostgreSQL ───→ 単一の真実源
```

| データ | 保存先 | 備考 |
|--------|--------|------|
| タスク | DB | tasks テーブル |
| Agent定義 | DB | agents テーブル + 変更履歴 |
| Memory Bank | DB | memories テーブル + 変更履歴 |
| 設定 | DB | settings テーブル |
| 監査ログ | DB | audit_logs テーブル |

Worker起動時にDBからworktreeへファイル出力。`.agentmine/`は`.gitignore`。

---

## Development

```bash
# Clone
git clone https://github.com/krtw00/agentmine.git
cd agentmine

# Install dependencies
pnpm install

# Development
pnpm dev          # 全パッケージ同時起動
pnpm cli dev      # CLIのみ
pnpm web dev      # Web UIのみ

# Build
pnpm build

# Test
pnpm test
```

---

## Documentation

- [Architecture](./docs/architecture.md) - システムアーキテクチャ
- [Data Model](./docs/data-model.md) - データモデル
- [CLI Design](./docs/cli-design.md) - CLIコマンド設計
- [Agent System](./docs/features/agent-system.md) - エージェント定義
- [Parallel Execution](./docs/features/parallel-execution.md) - 並列実行
- [Worktree & Scope](./docs/features/worktree-scope.md) - スコープ制御

---

## License

[MIT License](./LICENSE)

---

<p align="center">
  <b>agentmine</b> - Safe Parallel AI Development Environment
</p>
