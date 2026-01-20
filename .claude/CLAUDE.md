# agentmine

**Safe Parallel AI Development Environment** - 複数AIを同時に、安全に、管理可能に

## プロジェクト概要

agentmineは**並列AI開発の実行環境**。Redmine的運用でチーム協業をサポート。

### Core Value

1. **並列AI管理** - 複数AIを同時に動かす（worktree隔離）
2. **スコープ制御** - 物理的なアクセス制限で安全に自動承認
3. **人間とAIの協業** - 人間はWeb UI、AIはCLI/MCP

```
┌─────────────────────────────────────────────────────────────────┐
│  Redmine的運用                                                   │
│                                                                 │
│  チーム全員 ───→ 共有PostgreSQL ───→ 単一の真実源               │
│                                                                 │
│  Human ──────┬─────→ Web UI ──┐                                 │
│              │                 │                                 │
│  Orchestrator ───→ CLI/MCP ───┼──→ DB (マスター) ──→ Worker     │
│                               │                                  │
└───────────────────────────────┴──────────────────────────────────┘
```

## 技術スタック

- **モノレポ**: pnpm + Turborepo
- **言語**: TypeScript (strict mode)
- **パッケージ構成**: @agentmine/cli, @agentmine/web, @agentmine/core
- **CLI**: Commander.js
- **DB**: PostgreSQL (メイン) / SQLite (サブ), Drizzle ORM
- **Web UI**: Next.js 14+ (App Router) + shadcn/ui + Tailwind CSS
- **テスト**: Vitest

## パッケージ構造

```
packages/
├── cli/      # CLIアプリケーション、MCPサーバー
├── web/      # Next.js Web UI
└── core/     # 共有ロジック（Services, Models, DB）
```

## コマンド

```bash
pnpm dev          # 全パッケージ同時起動
pnpm build        # ビルド
pnpm test         # テスト
pnpm lint         # リント
```

## コード規約

- 2スペースインデント
- シングルクォート使用
- ESLint + Prettier設定に従う
- 関数は単一責任
- エラーハンドリングを適切に行う

## Git コミット規約

- Conventional Commits形式を使用
- Co-Authored-Byタグを使用する場合は独自ドメインを使用:
  - Claude Code: `Co-Authored-By: Claude <claude@agentmine.local>`
  - Codex: `Co-Authored-By: Codex <codex@agentmine.local>`
  - その他AI: `<ai-name>@agentmine.local` 形式を使用
- 外部サービスのメールアドレス（`noreply@anthropic.com`, `noreply@openai.com`等）は使用しない
  - 理由: GitHubが意図しないユーザーアカウントにマッピングする可能性があるため

## 重要な設計原則

1. **DBマスター**: すべてのデータ（タスク、Agent、Memory、設定）はDBで管理
2. **Redmine的運用**: チーム全員が同じDBを参照、リアルタイム協業
3. **Worker隔離**: Workerは隔離されたworktreeで作業、DB直接アクセスなし
4. **スコープ制御**: sparse-checkout + chmodで物理的にファイルアクセスを制限
5. **非対話Worker**: Workerは自動承認モードで動作（--dangerously-skip-permissions等）
6. **Observable Facts**: ステータスはexit code, merge状態等の客観事実で判定

## データ管理（DBマスター）

| データ | 保存先 | Worker用出力 |
|--------|--------|--------------|
| タスク | DB (tasks) | - |
| セッション | DB (sessions) | - |
| Agent定義 | DB (agents) | .agentmine-worker/agent.yaml |
| Memory Bank | DB (memories) | .agentmine-worker/memory/ |
| 設定 | DB (settings) | - |
| 監査ログ | DB (audit_logs) | - |

```
Worker起動時:
DB → worktree/.agentmine-worker/ へファイル出力
     ├── agent.yaml
     ├── prompt.md
     └── memory/
```

## Worker実行フロー

```bash
# 単一Worker起動
agentmine worker run <taskId> --exec

# 並列実行（バックグラウンド）
agentmine worker run 1 --exec --detach
agentmine worker run 2 --exec --detach
agentmine worker wait 1 2    # 完了待機

# Worker管理
agentmine worker status      # 状態確認
agentmine worker stop 1      # 停止
agentmine worker done 1      # 完了・クリーンアップ
```

**worker runの動作:**
1. Git worktree作成（`.agentmine/worktrees/task-<id>/`）
2. DBからAgent定義・Memory取得 → worktreeへファイル出力
3. スコープ適用（exclude: sparse-checkout, write: chmod）
4. セッション開始
5. Worker AI起動（--detachでバックグラウンド）

## 詳細ドキュメント

- @docs/architecture.md - システムアーキテクチャ
- @docs/data-model.md - データモデル
- @docs/cli-design.md - CLIコマンド設計
- @docs/features/agent-system.md - エージェント定義
- @docs/features/agent-execution.md - 実行フロー
- @docs/features/mcp-integration.md - MCP連携
