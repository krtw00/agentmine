# Session Log

セッションログの設計。エージェント実行の記録と監査。

## 概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Memory Bank vs Session Log                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Memory Bank  = プロジェクト決定事項（永続的な知識）                 │
│  Session Log  = 何をしたかの記録（監査・デバッグ用）                │
│                                                                     │
│  Memory Bank は「覚えておくべきこと」                                │
│  Session Log は「何が起きたか」                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 記録内容

### Orchestrator が観測可能な範囲のみ

```
Agent 内部はブラックボックス
  → トークン使用量: 測定不可
  → ツール呼び出し: 測定不可

Orchestrator が観測可能
  → セッション開始/終了
  → 実行時間
  → 成果物（ファイル変更）
  → 結果（成功/失敗）
```

### 記録項目

| 項目 | 説明 |
|------|------|
| session_id | セッション識別子 |
| task_id | 紐づくタスク |
| agent_name | 使用エージェント |
| started_at | 開始時刻 |
| completed_at | 終了時刻 |
| duration_ms | 実行時間（ミリ秒） |
| status | running / completed / failed |
| artifacts | 成果物一覧（変更ファイル） |
| error | エラー情報（失敗時） |

## データモデル

### sessions テーブル

```typescript
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  taskId: integer('task_id')
    .references(() => tasks.id),
  agentName: text('agent_name').notNull(),

  status: text('status', {
    enum: ['running', 'completed', 'failed', 'cancelled']
  }).notNull().default('running'),

  // 実行時間
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),

  // 成果物
  artifacts: text('artifacts', { mode: 'json' })
    .$type<string[]>()  // 変更されたファイルパスの配列
    .default([]),

  // エラー情報
  error: text('error', { mode: 'json' })
    .$type<SessionError | null>()
    .default(null),
});

interface SessionError {
  type: string;      // timeout, crash, etc.
  message: string;
  details?: Record<string, any>;
}
```

## 保存と閲覧

### 保存形式

```
DB（sessions テーブル）のみ
ファイル出力は不要
```

### 閲覧方法

```
Web UI で閲覧
  → セッション一覧
  → フィルタ（タスク、日付、結果）
  → 詳細表示
```

## 保持期間

### 方針

```
各プロジェクトの設定に委ねる
agentmine でデフォルトは決めない
```

### 設定

```yaml
# .agentmine/config.yaml
sessionLog:
  retention:
    enabled: false    # デフォルト: 削除しない
    days: 90          # 有効時の保持日数
```

### 削除処理

```typescript
// 保持期間を超えたセッションを削除
async function cleanupOldSessions(config: Config): Promise<void> {
  if (!config.sessionLog.retention.enabled) return;

  const cutoff = Date.now() - config.sessionLog.retention.days * 24 * 60 * 60 * 1000;

  await db
    .delete(sessions)
    .where(lt(sessions.startedAt, new Date(cutoff)));
}
```

## 用途

| 用途 | 対象者 | 見たい情報 |
|------|--------|-----------|
| デバッグ | 開発者 | 失敗したセッションの詳細、エラー内容 |
| 監査 | 管理者 | いつ誰が何をしたか |
| 振り返り | チーム | タスクの実行履歴 |
| コスト把握 | PM | 実行時間の傾向 |

## CLI

```bash
# セッション一覧
agentmine session list
agentmine session list --task 42
agentmine session list --status failed

# セッション詳細
agentmine session show 123

# 古いセッション削除（手動）
agentmine session cleanup --days 90
```

## API

### SessionService

```typescript
export class SessionService {
  // セッション開始
  async startSession(taskId: number, agentName: string): Promise<Session>;

  // セッション完了
  async completeSession(
    sessionId: number,
    artifacts: string[],
  ): Promise<void>;

  // セッション失敗
  async failSession(
    sessionId: number,
    error: SessionError,
  ): Promise<void>;

  // セッション取得
  async getSession(id: number): Promise<Session | null>;
  async listSessions(filter?: SessionFilter): Promise<Session[]>;

  // クリーンアップ
  async cleanup(retentionDays: number): Promise<number>;
}
```

## Web UI

### セッション一覧画面

```
┌─────────────────────────────────────────────────────────┐
│ Sessions                                     [Filter ▼] │
├─────────────────────────────────────────────────────────┤
│ ID    Task    Agent    Status      Duration   Date     │
│ #123  #42     coder    ✓ completed 5m 32s    Jan 20   │
│ #122  #41     coder    ✗ failed    2m 15s    Jan 20   │
│ #121  #40     reviewer ✓ completed 1m 08s    Jan 19   │
└─────────────────────────────────────────────────────────┘
```

### セッション詳細画面

```
┌─────────────────────────────────────────────────────────┐
│ Session #123                                            │
├─────────────────────────────────────────────────────────┤
│ Task: #42 - 認証機能実装                                │
│ Agent: coder                                            │
│ Status: completed                                       │
│ Started: 2024-01-20 10:30:00                           │
│ Duration: 5m 32s                                        │
│                                                         │
│ Artifacts:                                              │
│   + src/auth/login.ts                                  │
│   + src/auth/middleware.ts                             │
│   M src/routes/index.ts                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## References

- [Memory Bank](./memory-bank.md)
- [Agent Execution](./agent-execution.md)
- [Error Handling](./error-handling.md)
