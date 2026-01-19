# Parallel Execution

TSKから着想を得た並列タスク実行機能。

## 概要

複数のタスクを並列で実行し、それぞれ独立したブランチで作業。
完了後にPRとして提出。

## 設計目標

1. **並列実行**: 複数タスクの同時処理
2. **隔離**: タスク間の干渉を防ぐ
3. **比較**: 同一タスクを複数エージェントで実行し比較
4. **安全性**: 本番環境への影響を最小化

## アーキテクチャ

```
┌──────────────────────────────────────────────────────────────┐
│                    Parallel Executor                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Task Queue                         │    │
│  │  [Task #3] [Task #4] [Task #5] [Task #6] ...        │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│              ┌───────────┼───────────┐                      │
│              ▼           ▼           ▼                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Worker 1   │ │   Worker 2   │ │   Worker 3   │        │
│  │              │ │              │ │              │        │
│  │  Task #3     │ │  Task #4     │ │  Task #5     │        │
│  │  branch-3    │ │  branch-4    │ │  branch-5    │        │
│  │  🤖 coder    │ │  🤖 coder    │ │  🤖 coder    │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│      PR #12           PR #13           PR #14              │
└──────────────────────────────────────────────────────────────┘
```

## 実行モード

### 1. Queue Mode（デフォルト）

タスクキューから順次取得して並列実行。

```bash
agentmine task run --parallel 3 --status open
```

```
Time →
Worker 1: [Task #3] ──────────────> [Task #6] ──────>
Worker 2: [Task #4] ──────> [Task #7] ──────────────>
Worker 3: [Task #5] ────────────────> [Task #8] ────>
```

### 2. Compare Mode

同一タスクを複数エージェントで実行し、結果を比較。

```bash
agentmine task run 5 --agent coder,reviewer --compare
```

```
┌─────────────────────────────────────────────────────┐
│  Task #5: 認証機能実装                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐         ┌─────────────┐          │
│  │   coder     │         │  reviewer   │          │
│  │  approach A │         │  approach B │          │
│  │  branch-5a  │         │  branch-5b  │          │
│  └──────┬──────┘         └──────┬──────┘          │
│         │                       │                  │
│         ▼                       ▼                  │
│      PR #12a                 PR #12b              │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Comparison Report                            │ │
│  │  - Lines changed: 120 vs 85                   │ │
│  │  - Test coverage: 80% vs 75%                  │ │
│  │  - Complexity: 7 vs 5                         │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## ブランチ戦略

```
main
  │
  ├── task-3-auth
  │     └── (Worker 1)
  │
  ├── task-4-api
  │     └── (Worker 2)
  │
  └── task-5-dashboard
        ├── task-5-dashboard-coder     (Compare Mode)
        └── task-5-dashboard-reviewer  (Compare Mode)
```

## 隔離レベル

### Level 1: Git Worktree（デフォルト）

軽量な隔離。同一マシン上で複数ディレクトリ。

```
/project/
├── .git/                    # 共有Git
├── main/                    # メインワークツリー
├── .worktrees/
│   ├── task-3/             # Worker 1
│   ├── task-4/             # Worker 2
│   └── task-5/             # Worker 3
```

**メリット:**
- セットアップが速い
- ディスク効率が良い

**デメリット:**
- 環境変数・依存関係は共有

### Level 2: Docker Container（将来）

完全な隔離。TSKスタイル。

```yaml
# config.yaml
parallel:
  isolation: docker
  image: node:20
  resources:
    memory: 4g
    cpu: 2
```

```
┌────────────────────────────────────────────────┐
│  Host                                          │
│  ┌──────────────┐  ┌──────────────┐           │
│  │  Container   │  │  Container   │           │
│  │  Task #3     │  │  Task #4     │           │
│  │  ┌────────┐  │  │  ┌────────┐  │           │
│  │  │ Agent  │  │  │  │ Agent  │  │           │
│  │  └────────┘  │  │  └────────┘  │           │
│  │  /workspace  │  │  /workspace  │           │
│  └──────────────┘  └──────────────┘           │
└────────────────────────────────────────────────┘
```

## API

### ParallelExecutor

```typescript
// packages/cli/src/executor/parallel.ts

interface ExecutorOptions {
  workers: number;
  isolation: 'worktree' | 'docker';
  status?: TaskStatus;
  agent?: string;
  compare?: boolean;
}

export class ParallelExecutor {
  constructor(options: ExecutorOptions) {}

  // キューモード
  async runQueue(): Promise<ExecutionResult[]>;

  // 特定タスク実行
  async runTask(taskId: number): Promise<ExecutionResult>;

  // 比較モード
  async runCompare(taskId: number, agents: string[]): Promise<CompareResult>;

  // 状態取得
  getStatus(): ExecutorStatus;

  // 停止
  async stop(): Promise<void>;
}
```

### Worker

```typescript
// packages/cli/src/executor/worker.ts

export class Worker {
  constructor(
    private id: number,
    private isolation: IsolationStrategy,
  ) {}

  async setup(task: Task): Promise<WorkerEnvironment>;
  async execute(task: Task, agent: Agent): Promise<ExecutionResult>;
  async cleanup(): Promise<void>;
}
```

### IsolationStrategy

```typescript
// packages/cli/src/executor/isolation.ts

interface IsolationStrategy {
  createEnvironment(task: Task): Promise<Environment>;
  destroyEnvironment(env: Environment): Promise<void>;
}

class WorktreeIsolation implements IsolationStrategy {
  async createEnvironment(task: Task): Promise<Environment> {
    // git worktree add
    const path = `.worktrees/task-${task.id}`;
    await exec(`git worktree add ${path} -b ${task.branchName}`);
    return { path, type: 'worktree' };
  }

  async destroyEnvironment(env: Environment): Promise<void> {
    await exec(`git worktree remove ${env.path}`);
  }
}

class DockerIsolation implements IsolationStrategy {
  async createEnvironment(task: Task): Promise<Environment> {
    // docker container create
    const containerId = await this.createContainer(task);
    return { containerId, type: 'docker' };
  }
}
```

## CLI

```bash
# 並列実行（3ワーカー）
agentmine task run --parallel 3

# ステータス指定
agentmine task run --parallel 3 --status open

# 特定タスク
agentmine task run 5 --parallel 1

# 比較モード
agentmine task run 5 --agent coder,reviewer --compare

# Docker隔離（将来）
agentmine task run --parallel 3 --isolation docker

# ドライラン
agentmine task run --parallel 3 --dry-run

# 状態確認
agentmine task run --status
```

## 出力例

### 実行中

```
Parallel Execution Started
Workers: 3
Isolation: worktree

[Worker 1] Task #3: 認証機能実装
           Agent: coder
           Branch: task-3-auth
           Status: running ████████░░ 80%

[Worker 2] Task #4: API設計
           Agent: coder
           Branch: task-4-api
           Status: running ██████░░░░ 60%

[Worker 3] Task #5: ダッシュボード
           Agent: coder
           Branch: task-5-dashboard
           Status: running ████░░░░░░ 40%

Press Ctrl+C to stop
```

### 完了

```
Execution Complete
Duration: 15m 32s

Results:
┌────┬─────────────────────┬─────────┬──────────┬────────────┐
│ ID │ Title               │ Status  │ Agent    │ PR         │
├────┼─────────────────────┼─────────┼──────────┼────────────┤
│ #3 │ 認証機能実装         │ ✅ done │ coder    │ PR #12     │
│ #4 │ API設計             │ ✅ done │ coder    │ PR #13     │
│ #5 │ ダッシュボード       │ ❌ fail │ coder    │ -          │
└────┴─────────────────────┴─────────┴──────────┴────────────┘

Failed tasks:
  #5: Test failed - Dashboard.test.tsx
```

### 比較結果

```
Compare Results: Task #5

┌────────────────┬─────────────────┬─────────────────┐
│ Metric         │ coder           │ reviewer        │
├────────────────┼─────────────────┼─────────────────┤
│ Lines changed  │ 120             │ 85              │
│ Files changed  │ 5               │ 4               │
│ Test coverage  │ 80%             │ 75%             │
│ Complexity     │ 7               │ 5               │
│ Duration       │ 8m 12s          │ 6m 45s          │
│ Tokens used    │ 12,500          │ 9,800           │
└────────────────┴─────────────────┴─────────────────┘

Branches:
  - task-5-dashboard-coder    → PR #12a
  - task-5-dashboard-reviewer → PR #12b

Recommendation: reviewer's approach is more concise
```

## 設定

```yaml
# config.yaml
parallel:
  # 最大ワーカー数
  maxWorkers: 4
  
  # 隔離方式
  isolation: worktree  # worktree | docker
  
  # Docker設定（isolation: docker時）
  docker:
    image: node:20
    memory: 4g
    cpu: 2
    networkMode: bridge
  
  # 自動PR作成
  autoPr: true
  
  # 失敗時の動作
  onFailure: continue  # continue | stop
```

## エラーハンドリング

```typescript
// ワーカーエラー時
try {
  await worker.execute(task, agent);
} catch (error) {
  if (options.onFailure === 'stop') {
    await executor.stop();
    throw error;
  }
  // continue: エラーを記録して次のタスクへ
  results.push({ taskId: task.id, status: 'failed', error });
}
```

## リソース管理

```typescript
// 同時実行数の制御
const semaphore = new Semaphore(options.workers);

async function runTask(task: Task) {
  await semaphore.acquire();
  try {
    return await worker.execute(task, agent);
  } finally {
    semaphore.release();
  }
}

// 全タスク並列実行
const results = await Promise.all(tasks.map(runTask));
```
