# 設定

## 目的

AgentMineの設定方法を定義する。本ドキュメントは設定のSSoT（Single Source of Truth）である。

## 背景

AgentMineは3層の設定構造を持つ。環境変数が最優先で適用され、機密情報を安全に管理できる。

**なぜ3層構造か:**
- グローバル設定でデフォルト値を提供
- プロジェクト設定でカスタマイズ
- 環境変数で機密情報を安全に上書き

## 設定の優先順位

```mermaid
flowchart LR
    A[環境変数] --> B[プロジェクト設定]
    B --> C[グローバル設定]

    subgraph Priority[優先順位]
        A
        B
        C
    end
```

| 優先度 | 設定 | パス |
|:------:|------|------|
| 1（高） | 環境変数 | AGENTMINE_* |
| 2 | プロジェクト設定 | .agentmine/config.yaml |
| 3（低） | グローバル設定 | ~/.agentmine/config.yaml |

## グローバル設定

### 場所

| OS | パス |
|----|------|
| Linux / macOS | ~/.agentmine/config.yaml |
| Windows | %USERPROFILE%\.agentmine\config.yaml |

### 主な設定項目

| セクション | 項目 | デフォルト | 説明 |
|-----------|------|-----------|------|
| database | url | sqlite://~/.agentmine/data.db | DB接続URL |
| database | pool.min | 2 | 最小接続数 |
| database | pool.max | 10 | 最大接続数 |
| worker | defaultClient | claude-code | デフォルトWorker AI |
| worker | autoApprove | false | 自動承認モード |
| worker | timeout | 3600 | タイムアウト（秒） |
| logging | level | info | ログレベル |
| mcp | port | 3001 | MCPサーバーポート |

## プロジェクト設定

### 場所

.agentmine/config.yaml（プロジェクトルート）

### 初期化

agentmine init でプロジェクト初期化時に自動生成。

### 主な設定項目

| セクション | 項目 | 説明 |
|-----------|------|------|
| project | name | プロジェクト名 |
| project | description | 説明 |
| database | url | プロジェクト専用DB（オプション） |
| agents | defaults | Agent共通設定 |
| memory | autoInject | Memory Bank自動注入 |
| worktree | basePath | worktreeベースパス |

## 環境変数

環境変数は最優先で適用される。機密情報はここで設定する。

### データベース

| 変数 | 説明 | 例 |
|------|------|-----|
| AGENTMINE_DB_URL | DB接続URL | postgres://user:pass@host/db |

### Worker

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| AGENTMINE_WORKER_CLIENT | デフォルトWorker AI | claude-code |
| AGENTMINE_WORKER_AUTO_APPROVE | 自動承認モード | false |
| AGENTMINE_WORKER_TIMEOUT | タイムアウト（秒） | 3600 |

### ログ

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| AGENTMINE_LOG_LEVEL | ログレベル | info |
| AGENTMINE_LOG_FILE | ログファイルパス | - |

### MCP

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| AGENTMINE_MCP_PORT | ポート | 3001 |
| AGENTMINE_MCP_HOST | ホスト | localhost |

## データベース設定

### PostgreSQL（本番推奨）

| 項目 | 説明 |
|------|------|
| 接続URL | postgres://user:pass@host:5432/agentmine |
| SSL | sslmode=require で有効化 |
| プール | max: Worker数 × 2 を目安 |

### SQLite（開発用）

| 項目 | 説明 |
|------|------|
| 接続URL | sqlite://.agentmine/data.db |
| WAL | journal: WAL で有効化推奨 |

## Agent定義の管理方法

| 方法 | 説明 | 推奨 |
|------|------|:----:|
| DB登録 | agentmine agent add コマンドで登録 | ✓ |
| YAMLファイル | .agentmine/agents/ 配下にYAML作成、importでDB登録 | |
| インライン | タスク作成時に --agent-inline で指定 | |

## スコープ制御設定

Agent定義内で指定する。

| スコープ | 説明 | 例 |
|---------|------|-----|
| exclude | 完全に除外 | **/*.env, **/secrets/** |
| read | 参照のみ | docs/**, README.md |
| write | 編集可能 | src/**, tests/** |

**詳細:** @03-core-concepts/scope-control.md を参照

## Memory Bank設定

| 項目 | 説明 | デフォルト |
|------|------|-----------|
| autoInject | Worker起動時に自動注入 | true |
| categories | 注入対象カテゴリ | architecture, conventions |
| outputDir | 出力先 | .agentmine/memory |

**詳細:** @05-features/memory-bank.md を参照

## Web UI設定

| 変数 | 説明 | 必須 |
|------|------|:----:|
| DATABASE_URL | PostgreSQL接続URL | ✓ |
| NEXTAUTH_URL | 認証URL | 本番 |
| NEXTAUTH_SECRET | 認証シークレット | 本番 |
| NODE_ENV | 環境 | 本番 |

## 設定の検証

| コマンド | 説明 |
|---------|------|
| agentmine config validate | 設定の検証 |
| agentmine config show | 現在の設定表示 |

## ベストプラクティス

### セキュリティ

| 推奨 | 理由 |
|------|------|
| 機密情報は環境変数で | 設定ファイルに書かない |
| excludeでセンシティブファイル除外 | **/*.env, **/*.pem, **/secrets/** |
| autoApproveはfalse | 危険なため |

### パフォーマンス

| 推奨 | 理由 |
|------|------|
| PostgreSQL接続プール調整 | Worker数 × 2 を目安 |
| Worktree自動クリーンアップ | ディスク節約 |

### チーム協業

| 推奨 | 理由 |
|------|------|
| 共有PostgreSQL使用 | チーム全員が同じDBを参照 |
| プロジェクト設定をGit管理 | .agentmine/config.yaml をコミット |

## 関連ドキュメント

- インストール: @08-deployment/installation.md
- スコープ制御: @03-core-concepts/scope-control.md
- Memory Bank: @05-features/memory-bank.md
- CLI設計: @06-interfaces/cli/overview.md
- MCP設計: @06-interfaces/mcp/overview.md
- 用語集: @appendix/glossary.md
