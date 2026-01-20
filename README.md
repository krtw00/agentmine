# AgentMine

**Safe Parallel AI Development Environment**

複数のAIエージェントを並列実行し、安全に管理するための開発環境。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

[English](./README.en.md) | 日本語

---

## 概要

AgentMineは、複数のAIエージェントを並列実行するための実行環境である。Git worktreeによる隔離とスコープ制御により、複数のAIが同時に異なるタスクに取り組むことができる。

### 主な機能

- **並列実行**: Git worktreeによるエージェント隔離
- **スコープ制御**: sparse-checkout + chmodによる物理的なファイルアクセス制限
- **自動承認モード**: スコープ制御により、AIクライアントの自動承認フラグを安全に使用可能
- **複数AIクライアント対応**: Claude Code、Codex、Gemini CLI、Aider等に対応
- **DB管理**: PostgreSQL/SQLiteによる一元的なデータ管理（Redmine的運用）
- **Web UI**: タスク管理・監視用のブラウザインターフェース
- **MCP対応**: Orchestrator AI（Claude Code等）からのプログラマティックな操作

---

## 設計原則

AgentMineは以下の6つの設計原則に基づく：

1. **Single Source of Truth (DBマスター)**: すべてのデータ（タスク、Agent定義、Memory Bank、設定）はDBで管理
2. **Collaborative by Design (Redmine的運用)**: チーム全員が同じDBを参照し、リアルタイムで協業
3. **AI as Orchestrator**: 並列実行の計画・判断はOrchestrator AI、AgentMineは実行基盤を提供
4. **Isolation & Safety**: Worker隔離（worktree）+ スコープ制御（sparse-checkout + chmod）
5. **Observable & Deterministic**: ステータスはexit code、merge状態等の客観事実で判定
6. **Fail Fast**: エラーは即座に失敗させ、リカバリーは上位層（Orchestrator）の責務

詳細: [アーキテクチャ](./docs/02-architecture/architecture.md)

---

## アーキテクチャ

### Orchestrator / Worker モデル

```
Human / Orchestrator AI
         │
         ▼
    agentmine (実行基盤)
         │
    ┌────┼────┐
    ▼    ▼    ▼
 Worker Worker Worker
 (隔離されたworktreeで並列実行)
```

- **Orchestrator**: 並列実行を計画・監視（Claude Code等のAI、または人間）
- **agentmine**: worktree管理、スコープ適用、セッション記録
- **Worker**: 隔離されたworktree内でコードを作成（自動承認モード）

詳細: [Orchestrator/Workerモデル](./docs/03-core-concepts/orchestrator-worker.md)

---

## インストール

```bash
npm install -g agentmine
```

### プロジェクト初期化

```bash
# デフォルト（SQLite）
agentmine init

# PostgreSQL使用
export AGENTMINE_DB_URL="postgresql://user:pass@localhost:5432/agentmine"
agentmine init
```

---

## 使用方法

### Web UI（人間向け）

```bash
agentmine ui
```

ブラウザで `http://localhost:3333` を開き、以下を実行：

- タスク作成・管理
- エージェント定義の編集
- Worker起動・監視
- セッション履歴の確認

### CLI（Orchestrator AI / スクリプト向け）

```bash
# タスク管理
agentmine task add "認証機能実装" -t feature
agentmine task list

# Worker実行
agentmine worker run 1 --exec           # フォアグラウンド
agentmine worker run 1 --exec --detach  # バックグラウンド

# 監視
agentmine worker status
agentmine worker wait 1 2 3

# 完了処理
agentmine worker done 1
```

### MCP（Orchestrator AI向け）

`~/.config/claude/claude_desktop_config.json`:

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

Orchestrator AIに以下のように指示：

```
AgentMineを使って、タスク #3, #4, #5 を並列で実行してください
```

---

## スコープ制御

Agent定義でファイルアクセス範囲を制御：

```yaml
name: coder
client: claude-code
model: sonnet
scope:
  exclude:                 # sparse-checkoutで物理的に除外
    - "**/*.env"
    - "**/secrets/**"
  read:                    # 参照可能
    - "**/*"
  write:                   # 編集可能
    - "src/**"
    - "tests/**"
```

**優先順位**: `exclude` > `read` > `write`

- `exclude`: sparse-checkoutでファイルを物理的に除外
- `write`: 明示的に指定されたファイルのみ編集可能
- それ以外: chmodで読み取り専用

この仕組みにより、AIクライアントの自動承認フラグ（`--dangerously-skip-permissions`等）を安全に使用できる。

詳細: [スコープ制御](./docs/03-core-concepts/scope-control.md)

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript |
| パッケージマネージャ | pnpm |
| モノレポ | Turborepo |
| CLI | Commander.js |
| Web UI | Next.js + React + shadcn/ui + Tailwind CSS |
| DB | PostgreSQL (メイン) / SQLite (サブ) |
| ORM | Drizzle ORM |
| テスト | Vitest |

### データ管理

すべてのデータはDBで管理（DBマスター方式）：

| データ | テーブル | 備考 |
|--------|---------|------|
| タスク | `tasks` | - |
| セッション | `sessions` | Worker実行履歴 |
| Agent定義 | `agents` | 変更履歴付き |
| Memory Bank | `memories` | プロジェクト決定事項 |
| 設定 | `settings` | - |
| 監査ログ | `audit_logs` | - |

Worker起動時、必要なデータをDBからworktreeへファイル出力。`.agentmine/`ディレクトリは`.gitignore`対象。

詳細: [DBマスター方式](./docs/03-core-concepts/db-master.md)

---

## 対応AIクライアント

| クライアント | 自動承認フラグ | 対応状況 |
|-------------|--------------|---------|
| Claude Code | `--dangerously-skip-permissions` | ✓ |
| Codex | `--full-auto` | ✓ |
| Gemini CLI | `-y` | ✓ |
| Aider | `--yes` | ✓ |
| OpenCode | `--auto-approve` | ✓ |

---

## 開発

```bash
git clone https://github.com/krtw00/agentmine.git
cd agentmine

pnpm install

# 開発
pnpm dev          # 全パッケージ
pnpm cli dev      # CLIのみ
pnpm web dev      # Web UIのみ

# ビルド・テスト
pnpm build
pnpm test
pnpm lint
```

---

## ドキュメント

📚 **[ドキュメントトップページ](./docs/00-INDEX.md)** - すべてのドキュメントへの入り口

### クイックリンク

**初めての方:**
- [プロジェクト概要](./docs/01-introduction/overview.md) - AgentMineの詳細
- [アーキテクチャ](./docs/02-architecture/architecture.md) - システム構成と設計原則
- [Orchestrator/Workerモデル](./docs/03-core-concepts/orchestrator-worker.md) - アーキテクチャの中心概念

**利用者（Orchestrator開発者）:**
- [Worker起動フロー](./docs/07-runtime/worker-lifecycle.md) - Worker起動から終了まで
- [CLI設計](./docs/06-interfaces/cli/overview.md) - コマンドリファレンス
- [Memory Bank](./docs/05-features/memory-bank.md) - プロジェクト決定事項の管理

**開発者（AgentMine本体を開発）:**
- [開発ガイド](./docs/09-development/contributing.md) - 開発を始める
- [データモデル](./docs/04-data/data-model.md) - DBスキーマ
- [アーキテクチャ](./docs/02-architecture/architecture.md) - パッケージ構成

---

## ライセンス

[MIT License](./LICENSE)
