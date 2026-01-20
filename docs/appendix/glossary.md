# 用語集

AgentMineプロジェクトで使用する用語の正式な定義。

## 目的

用語の統一により、ドキュメントとコード間の一貫性を保つ。

## 原則

| 原則 | 説明 |
|------|------|
| 用語の統一 | 同じ概念には常に同じ用語を使用 |
| 略語の制限 | 略語は初出時に定義 |
| 大文字小文字 | コマンド・ファイル名以外は統一 |

## 中核概念

| 用語 | 説明 | 表記 |
|------|------|------|
| AgentMine | プロジェクト名。並列AI開発の実行環境 | CamelCase（コマンド・パッケージ名は小文字） |
| Orchestrator | 並列実行を計画・監視するAIクライアントまたは人間 | 大文字O |
| Worker | 隔離されたworktree内でコードを書くAIエージェント | 大文字W |
| worktree | Git worktreeの略。Workerの作業ディレクトリ | 小文字、1単語 |
| Session | 1回のWorker実行記録。1 task = N sessions | 大文字S |

### 非推奨表記

| 非推奨 | 推奨 | 理由 |
|--------|------|------|
| Master, Manager | Orchestrator | 統一用語 |
| Agent Runner | Worker | 統一用語 |
| work tree, ワークツリー | worktree | Git公式用語 |

## データ・状態管理

| 用語 | 説明 |
|------|------|
| DBマスター | すべてのデータはDBで管理する設計原則 |
| Single Source of Truth (SSoT) | 単一の真実源。情報の重複を排除 |
| Observable Facts | exit code、merge状態等、客観的事実でステータス判定 |

## エージェント・実行

| 用語 | 説明 | 構成要素 |
|------|------|---------|
| Agent | Worker実行時に使用するAI定義 | client, model, scope, promptContent |
| Agent Definition | Agentの設定情報。DBのagentsテーブルで管理 | name, client, model, scope, config, promptContent |
| scope | Workerがアクセスできるファイルの範囲制御 | exclude, read, write |
| promptContent | Worker起動時にAIクライアントに渡す指示 | - |

### スコープフィールド

| フィールド | 説明 | 実装 |
|-----------|------|------|
| exclude | アクセス不可 | sparse-checkoutで物理的に除外 |
| read | 参照可能 | chmod 444 |
| write | 編集可能 | chmod 644（明示的に指定が必要） |

**優先順位:** exclude > read > write

## AIクライアント

| 正式名称 | 実行バイナリ | enum値 |
|---------|-------------|--------|
| Claude Code | claude-code | claude-code |
| Codex | codex | codex |
| Gemini CLI | gemini | gemini-cli |
| Aider | aider | aider |

### 非推奨表記

| 非推奨 | 推奨 | 理由 |
|--------|------|------|
| claude | claude-code | 実行バイナリ名と一致 |
| gemini | gemini-cli | enum値として明確 |

## タスク管理

### Task Status

| ステータス | 判定条件 |
|-----------|---------|
| open | セッションなし |
| in_progress | runningセッションが1つ以上 |
| done | dod_result=merged のセッションが存在 |
| failed | runningなし、mergedなし、失敗/取消のみ |
| cancelled | 手動キャンセル |

### labels

タスクの柔軟な分類。ステータスとは別管理。

| 例 | 用途 |
|----|------|
| blocked | ブロック中 |
| needs_review | レビュー待ち |
| urgent | 緊急 |

## Memory Bank

| 用語 | 説明 |
|------|------|
| Memory Bank | プロジェクト決定事項を永続化し、AIに知識として渡す機能 |
| Memory Category | Memoryの分類（architecture, tooling, convention, rule） |
| Memory Status | draft（下書き）、active（有効）、archived（アーカイブ） |

### 標準カテゴリ

| カテゴリ | 説明 |
|---------|------|
| architecture | アーキテクチャ |
| tooling | ツール選定 |
| convention | 規約 |
| rule | ルール |

## Git・ブランチ

| 用語 | 説明 | デフォルト |
|------|------|-----------|
| baseBranch | Workerブランチの起点 | main |
| Branch Naming | Workerブランチの命名規則 | task-{taskId}-s{sessionId} |

### 非推奨表記

| 非推奨 | 推奨 |
|--------|------|
| base-branch | baseBranch |
| base_branch | baseBranch |

## CLI・コマンド

| 用語 | 説明 | 例 |
|------|------|-----|
| Command | CLIの第1階層 | task, agent, worker |
| Subcommand | CLIの第2階層 | list, show, add |

### 非推奨コマンド

| 非推奨 | 推奨 | 理由 |
|--------|------|------|
| task get | task show | CLIコマンド統一 |

## MCP

| 用語 | 説明 |
|------|------|
| MCP | Model Context Protocol。AIクライアントとの連携プロトコル |
| MCP Tool | MCPで提供するツール。命名: {category}_{action} |

## データベース

| データベース | 用途 |
|-------------|------|
| PostgreSQL | メインDB。チーム開発・本番環境 |
| SQLite | サブDB。個人開発・ローカル環境 |

## 実行・配置

| 用語 | 説明 |
|------|------|
| Exit Code | プロセスの終了コード（0: 成功、1-6: 各種エラー） |
| artifacts | Workerが変更したファイルの一覧 |
| DoD | Definition of Done。タスク完了の定義 |

### DoD結果

| 値 | 説明 |
|----|------|
| pending | 未判定 |
| passed | DoD検証通過 |
| dod_failed | DoD検証失敗（lint/test/build等の失敗） |
| merged | マージ完了（完了） |
| timeout | タイムアウト |
| error | エラー |

## 設定

| 用語 | 説明 | 場所 |
|------|------|------|
| config.yaml | 設定スナップショット | .agentmine/config.yaml |
| settings | プロジェクト設定（DB管理） | settingsテーブル |

## ディレクトリ構造

### .agentmine/

| パス | 説明 |
|------|------|
| config.yaml | 設定スナップショット |
| data.db | SQLiteデータベース |
| agents/ | Agent定義スナップショット |
| memory/ | Memory Bankスナップショット |
| worktrees/ | Worker用worktree |

### worktree構造

| パス | 説明 |
|------|------|
| .agentmine/memory/ | Memory Bank（read-only） |
| .claude/CLAUDE.md | promptContent出力先（Claude Code用） |
| src/, tests/ | write可能領域 |

## その他

| 用語 | 説明 |
|------|------|
| Redmine的運用 | 複数人が共有DBを参照し、リアルタイムで協業する運用モデル |
| Fail Fast | エラーは即座に失敗させ、リカバリーは上位層の責務とする原則 |
| DRY | Don't Repeat Yourself。情報の重複を避ける原則 |

## 非推奨用語一覧

| 非推奨 | 推奨 | 理由 |
|--------|------|------|
| claude | claude-code | 実行バイナリ名と一致 |
| gemini | gemini-cli | enum値として明確 |
| task get | task show | CLIコマンド統一 |
| work tree | worktree | Git公式用語 |
| ワークツリー | worktree | 英語表記統一 |
| Agent定義ファイル | Agent定義（DB） | DBマスター原則 |

**ドキュメント更新時**: 新しい用語は必ずこの用語集に追加してください。
