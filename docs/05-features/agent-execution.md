# Agent Execution Flow

Orchestrator/Workerモデルによるタスク実行フロー。

🔗 **Worker実行の詳細は @../07-runtime/worker-lifecycle.md を参照**

## Design Philosophy

**AIがオーケストレーター**であり、agentmineはデータ層（Blackboard）として機能する。詳細は **@../02-architecture/design-principles.md** を参照。

## Architecture

詳細なアーキテクチャと役割定義は **@../03-core-concepts/orchestrator-worker.md** を参照。

### agentmineの責務

| 責務 | 内容 |
|------|------|
| タスク管理 | CRUD、ステータス遷移、親子関係 |
| エージェント定義 | DB読み込み、定義提供（YAMLは編集/インポート用） |
| セッション記録 | 実行履歴、成果物記録 |
| Memory Bank | プロジェクト決定事項の永続化 |
| Worker環境準備 | worktree作成・スコープ適用（`worker run`） |
| プロンプト生成 | `worker run` / `worker prompt` |

### Orchestratorの責務（agentmine外）

| 責務 | 内容 |
|------|------|
| タスク分解 | PRDやユーザー指示からタスク生成 |
| Worker起動 | `agentmine worker run --exec` を実行 |
| 進捗監視 | Worker状態の確認（exit code, signal） |
| 結果マージ | ブランチのマージ、コンフリクト解決 |
| PR作成 | 完了タスクのPR作成 |

## Execution Flow

Worker起動から完了までの詳細フローは **@../07-runtime/worker-lifecycle.md** を参照。

## Workerプロンプト生成

### buildPromptFromTask()

`worker run`コマンド実行時、以下の情報を統合してWorkerプロンプトを生成する。

```typescript
interface BuildPromptOptions {
  task: Task;
  agent: AgentDefinition;
  memoryService: MemoryService;
  agentService: AgentService;
}

async function buildPromptFromTask(options: BuildPromptOptions): Promise<string> {
  const { task, agent, memoryService, agentService } = options;
  const parts: string[] = [];

  // 1. タスク基本情報
  parts.push(`# Task #${task.id}: ${task.title}`);
  parts.push(`Type: ${task.type} | Priority: ${task.priority}`);

  // 2. 説明
  if (task.description) {
    parts.push('## Description');
    parts.push(task.description);
  }

  // 3. エージェント専用プロンプト（DB内promptContent）
  const promptContent = agent.promptContent;
  if (promptContent) {
    parts.push('## Agent Instructions');
    parts.push(promptContent);
  }

  // 4. スコープ情報
  parts.push('## Scope');
  parts.push(`- Read: ${agent.scope.read.join(', ')}`);
  parts.push(`- Write: ${agent.scope.write.join(', ')}`);
  parts.push(`- Exclude: ${agent.scope.exclude.join(', ')}`);

  // 5. Memory Bank（要約 + 参照一覧）
  const memorySummary = memoryService.buildSummary({
    status: 'active',
    maxItems: 5,
  });
  if (memorySummary.length > 0) {
    parts.push('## Memory Bank Summary');
    parts.push(...memorySummary);
  }

  const memoryFiles = memoryService.listFiles({ status: 'active' });
  if (memoryFiles.length > 0) {
    parts.push('## Project Context (Memory Bank)');
    parts.push('The following project context files are available:');
    for (const file of memoryFiles) {
      parts.push(`- ${file.path} - ${file.title}`);
    }
    parts.push('');
    parts.push('Read these files in .agentmine/memory/ for details.');
  }

  // 6. 基本指示
  parts.push('## Instructions');
  parts.push('1. 既存の実装パターンを確認してから作業開始');
  parts.push('2. モックデータは作成しない - 必ず既存サービスを使用');
  parts.push('3. テストが全てパスすることを確認');
  parts.push('4. 完了したらコミット');

  return parts.join('\n\n');
}
```

### プロンプト構成要素

| セクション | 内容 | 出典 | 展開方式 |
|-----------|------|------|----------|
| Task Header | タスクID、タイトル、タイプ、優先度 | tasks テーブル | 全文 |
| Description | タスクの詳細説明 | tasks.description | 全文 |
| Agent Instructions | エージェント固有の詳細指示 | agents.promptContent (DB) | 全文 |
| Scope | ファイルアクセス範囲 | agents.scope (DB) | 全文 |
| Project Context | プロジェクト決定事項 | Memory Bank（DB → .agentmine/memory） | **要約 + 参照一覧** |
| Instructions | 共通の作業指示 | ハードコード | 全文 |

**Note:** Memory BankはDBがマスター。`worker run` 実行時に `.agentmine/memory/` をスナップショット生成し、`status=active` のみ短い要約と参照一覧を注入する。詳細はファイルを参照する。

### コンテキスト不足による問題と対策

**問題:** Workerが十分なコンテキストを受け取らないと、モックデータを作成してしまう。

| 問題 | 原因 | 対策 |
|------|------|------|
| モックデータ作成 | 既存サービスの存在を知らない | promptContentに利用可能サービスを明記 |
| 不適切な実装 | プロジェクト規約を知らない | Memory Bankファイルの参照を促す |
| 汎用的すぎる指示 | エージェント固有指示がない | promptContent必須化 |

**ベストプラクティス:**
1. タスク作成時に`--description`で具体的な要件を記述
2. エージェントごとに詳細なpromptContentを用意（禁止事項、サービス利用例を含む）
3. Memory Bankにプロジェクト決定事項を充実させる（Workerが参照できる）

## Worktree + スコープ制御

詳細は **@../07-runtime/worker-lifecycle.md** (Phase 2: Scope Application) および **@../03-core-concepts/scope-control.md** を参照。

## 完了判定（Definition of Done）

完了判定・ステータス遷移の詳細は以下を参照：
- **@../03-core-concepts/observable-facts.md** - Observable & Deterministic原則、ステータス自動判定ロジック
- **@../07-runtime/worker-lifecycle.md** (Phase 4: Completion) - DoD検証フロー

## CLI コマンド

### Orchestrator向けコマンド

```bash
# タスク管理
agentmine task list --json
agentmine task add "タイトル" -t feature
agentmine task update <id> --labels blocked,needs_review

# エージェント定義取得
agentmine agent list
agentmine agent show coder --format yaml

# Worker実行
agentmine worker run <task-id> --exec
agentmine worker prompt <task-id> --agent coder
agentmine worker done <task-id>

# セッション記録（詳細に記録したい場合）
agentmine session end <session-id>   --exit-code 0   --signal ""   --dod-result merged   --artifacts '["src/auth.ts", "tests/auth.test.ts"]'

# Memory Bank
agentmine memory list --json
agentmine memory preview
```

**Note:**
- worktreeは `worker run` / `worker cleanup` が内部で管理する。
- Worker向けコマンドは存在しない。Workerはagentmineにアクセスしない。
- `session start` は手動運用時のみ使用。

## Worker終了方針

Worker起動・終了の詳細は **@../07-runtime/worker-lifecycle.md** (Phase 3: Worker Execution) を参照。

## References

- **@../07-runtime/worker-lifecycle.md** - Worker実行ライフサイクル（SSOT）
- **@../03-core-concepts/orchestrator-worker.md** - Orchestrator/Workerモデル
- **@../03-core-concepts/observable-facts.md** - Observable & Deterministic原則
- **@./parallel-execution.md** - 並列実行
- **@./agent-system.md** - エージェント定義
- **@../architecture.md** - システム概要
