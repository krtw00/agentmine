# インストール

## 目的

AgentMineのインストール手順を定義する。本ドキュメントはインストールのSSoT（Single Source of Truth）である。

## 背景

AgentMineはCLI、Web UI、MCPサーバーの3コンポーネントで構成される。開発段階ではソースからのビルドが主な導入方法となる。

**なぜソースからのビルドか:**
- 開発中のためnpmパッケージ未公開
- カスタマイズが容易
- 最新の変更を即座に反映可能

## 前提条件

### 必須要件

| コンポーネント | 要件 | 理由 |
|---------------|------|------|
| OS | Linux, macOS, Windows (WSL2) | Node.js対応環境 |
| Git | 2.25以上 | worktree機能に必要 |
| Node.js | 20.x以上 | ES Modules対応 |
| pnpm | 9.x以上 | モノレポ管理 |
| DB | PostgreSQL 15+ または SQLite 3.35+ | DBマスター方式 |

### オプション要件

| コンポーネント | 用途 |
|---------------|------|
| Claude Code | Worker AI（推奨） |
| Cursor / Windsurf | MCP経由でのOrchestrator操作 |
| Docker | PostgreSQL環境構築 |

## ソースからのインストール

### 手順

| 手順 | コマンド | 説明 |
|------|---------|------|
| 1 | git clone | リポジトリ取得 |
| 2 | pnpm install | 依存関係インストール |
| 3 | pnpm build | パッケージビルド |
| 4 | pnpm link --global | CLIをグローバルリンク |
| 5 | agentmine --version | インストール確認 |

### インストール先

| OS | パス |
|----|------|
| Linux / macOS | ~/.local/share/pnpm/global/5/node_modules/@agentmine/cli |
| Windows | %APPDATA%\npm\node_modules\@agentmine\cli |

### 設定ファイル

| ファイル | 説明 |
|---------|------|
| ~/.agentmine/config.yaml | グローバル設定（初回実行時に自動生成） |

## データベースセットアップ

### PostgreSQL（チーム開発・本番推奨）

| 手順 | 操作 | 説明 |
|------|------|------|
| 1 | Docker起動 または Native起動 | PostgreSQL起動 |
| 2 | createdb agentmine | データベース作成 |
| 3 | AGENTMINE_DB_URL設定 | 接続URL設定 |
| 4 | agentmine db migrate | スキーマ作成 |

### SQLite（個人開発・テスト）

| 特徴 | 説明 |
|------|------|
| 自動作成 | 初回コマンド実行時に .agentmine/data.db が自動生成 |
| 設定不要 | デフォルトで使用可能 |

**SQLiteの制限:**

| 制限 | 影響 |
|------|------|
| チーム共有不可 | ファイルベースのため |
| 同時アクセス性能低下 | 並列Worker実行時 |
| トランザクション機能制限 | 一部機能が使えない |

## コンポーネント別セットアップ

### CLI

CLIはAgentMineの中核コンポーネント。

| 操作 | 説明 |
|------|------|
| agentmine --help | ヘルプ表示 |
| agentmine --version | バージョン確認 |

### Web UI

| モード | 起動方法 | URL |
|--------|---------|-----|
| 開発 | pnpm dev（packages/web内） | http://localhost:3000 |
| 本番 | pnpm build && pnpm start | http://localhost:3000 |

**Web UI環境変数:**

| 変数 | 説明 | 必須 |
|------|------|:----:|
| DATABASE_URL | PostgreSQL接続URL | ✓ |
| NEXTAUTH_URL | 認証URL | 本番 |
| NEXTAUTH_SECRET | 認証シークレット | 本番 |

### MCPサーバー

| 操作 | 説明 |
|------|------|
| agentmine mcp serve | stdio通信（デフォルト） |
| agentmine mcp serve --verbose | デバッグモード |

**詳細:** @06-interfaces/mcp/overview.md を参照

## プロジェクト初期化

| 手順 | 操作 | 説明 |
|------|------|------|
| 1 | cd your-project | プロジェクトディレクトリへ移動 |
| 2 | agentmine init | プロジェクト初期化 |
| 3 | agentmine status | セットアップ確認 |

### 生成されるディレクトリ

| パス | 説明 |
|------|------|
| .agentmine/config.yaml | プロジェクト設定 |
| .agentmine/worktrees/ | Worker作業ディレクトリ（自動作成） |

## トラブルシューティング

### AgentMine: command not found

| 原因 | 解決策 |
|------|--------|
| PATHが通っていない | pnpm bin -g でディレクトリを確認し、PATHに追加 |

### Database Connection Failed

| 原因 | 解決策 |
|------|--------|
| DB未起動 | docker compose ps または pg_isready で確認 |
| 環境変数未設定 | AGENTMINE_DB_URLを設定 |

### git worktree Command Failed

| 原因 | 解決策 |
|------|--------|
| Git 2.25未満 | Gitをアップデート |

### Permission Denied on Worktree

| 原因 | 解決策 |
|------|--------|
| スコープ制御によるchmod適用 | Workerを停止してから確認 |

## アップグレード

| 操作 | コマンド |
|------|---------|
| ソース更新 | git pull && pnpm install && pnpm build |
| マイグレーション | agentmine db migrate |
| ロールバック | agentmine db rollback |

## アンインストール

| 対象 | 操作 |
|------|------|
| CLI | pnpm unlink --global @agentmine/cli |
| プロジェクトデータ | .agentmine/ ディレクトリ削除 |
| グローバル設定 | ~/.agentmine/ ディレクトリ削除 |
| PostgreSQL | dropdb agentmine または docker compose down -v |

## 関連ドキュメント

- 設定: @08-deployment/configuration.md
- CLI設計: @06-interfaces/cli/overview.md
- MCP設計: @06-interfaces/mcp/overview.md
- 用語集: @appendix/glossary.md
