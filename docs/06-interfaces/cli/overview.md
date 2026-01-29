# CLI設計

## 目的

agentmine CLIの設計を定義する。本ドキュメントはCLI設計のSSoT（Single Source of Truth）である。

## 背景

AgentMineは3つのインターフェース（CLI、MCP、Web UI）を提供する。CLIはOrchestratorとスクリプト向け。人間はWeb UIを使用する。

**なぜCLIがOrchestratorAI専用か:**
- 繰り返し処理はスクリプト化すべき → Orchestratorが担当
- 状態確認はWeb UIの方が視認性が高い
- タスク管理はWeb UIの方が効率的

## 設計原則

AI/スクリプト向けに最適化。人間向けフォーマット（--pretty）は補助的。

## インターフェース役割分担

| ユーザー | インターフェース | 用途 |
|----------|------------------|------|
| Orchestrator AI | CLI / MCP | タスク管理、Worker起動、並列制御、Agent/Memory管理 |
| シェルスクリプト | CLI | 自動化、CI/CD連携 |
| 人間 | Web UI | タスク確認、Agent編集、状態監視（CLIと同等機能） |

## 出力モード

| モード | 用途 | 例 |
|--------|------|-----|
| デフォルト | パイプ連携、スクリプト | タブ区切りテキスト |
| --json | Orchestrator AI（推奨） | 構造化データ |
| --quiet | 単一値の取得 | IDのみ |
| --pretty | デバッグ、手動確認 | カラー付きテーブル |

## コマンド構造

| コマンド | 説明 |
|---------|------|
| init | プロジェクト初期化 |
| task | タスク管理 |
| agent | エージェント定義管理 |
| worker | Worker環境管理 |
| session | セッション管理 |
| memory | Memory Bank |
| settings | プロジェクト設定管理 |
| audit | 監査ログ |
| db | データベース管理 |
| mcp | MCPサーバー |
| ui | Web UI起動 |

## taskコマンド

| サブコマンド | 説明 |
|-------------|------|
| task add {title} | タスク作成 |
| task list | タスク一覧 |
| task show {id} | タスク詳細 |
| task update {id} | タスク更新 |
| task delete {id} | タスク削除 |

### task addオプション

| オプション | 説明 |
|-----------|------|
| -d, --description | 説明 |
| -p, --priority | low / medium / high / critical |
| -t, --type | task / feature / bug / refactor |
| --parent {id} | 親タスクID |
| --assignee {name} | 担当者名 |
| --ai | AI担当として割り当て |
| --human | 人間担当として割り当て |
| --labels {csv} | ラベル（カンマ区切り） |
| --json | JSON出力 |
| --quiet | IDのみ出力 |

### task listオプション

| オプション | 説明 |
|-----------|------|
| -s, --status | open / in_progress / done / failed / cancelled |
| -p, --priority | low / medium / high / critical |
| -t, --type | task / feature / bug / refactor |
| --assignee {name} | 担当者でフィルタ |
| --ai | AI担当のみ |
| --human | 人間担当のみ |
| --unassigned | 未割り当てのみ |
| --limit {n} | 表示件数（デフォルト: 20） |
| --json | JSON出力 |

## workerコマンド

| サブコマンド | 説明 |
|-------------|------|
| worker run {task-id} | worktree作成 + Worker起動 |
| worker done {task-id} | タスク完了 + クリーンアップ |
| worker list | アクティブworktree一覧 |
| worker status {task-id} | 実行状態表示 |
| worker wait {task-ids...} | 完了待機 |
| worker stop {task-ids...} | Worker停止 |
| worker cleanup {task-id} | worktree削除 |
| worker prompt {task-id} | プロンプト生成 |
| worker context {task-id} | タスクコンテキスト表示 |

### worker runオプション

| オプション | 説明 |
|-----------|------|
| -a, --agent {name} | エージェント名（デフォルト: coder） |
| --exec {client} | Worker AIを起動（clientを指定するとagent定義を上書き） |
| --detach | バックグラウンドで起動 |
| --no-worktree | worktree作成をスキップ |
| --json | JSON出力 |

### worker run動作

| 手順 | 操作 |
|------|------|
| 1 | タスク情報取得 |
| 2 | セッション開始（DBに記録） |
| 3 | ブランチ作成（task-{id}-s{sessionId}） |
| 4 | Git worktree作成 |
| 5 | スコープ適用 |
| 6-a | --exec指定時: Worker AIプロセス起動 |
| 6-b | --exec未指定: 起動コマンド表示 |

## sessionコマンド

| サブコマンド | 説明 |
|-------------|------|
| session list | セッション一覧 |
| session show {id} | セッション詳細 |
| session start {task-id} | セッション開始（手動運用時のみ） |
| session end {session-id} | セッション終了（詳細記録追記時） |
| session cleanup | 古いセッション削除 |

### session endオプション

| オプション | 説明 |
|-----------|------|
| --exit-code {code} | Workerプロセスの終了コード |
| --signal {signal} | 終了シグナル（SIGTERM等） |
| --dod-result {res} | DoD結果: pending / merged / timeout / error |
| --artifacts {json} | 成果物（JSON配列） |
| --error {json} | エラー情報 |

## memoryコマンド

| サブコマンド | 説明 |
|-------------|------|
| memory list | 決定事項一覧 |
| memory add | 決定事項追加 |
| memory edit {id} | 決定事項編集 |
| memory remove {id} | 決定事項削除 |
| memory preview | コンテキストプレビュー |
| memory export --output {dir} | エクスポート |
| memory import --dir {dir} | インポート |

## agentコマンド

| サブコマンド | 説明 |
|-------------|------|
| agent list | エージェント一覧 |
| agent show {name} | エージェント詳細 |
| agent create | エージェント作成 |
| agent update {name} | エージェント更新 |
| agent delete {name} | エージェント削除 |
| agent history {name} | 履歴表示 |
| agent rollback {name} --version {n} | 過去バージョンに戻す |
| agent export {name} --output {file} | エクスポート |
| agent import --file {file} | インポート |

## settingsコマンド

| サブコマンド | 説明 |
|-------------|------|
| settings list | 設定一覧 |
| settings show | 設定を構造化表示 |
| settings get {key} | 設定値取得 |
| settings set {key} {value} | 設定値変更 |
| settings delete {key} | 設定削除 |
| settings init | デフォルト設定で初期化 |

### 設定キー例

| キー | 説明 | デフォルト |
|------|------|-----------|
| git.baseBranch | ベースブランチ名 | main |
| git.branchPrefix | ブランチ接頭辞 | task- |
| execution.maxWorkers | 最大並列Worker数 | 3 |
| execution.worktreePath | worktree配置先 | .agentmine/worktrees |
| labels.default | デフォルトラベル | [] |

## auditコマンド

| サブコマンド | 説明 |
|-------------|------|
| audit list | 監査ログ一覧 |
| audit show {id} | 監査ログ詳細 |
| audit history {entityType} {entityId} | エンティティの履歴 |
| audit stats | 統計情報 |
| audit cleanup | 古いログ削除 |

### audit listオプション

| オプション | 説明 |
|-----------|------|
| -a, --action | create / update / delete / start / stop / export |
| -e, --entity | task / session / agent / memory / settings |
| -u, --user | ユーザーIDでフィルタ |
| -l, --limit | 表示件数（デフォルト: 50） |
| --json | JSON出力 |

## グローバルオプション

| オプション | 説明 |
|-----------|------|
| -C, --cwd {path} | 作業ディレクトリ |
| --config {path} | 設定ファイルのパス |
| --json | JSON出力（Orchestrator向け） |
| --quiet | 最小出力（IDのみ等） |
| --pretty | 人間向けフォーマット |
| --verbose | 詳細出力 |
| --version | バージョン表示 |
| --help | ヘルプ表示 |

## 終了コード

| コード | 意味 | 例 |
|--------|------|-----|
| 0 | 成功 | 正常終了 |
| 1 | 一般エラー | 予期しないエラー |
| 2 | 引数エラー | 必須引数不足、不正な値 |
| 3 | 設定エラー | 設定不正、baseBranch未設定 |
| 4 | データベースエラー | DB接続失敗 |
| 5 | リソース不存在 | TaskNotFound, AgentNotFound |
| 6 | 状態エラー | InvalidStatus, SessionAlreadyRunning |

## 環境変数

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| AGENTMINE_CONFIG | 設定ファイルのパス | .agentmine/config.yaml |
| AGENTMINE_DB_URL | データベースURL | file:.agentmine/data.db |
| AGENTMINE_LOG_LEVEL | ログレベル | info |
| ANTHROPIC_API_KEY | Anthropic APIキー | - |
| OPENAI_API_KEY | OpenAI APIキー | - |

## Orchestrator使用パターン

### シーケンシャル実行

| 手順 | コマンド |
|------|---------|
| 1 | agentmine task add "認証機能実装" --quiet → TASK_ID |
| 2 | agentmine worker run $TASK_ID --exec |
| 3 | agentmine worker done $TASK_ID |

### 並列実行

| 手順 | コマンド |
|------|---------|
| 1 | agentmine task add "ログイン実装" --quiet → TASK1 |
| 2 | agentmine task add "ログアウト実装" --quiet → TASK2 |
| 3 | agentmine worker run $TASK1 --exec --detach |
| 4 | agentmine worker run $TASK2 --exec --detach |
| 5 | agentmine worker wait $TASK1 $TASK2 |
| 6 | agentmine worker done $TASK1 $TASK2 |

## CLI vs Web UI役割分担

| 操作 | CLI（Orchestrator） | Web UI（人間） |
|------|:------------------:|:-------------:|
| タスク作成 | ✓ task add | ✓ フォーム |
| タスク一覧 | ✓ task list --json | ✓ テーブル/ボード |
| Worker起動 | ✓ worker run --exec | ✓ ボタンクリック |
| Worker停止 | ✓ worker stop | ✓ ボタンクリック |
| 状態監視 | ✓ worker status --json | ✓ リアルタイム表示 |
| 並列制御 | ✓ worker wait | - |
| Agent編集 | ✓ agent create/update | ✓ UI/YAMLエディタ |
| Memory編集 | ✓ memory add/edit | ✓ Markdownエディタ |

## 関連ドキュメント

- MCP設計: @06-interfaces/mcp/overview.md
- Web UI設計: @06-interfaces/web/overview.md
- Worker実行フロー: @07-runtime/worker-lifecycle.md
- 用語集: @appendix/glossary.md
