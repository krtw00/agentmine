# Error Handling

エラーハンドリングとリカバリーの設計。

## 概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                     エラー分類と対応方針                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【エージェントエラー】 → 即座に失敗                                 │
│  タイムアウト、クラッシュ、レートリミット                            │
│                                                                     │
│  【インフラエラー】 → 即座に失敗                                     │
│  DB接続失敗、ファイルシステムエラー、メモリ不足                      │
│                                                                     │
│  【外部接続エラー】 → エラー種別で分ける                             │
│  - ネットワークタイムアウト → 自動リトライ                          │
│  - 5xxサーバーエラー → 自動リトライ                                 │
│  - 4xxクライアントエラー → 即座に失敗                               │
│                                                                     │
│  【リカバリー】                                                      │
│  手動リトライ + 自動リキュー（設定可能）                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## エラー分類

### 1. エージェントエラー

エージェント実行中に発生するエラー。**即座に失敗**させる。

| エラー | 原因 | 対応 |
|--------|------|------|
| タイムアウト | 処理時間超過 | 即失敗、ログ記録 |
| クラッシュ | プロセス異常終了 | 即失敗、ログ記録 |
| レートリミット | API制限到達 | 即失敗、待機時間を通知 |
| 出力パースエラー | 不正なレスポンス | 即失敗、生出力を保存 |

**理由**: エージェントエラーはリトライしても同じ結果になる可能性が高い。人間の判断を待つ。

```typescript
type AgentError =
  | { type: 'timeout'; durationMs: number }
  | { type: 'crash'; exitCode: number; stderr: string }
  | { type: 'rate_limit'; retryAfterMs: number }
  | { type: 'parse_error'; rawOutput: string }
  ;
```

### 2. インフラエラー

システムインフラに起因するエラー。**即座に失敗**させる。

| エラー | 原因 | 対応 |
|--------|------|------|
| DB接続失敗 | データベース停止 | 即失敗、管理者通知 |
| ファイルシステム | ディスクフル、権限 | 即失敗、管理者通知 |
| メモリ不足 | リソース枯渇 | 即失敗、管理者通知 |

**理由**: インフラ問題はタスクレベルではなくシステムレベルで対処が必要。

```typescript
type InfraError =
  | { type: 'db_connection'; message: string }
  | { type: 'filesystem'; path: string; message: string }
  | { type: 'out_of_memory' }
  ;
```

### 3. 外部接続エラー

外部API/サービスとの通信エラー。**エラー種別で対応を分ける**。

#### リトライ対象（自動リトライ）

| エラー | 対応 |
|--------|------|
| ネットワークタイムアウト | 最大3回、指数バックオフ |
| 5xxサーバーエラー | 最大3回、指数バックオフ |
| 接続拒否（一時的） | 最大3回、指数バックオフ |

#### リトライ対象外（即失敗）

| エラー | 対応 |
|--------|------|
| 4xxクライアントエラー | 即失敗（設定/コード修正が必要） |
| 認証エラー (401/403) | 即失敗（認証情報の確認が必要） |
| Not Found (404) | 即失敗（リソースが存在しない） |
| DNS解決失敗 | 即失敗（設定確認が必要） |

```typescript
type ExternalError =
  | { type: 'network_timeout'; url: string; timeoutMs: number }
  | { type: 'server_error'; url: string; statusCode: number; body?: string }
  | { type: 'client_error'; url: string; statusCode: number; body?: string }
  | { type: 'connection_refused'; url: string }
  | { type: 'dns_error'; hostname: string }
  ;

function shouldRetry(error: ExternalError): boolean {
  switch (error.type) {
    case 'network_timeout':
    case 'connection_refused':
      return true;
    case 'server_error':
      return error.statusCode >= 500;
    case 'client_error':
    case 'dns_error':
      return false;
  }
}
```

## リトライ戦略

### 指数バックオフ

```typescript
interface RetryConfig {
  maxRetries: number;      // デフォルト: 3
  initialDelayMs: number;  // デフォルト: 1000
  maxDelayMs: number;      // デフォルト: 30000
  multiplier: number;      // デフォルト: 2
}

// リトライ間隔の計算
function getRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.multiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

// 例: attempt=0 → 1秒, attempt=1 → 2秒, attempt=2 → 4秒
```

### 実装例

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt === config.maxRetries) {
        throw error;
      }

      const delay = getRetryDelay(attempt, config);
      await sleep(delay);
    }
  }

  throw lastError!;
}
```

## リカバリー

### 手動リトライ

ユーザーが明示的にリトライを指示。

```bash
# 失敗したタスクをリトライ
agentmine task retry 42

# 失敗したセッションをリトライ
agentmine session retry 123
```

### 自動リキュー

失敗したタスクを自動的にキューに戻す（設定可能）。

```yaml
# .agentmine/config.yaml
errorHandling:
  autoRequeue:
    enabled: true
    maxAttempts: 3          # 最大リトライ回数
    delayMinutes: 5         # リキュー前の待機時間
    excludeErrors:          # 自動リキュー対象外
      - rate_limit
      - client_error
```

```typescript
// 自動リキューの判定
async function handleTaskFailure(task: Task, error: TaskError): Promise<void> {
  const config = await getConfig();

  // リキュー回数チェック
  if (task.attemptCount >= config.errorHandling.autoRequeue.maxAttempts) {
    await markTaskFailed(task, error, 'max_attempts_exceeded');
    return;
  }

  // エラー種別チェック
  if (config.errorHandling.autoRequeue.excludeErrors.includes(error.type)) {
    await markTaskFailed(task, error, 'non_retryable_error');
    return;
  }

  // リキュー
  await requeueTask(task, {
    delayMinutes: config.errorHandling.autoRequeue.delayMinutes,
    reason: `Auto-requeue after ${error.type}`,
  });
}
```

## エラーログ

### データモデル

```typescript
export const taskErrors = sqliteTable('task_errors', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id),
  sessionId: integer('session_id')
    .references(() => sessions.id),

  category: text('category', {
    enum: ['agent', 'infra', 'external']
  }).notNull(),

  errorType: text('error_type').notNull(),  // timeout, crash, etc.
  message: text('message').notNull(),
  details: text('details', { mode: 'json' }),  // エラー固有の詳細

  attemptNumber: integer('attempt_number').notNull().default(1),
  resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`),
});
```

### ログ例

```json
{
  "id": 1,
  "taskId": 42,
  "sessionId": 123,
  "category": "external",
  "errorType": "server_error",
  "message": "API request failed with status 503",
  "details": {
    "url": "https://api.example.com/endpoint",
    "statusCode": 503,
    "retryAttempts": 3,
    "totalDurationMs": 15000
  },
  "attemptNumber": 1,
  "resolved": false,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## CLI

```bash
# エラー一覧
agentmine errors list
agentmine errors list --task 42
agentmine errors list --category agent
agentmine errors list --unresolved

# エラー詳細
agentmine errors show 1

# エラーを解決済みにマーク
agentmine errors resolve 1

# 失敗タスクの一覧
agentmine task list --status failed

# リトライ
agentmine task retry 42
agentmine task retry --all-failed  # 全失敗タスクをリトライ
```

## 設定

```yaml
# .agentmine/config.yaml
errorHandling:
  # リトライ設定
  retry:
    maxRetries: 3
    initialDelayMs: 1000
    maxDelayMs: 30000
    multiplier: 2

  # 自動リキュー設定
  autoRequeue:
    enabled: false  # デフォルトは無効
    maxAttempts: 3
    delayMinutes: 5
    excludeErrors:
      - rate_limit
      - client_error
      - auth_error

  # タイムアウト設定
  timeout:
    taskDefaultMs: 3600000   # 1時間
    sessionMaxMs: 7200000    # 2時間

  # 通知設定（将来）
  notification:
    enabled: false
    channels: []  # slack, email, etc.
```

## API

### ErrorService

```typescript
export class ErrorService {
  // エラー記録
  async logError(error: TaskErrorInput): Promise<TaskError>;

  // エラー取得
  async listErrors(filter?: ErrorFilter): Promise<TaskError[]>;
  async getError(id: number): Promise<TaskError | null>;

  // エラー解決
  async resolveError(id: number): Promise<void>;
  async resolveAllForTask(taskId: number): Promise<void>;

  // リトライ判定
  shouldRetry(error: TaskError): boolean;
  getRetryDelay(error: TaskError, attempt: number): number;
}
```

## References

- [Agent Execution](./agent-execution.md)
- [Data Model](../data-model.md)
