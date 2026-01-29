# エラーハンドリング

## 目的

AgentMineのエラー処理とリカバリー戦略を定義する。本ドキュメントはエラーハンドリングのSSoT（Single Source of Truth）である。

## 背景

並列AI実行では様々なエラーが発生する。タイムアウト、クラッシュ、API制限、ネットワーク障害など。これらを適切に分類し、対応方針を明確にする必要がある。

**なぜFail Fastか:**
- Workerエラーはリトライしても同じ結果になる可能性が高い
- Orchestratorの判断を待つことで、適切なリカバリー戦略を選択できる
- エラー情報を即座に記録することで、デバッグが容易になる

## 設計原則

AgentMineはエラー情報を記録・提供する。リカバリー判断はOrchestratorの責務。

## エラー分類

### 分類と対応方針

| 分類 | 例 | 対応 | 理由 |
|------|-----|------|------|
| Workerエラー | タイムアウト、クラッシュ、レートリミット | 即座に失敗 | リトライしても同じ結果の可能性が高い |
| インフラエラー | DB接続失敗、ディスクフル、メモリ不足 | 即座に失敗 | システムレベルの対処が必要 |
| 外部接続エラー（一時的） | ネットワークタイムアウト、5xxエラー | 自動リトライ | 一時的な障害の可能性が高い |
| 外部接続エラー（永続的） | 4xxエラー、認証エラー、DNS失敗 | 即座に失敗 | 設定/コード修正が必要 |

### Workerエラー詳細

| エラー | 原因 | 記録内容 |
|--------|------|---------|
| timeout | 処理時間超過 | durationMs |
| crash | プロセス異常終了 | exitCode, stderr |
| rate_limit | API制限到達 | retryAfterMs |
| parse_error | 不正なレスポンス | rawOutput |

### 外部接続エラー詳細

| エラー | リトライ | 理由 |
|--------|---------|------|
| ネットワークタイムアウト | 最大3回（指数バックオフ） | 一時的な障害 |
| 5xxサーバーエラー | 最大3回（指数バックオフ） | サーバー側の一時障害 |
| 接続拒否（一時的） | 最大3回（指数バックオフ） | 負荷やメンテナンス |
| 4xxクライアントエラー | しない | 設定/コード修正が必要 |
| 認証エラー (401/403) | しない | 認証情報の確認が必要 |
| DNS解決失敗 | しない | 設定確認が必要 |

## リトライ戦略

### 指数バックオフ

| パラメータ | デフォルト値 | 説明 |
|-----------|-------------|------|
| maxRetries | 3 | 最大リトライ回数 |
| initialDelayMs | 1000 | 初回待機時間 |
| maxDelayMs | 30000 | 最大待機時間 |
| multiplier | 2 | 待機時間の倍率 |

**リトライ間隔例:**

| 試行 | 待機時間 |
|------|---------|
| 1回目 | 1秒 |
| 2回目 | 2秒 |
| 3回目 | 4秒 |

## リカバリー

### Orchestratorリトライ

Orchestratorが明示的にリトライを指示する。

| コマンド | 説明 |
|---------|------|
| agentmine task retry 42 | タスクをリトライ |
| agentmine session retry 123 | セッションをリトライ |
| agentmine task retry --all-failed | 全失敗タスクをリトライ |

### 自動リキュー

失敗したタスクを自動的にキューに戻す（設定可能）。

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| enabled | true | 自動リキュー有効 |
| maxAttempts | 3 | 最大リトライ回数 |
| delayMinutes | 5 | リキュー前の待機時間 |
| excludeErrors | rate_limit, client_error | 対象外エラー |

## エラーログ

### task_errorsテーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| id | integer PK | 自動採番 |
| task_id | integer FK | タスク参照 |
| session_id | integer FK | セッション参照 |
| category | enum | agent, infra, external |
| error_type | text | timeout, crash等 |
| message | text | エラーメッセージ |
| details | json | エラー固有の詳細 |
| attempt_number | integer | 試行回数 |
| resolved | boolean | 解決済みフラグ |
| created_at | timestamp | 作成日時 |

## CLI

| コマンド | 説明 |
|---------|------|
| agentmine errors list | エラー一覧 |
| agentmine errors list --task 42 | タスク別エラー |
| agentmine errors list --category agent | カテゴリ別エラー |
| agentmine errors list --unresolved | 未解決エラー |
| agentmine errors show 1 | エラー詳細 |
| agentmine errors resolve 1 | 解決済みにマーク |

## 設定

| 項目 | 設定キー | デフォルト |
|------|---------|-----------|
| 最大リトライ | retry.maxRetries | 3 |
| 初回待機 | retry.initialDelayMs | 1000 |
| 最大待機 | retry.maxDelayMs | 30000 |
| 自動リキュー | autoRequeue.enabled | true |
| 最大試行 | autoRequeue.maxAttempts | 3 |
| 待機時間 | autoRequeue.delayMinutes | 5 |
| タスクタイムアウト | timeout.taskDefaultMs | 3600000（1時間） |
| セッション最大 | timeout.sessionMaxMs | 7200000（2時間） |

## 責務分担

| 役割 | 責務 |
|------|------|
| AgentMine | エラー情報の記録（task_errorsテーブル） |
| AgentMine | エラー一覧・詳細の提供（CLI, MCP） |
| AgentMine | 設定に基づくリトライ判定情報の提供 |
| Orchestrator | Workerのエラー検知（終了コード、出力確認） |
| Orchestrator | リトライ判断（AgentMineの設定を参照） |
| Orchestrator | session end時のエラー記録 |
| Orchestrator | 人間への通知・エスカレーション |

## 関連ドキュメント

- システムアーキテクチャ: @02-architecture/architecture.md
- Observable Facts: @03-core-concepts/observable-facts.md
- Worker実行フロー: @07-runtime/worker-lifecycle.md
- 用語集: @appendix/glossary.md
