# Agent Execution Flow

Orchestrator/Workerモデルによるタスク実行フロー。

## Design Philosophy

**AIがオーケストレーター**であり、agentmineはデータ層（Blackboard）として機能する。

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Orchestrator/Worker Execution Model              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【設計方針】                                                        │
│  - AI as Orchestrator: Orchestrator（メインAI）がタスク分解・Worker管理│
│  - agentmine as Blackboard: データ層・状態管理のみ                  │
│  - Workerはagentmineにアクセスしない: タスク情報はプロンプトで渡す  │
│  - 客観判定: 観測可能な事実（exit code, マージ状態）で判定          │
│  - sparse-checkoutでスコープ制御: 物理削除ではなくgit機能を使用     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Architecture

### Orchestrator/Worker モデル

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Human (ユーザー)                                                    │
│    │                                                                │
│    ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  AI as Orchestrator (Claude Code, Codex等)                             │   │
│  │                                                               │   │
│  │  責務:                                                        │   │
│  │  - ユーザーとの会話                                           │   │
│  │  - タスク分解・計画                                           │   │
│  │  - Worker起動・監視                                           │   │
│  │  - 結果確認・マージ                                           │   │
│  │  - PR作成                                                     │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│          ┌──────────────────┼──────────────────┐                   │
│          ▼                  ▼                  ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │   Worker    │    │   Worker    │    │   Worker    │            │
│  │  (Task #1)  │    │  (Task #2)  │    │  (Task #3)  │            │
│  │  worktree-1 │    │  worktree-2 │    │  worktree-3 │            │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘            │
│         │                  │                  │                    │
│         └──────────────────┴──────────────────┘                    │
│                            │                                        │
│                            ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   agentmine (Blackboard)                      │   │
│  │                                                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │   │
│  │  │  Tasks   │  │ Sessions │  │ Agents   │  │  Memory Bank │ │   │
│  │  │  状態    │  │  履歴    │  │  定義    │  │  決定事項    │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### agentmineの責務

| 責務 | 内容 |
|------|------|
| タスク管理 | CRUD、ステータス遷移、親子関係 |
| エージェント定義 | YAML読み込み、定義提供 |
| セッション記録 | 実行履歴、成果物記録 |
| Memory Bank | プロジェクト決定事項の永続化 |
| Workerコマンド生成 | タスク実行用のコマンド出力（`agentmine worker command`） |

### Orchestratorの責務（agentmine外）

| 責務 | 内容 |
|------|------|
| タスク分解 | PRDやユーザー指示からタスク生成 |
| Worktree作成 | git worktree add + sparse-checkout設定 |
| Worker起動 | サブプロセスとしてAIクライアントを起動 |
| 進捗監視 | Worker状態の確認（exit code, signal） |
| 結果マージ | ブランチのマージ、コンフリクト解決 |
| PR作成 | 完了タスクのPR作成 |
| Worktree削除 | 完了/失敗後にgit worktree remove |

## Execution Flow

### 1. タスク作成〜Worker起動

```
Orchestrator                    agentmine                      Git
 │                                  │                           │
 │  1. タスク作成                    │                           │
 │ ─────────────────────────────────>│                           │
 │  agentmine task add "..."         │                           │
 │                                   │                           │
 │  2. Workerコマンド取得            │                           │
 │ ─────────────────────────────────>│                           │
 │  agentmine worker command 1       │                           │
 │  (Memory Bank + タスク情報 → プロンプト生成)│                 │
 │                                   │                           │
 │  3. セッション開始記録            │                           │
 │ ─────────────────────────────────>│                           │
 │  agentmine session start 1 --agent coder                     │
 │                                   │                           │
 │  4. Worktree作成                  │                           │
 │ ────────────────────────────────────────────────────────────>│
 │  git worktree add .worktrees/task-1 -b task-1                │
 │  git sparse-checkout set (スコープ適用)                       │
 │                                   │                           │
 │  5. Worker起動（サブプロセス）                                 │
 │  claude-code --worktree .worktrees/task-1 --prompt "..."     │
 │                                   │                           │
```

### 2. Worker作業〜完了

```
Orchestrator                    agentmine                    Worker
 │                                  │                           │
 │                                  │  ※ Workerはagentmineに    │
 │                                  │    アクセスしない          │
 │                                  │                           │
 │  (Workerプロセスを監視)                                       │
 │                                  │                     (作業)│
 │                                  │                     commit│
 │                                  │                     push  │
 │                                  │                           │
 │  6. Worker終了検知                │                       exit│
 │<─────────────────────────────────────────────────────────────│
 │  exit code / signal を取得       │                           │
 │                                   │                           │
 │  7. セッション終了記録            │                           │
 │ ─────────────────────────────────>│                           │
 │  agentmine session end <id>       │                           │
 │    --exit-code 0 --artifacts ...  │                           │
 │                                   │                           │
 │  8. ステータス判定・更新          │                           │
 │ ─────────────────────────────────>│                           │
 │  (exit code == 0 && マージ可能 → done)                       │
 │  (exit code != 0 → failed)        │                           │
 │                                   │                           │
 │  9. Worktree削除                  │                           │
 │  git worktree remove .worktrees/task-1                       │
 │                                   │                           │
```

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

  // 3. エージェント専用プロンプト（promptFile展開）
  const promptContent = agentService.getPromptFileContent(agent);
  if (promptContent) {
    parts.push('## Agent Instructions');
    parts.push(promptContent);
  }

  // 4. スコープ情報
  parts.push('## Scope');
  parts.push(`- Read: ${agent.scope.read.join(', ')}`);
  parts.push(`- Write: ${agent.scope.write.join(', ')}`);
  parts.push(`- Exclude: ${agent.scope.exclude.join(', ')}`);

  // 5. Memory Bank（参照方式 - ファイルパスのみ）
  const memoryFiles = memoryService.listFiles();
  if (memoryFiles.length > 0) {
    parts.push('## Project Context (Memory Bank)');
    parts.push('The following project decision files are available:');
    for (const file of memoryFiles) {
      parts.push(`- ${file.path} - ${file.title}`);
    }
    parts.push('');
    parts.push('Read these files in .agentmine/memory/ for detailed project decisions.');
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
| Agent Instructions | エージェント固有の詳細指示 | prompts/*.md | 全文展開 |
| Scope | ファイルアクセス範囲 | agents/*.yaml | 全文 |
| Project Context | プロジェクト決定事項 | memory/*.md | **参照のみ** |
| Instructions | 共通の作業指示 | ハードコード | 全文 |

**Note:** Memory Bankはコンテキスト長削減のため参照方式（ファイルパスのみ）。Workerがworktree内の`.agentmine/memory/`を直接読むことで詳細を確認できる。

### コンテキスト不足による問題と対策

**問題:** Workerが十分なコンテキストを受け取らないと、モックデータを作成してしまう。

| 問題 | 原因 | 対策 |
|------|------|------|
| モックデータ作成 | 既存サービスの存在を知らない | promptFileに利用可能サービスを明記 |
| 不適切な実装 | プロジェクト規約を知らない | Memory Bankファイルの参照を促す |
| 汎用的すぎる指示 | エージェント固有指示がない | promptFile必須化 |

**ベストプラクティス:**
1. タスク作成時に`--description`で具体的な要件を記述
2. エージェントごとに詳細なpromptFileを用意（禁止事項、サービス利用例を含む）
3. Memory Bankにプロジェクト決定事項を充実させる（Workerが参照できる）

## Worktree + スコープ制御

### sparse-checkoutによるスコープ適用

```bash
# Orchestratorが直接gitコマンドを実行

# 1. worktree作成
git worktree add .worktrees/task-1 -b task-1-auth

# 2. sparse-checkout有効化
cd .worktrees/task-1
git sparse-checkout init --cone

# 3. スコープ適用（exclude→read→writeの優先順位）
#    エージェント定義のscopeに基づいてOrchestratorが設定
git sparse-checkout set src/ tests/ docs/ package.json
# excludeパターン（.env, secrets/等）は自動的に除外される

# 4. AIクライアント設定を配置
cp -r ~/.agentmine/client-configs/claude-code/ .worktrees/task-1/.claude/
# promptFile → CLAUDE.md に変換
```

### スコープ優先順位

```
exclude → read → write

【exclude】最優先。マッチしたファイルはsparse-checkoutで除外
【read】  次に評価。マッチしたファイルは参照可能
【write】 明示的に指定されたファイルのみ編集可能

※ writeに明示的にマッチしないファイルはread-only扱い
  （タスク分割時に編集対象を明確にするため）
```

### Worktree構造

```
.worktrees/
├── task-1/                     # タスク#1用
│   ├── .claude/                # Claude Code設定
│   │   ├── settings.json
│   │   └── CLAUDE.md           # promptFileから生成
│   ├── src/                    # write可能（スコープで指定時）
│   ├── tests/                  # write可能（スコープで指定時）
│   ├── docs/                   # read専用（sparse-checkoutに含まれるが編集不可）
│   └── package.json            # read専用
│   # .env, secrets/ は sparse-checkout で除外済み
│
├── task-2/                     # タスク#2用
│   └── ...
```

## 完了判定（Definition of Done）

### 基本原則

```
┌─────────────────────────────────────────────────────────────────────┐
│                     観測可能な事実のみで判定                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【判定に使わないもの】                                              │
│  ✗ Workerの発言 "完了しました" → 無視                               │
│  ✗ Orchestratorの判断 "これでOK" → 無視                             │
│                                                                     │
│  【判定に使うもの（観測可能な事実）】                                │
│  ✓ プロセスのexit code                                              │
│  ✓ プロセスが受信したsignal                                         │
│  ✓ ブランチのマージ状態                                             │
│  ✓ タイムアウト                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### ステータス判定ロジック

```typescript
// Orchestratorがこのロジックを実行
// agentmineはステータスの永続化のみ担当

type TaskStatus = 'open' | 'in_progress' | 'done' | 'failed' | 'cancelled';

function determineTaskStatus(session: Session, gitState: GitState): TaskStatus {
  // 1. failed判定（異常終了）
  if (session.exitCode !== 0) {
    return 'failed';  // exit code != 0
  }
  if (session.signal) {
    return 'failed';  // SIGTERM, SIGKILL等
  }
  if (session.dodResult === 'timeout') {
    return 'failed';  // タイムアウト
  }

  // 2. done判定（正常終了 && マージ済み）
  const isMerged = gitState.branchMergedTo(task.branchName, config.baseBranch);
  if (session.exitCode === 0 && isMerged) {
    return 'done';
  }

  // 3. それ以外はin_progress維持
  return 'in_progress';
}
```

### DoD検証（Orchestratorが実行）

```yaml
# .agentmine/config.yaml

# Definition of Done (プロジェクト全体)
# Orchestratorがマージ前に検証
dod:
  timeout: 300  # 5分（秒）
  checks:
    - type: lint_passes
      command: npm run lint
    - type: build_succeeds
      command: npm run build
    - type: tests_pass
      command: npm test

# タスクタイプ別ルール
task_types:
  bug:
    goals:
      - type: test_added
        pattern: "**/*.test.*"
  feature:
    goals:
      - type: files_changed
        pattern: "src/**/*"
```

### DoD実行タイミング

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DoD検証タイミング                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Worker終了後、マージ前にOrchestratorが実行                         │
│                                                                     │
│  1. Worker終了（exit code 0）                                       │
│  2. Orchestratorがworktreeでlint/build/testを実行                   │
│  3. 全てパス → マージ実行                                           │
│  4. マージ成功 → task status = done                                 │
│                                                                     │
│  ※ DoD失敗時はOrchestratorが判断（再試行 or failed）                │
│  ※ agentmineはDoD実行しない（Blackboard）                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### セッション記録項目

```typescript
// sessions テーブルに記録（観測可能な事実）
interface SessionRecord {
  exitCode: number | null;    // プロセス終了コード
  signal: string | null;      // 終了シグナル（SIGTERM等）
  dodResult: 'pending' | 'merged' | 'timeout' | 'error';
  artifacts: string[];        // 変更ファイル（worktree相対パス）
  error: SessionError | null; // エラー詳細
}
```

## タスクステータス遷移

```
┌──────┐     ┌───────────┐     ┌──────┐
│ open │────▶│in_progress│────▶│ done │
└──────┘     └───────────┘     └──────┘
                  │
                  │ (Worker異常終了)
                  ▼
             ┌──────────┐
             │  failed  │
             └──────────┘

Any state → cancelled
failed → open (再試行時)
```

| 遷移 | トリガー | 判定基準 |
|------|----------|----------|
| open → in_progress | Worker起動 | agentmine session start |
| in_progress → done | マージ完了 | git log baseBranch..branch が空 |
| in_progress → failed | Worker異常終了 | exit code != 0 or signal or timeout |
| failed → open | 再試行指示 | 人間またはOrchestratorが明示的に指示 |
| * → cancelled | キャンセル | 人間またはOrchestratorが明示的に指示 |

**Note:** review/blockedステータスは削除。Orchestratorの主観的判断に依存するため。

## CLI コマンド

### Orchestrator向けコマンド

```bash
# タスク管理
agentmine task list --json
agentmine task add "タイトル" -t feature
agentmine task update <id> --status done

# エージェント定義取得
agentmine agent list
agentmine agent show coder --format yaml

# Workerコマンド生成（プロンプト出力）
agentmine worker command <task-id> --agent coder

# セッション記録
agentmine session start <task-id> --agent coder
agentmine session end <session-id> \
  --exit-code 0 \
  --signal "" \
  --dod-result merged \
  --artifacts '["src/auth.ts", "tests/auth.test.ts"]'

# Memory Bank
agentmine memory list --json
agentmine memory preview
```

**Note:**
- `agentmine worktree` コマンドは削除。Orchestratorがgitを直接使用。
- Worker向けコマンドは存在しない。Workerはagentmineにアクセスしない。

## Worker終了方針

### 基本方針

```
exec mode + timeout の組み合わせ

1. AIクライアントのexec/非対話モードで起動
   → タスク完了時に自動終了
2. タイムアウト設定（デフォルト5分）
   → 無限ループ防止
3. タイムアウト時はSIGTERMで graceful shutdown
```

### 実行例

```bash
# Orchestratorが実行
TASK_ID=1

# 1. セッション開始（Worker起動前）
SESSION_ID=$(agentmine session start $TASK_ID --agent coder --quiet)

# 2. worktreeに移動
cd .worktrees/task-$TASK_ID

# 3. プロンプト取得（agentmine worker commandでタスク情報を含むプロンプト生成）
PROMPT=$(agentmine worker command $TASK_ID)

# 4. exec modeで起動（タイムアウト付き）
timeout --signal=SIGTERM 300 claude-code exec "$PROMPT"
# または
timeout --signal=SIGTERM 300 codex exec "$PROMPT"

# 5. exit code取得
EXIT_CODE=$?

# 6. セッション終了（結果記録）
if [ $EXIT_CODE -eq 124 ]; then
  # タイムアウト（exit code 124 = timeout）
  agentmine session end $SESSION_ID --exit-code $EXIT_CODE --dod-result timeout
elif [ $EXIT_CODE -eq 0 ]; then
  # 正常終了 → マージ判定はOrchestratorが別途行う
  agentmine session end $SESSION_ID --exit-code $EXIT_CODE --dod-result pending
else
  # 異常終了
  agentmine session end $SESSION_ID --exit-code $EXIT_CODE --dod-result error
fi
```

### AIクライアント別対応

| クライアント | exec mode | コマンド例 |
|-------------|-----------|------------|
| Claude Code | `exec` サブコマンド | `claude-code exec "タスク"` |
| Codex | `exec` サブコマンド | `codex exec "タスク"` |
| Gemini CLI | `-i` なし | `gemini "タスク"` |

## References

- [Architecture](../architecture.md)
- [Agent System](./agent-system.md)
- [Parallel Execution](./parallel-execution.md)
- [Data Model](../data-model.md)
