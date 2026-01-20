# Worker Lifecycle（Worker実行ライフサイクル）

🎯 **SSOT**: Worker起動から完了までの全フローを記述する

agentmineのWorker実行ライフサイクルは、Orchestrator/Workerモデルに基づく。Orchestratorが`agentmine worker run`コマンドでWorkerを起動し、agentmineはworktree作成・スコープ適用・セッション記録を担当する。Workerは隔離された環境でコードを作成し、完了後にOrchestratorがマージ判断を行う。

---

## 前提知識

このドキュメントを読む前に、以下を理解しておくこと：

- **@../03-core-concepts/orchestrator-worker.md** - Orchestrator/Workerモデルの役割定義
- **@../03-core-concepts/scope-control.md** - スコープ制御の仕組み
- **@../03-core-concepts/observable-facts.md** - ステータス判定方法

---

## Workerライフサイクル概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Worker Lifecycle                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Phase 1: Preparation                                               │
│  ────────────────────────                                           │
│  1. Orchestrator: タスク取得                                         │
│  2. Orchestrator: agentmine worker run <task-id> 実行               │
│  3. agentmine: セッション開始（DB記録、ID確定）                     │
│  4. agentmine: ブランチ作成（task-<id>-s<sessionId>）               │
│  5. agentmine: Git worktree作成（.agentmine/worktrees/task-<id>/） │
│                                                                     │
│  Phase 2: Scope Application                                         │
│  ───────────────────────────                                        │
│  6. agentmine: sparse-checkout適用（excludeパターン除外）           │
│  7. agentmine: chmod適用（write対象外を読み取り専用に）             │
│  8. agentmine: Memory Bank出力（.agentmine/memory/）                │
│  9. agentmine: クライアント設定出力（.claude/CLAUDE.md等）          │
│                                                                     │
│  Phase 3: Worker Execution                                          │
│  ──────────────────────────                                         │
│  10. agentmine: Worker AI起動（claude-code exec等）                 │
│  11. Worker: コード作成・テスト追加                                  │
│  12. Worker: git commit                                             │
│  13. Worker: 終了（exit code返却）                                  │
│                                                                     │
│  Phase 4: Completion                                                │
│  ────────────────────                                               │
│  14. agentmine: exit code記録（sessions.exit_code）                 │
│  15. agentmine: 成果物収集（git diff）                              │
│  16. Orchestrator: DoD検証（lint/test/build）                       │
│  17. Orchestrator: マージ判断・実行                                  │
│  18. Orchestrator: agentmine worker done <task-id>（クリーンアップ）│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Preparation（準備フェーズ）

### 1.1 Orchestratorによるタスク取得

```bash
# Orchestratorがタスク一覧を取得
agentmine task list --json

# または特定タスク詳細取得
agentmine task show 5 --json
```

**取得情報**:
- タスクID、タイトル、説明
- タスクタイプ（feature/bug/refactor）
- 優先度
- 依存関係（dependsOn）
- 割り当てエージェント

### 1.2 Worker起動コマンド

```bash
# フォアグラウンド実行（完了を待機）
agentmine worker run <task-id> --exec

# バックグラウンド実行（PID記録して即座に戻る）
agentmine worker run <task-id> --exec --detach
```

**オプション**:
- `--exec`: Worker AIを自動起動（省略時はプロンプト生成のみ）
- `--detach`: バックグラウンド実行（並列実行時に使用）
- `--agent <name>`: エージェント指定（デフォルト: タスクの割り当てエージェント）
- `--timeout <seconds>`: タイムアウト設定（デフォルト: 300秒）
- `--json`: JSON形式で出力

**出力例**:
```json
{
  "session": {
    "id": 123,
    "taskId": 5,
    "agentId": 2,
    "branch": "task-5-s123",
    "worktreePath": ".agentmine/worktrees/task-5",
    "status": "running",
    "pid": 12345
  }
}
```

### 1.3 セッション開始

`agentmine worker run`実行時、agentmineは以下をDB記録：

```typescript
// sessions テーブルに挿入
const session = await db.insert(sessions).values({
  taskId: task.id,
  agentId: agent.id,
  branch: `task-${task.id}-s${nextSessionId}`,
  worktreePath: `.agentmine/worktrees/task-${task.id}`,
  status: 'running',
  startedAt: new Date(),
  pid: null, // Worker起動後に更新
}).returning();
```

### 1.4 ブランチ作成

```bash
# agentmineが内部で実行
git branch task-5-s123 origin/develop
```

**命名規則**: `task-<taskId>-s<sessionId>`
- 複数セッション（リトライ）を区別可能
- セッションIDはDB auto incrementで一意

### 1.5 Git worktree作成

```bash
# agentmineが内部で実行
git worktree add .agentmine/worktrees/task-5 task-5-s123
```

**worktreeパス構造**:
```
.agentmine/worktrees/
└── task-5/                     # タスク#5用
    ├── .git                    # worktree固有のGit情報
    ├── src/                    # (sparse-checkout後)
    ├── tests/                  # (sparse-checkout後)
    ├── package.json            # (sparse-checkout後)
    └── .agentmine/             # Worker用データ（read-only）
        └── memory/             # Memory Bankスナップショット
            ├── architecture/
            │   └── 1.md
            └── tooling/
                └── 2.md
```

---

## Phase 2: Scope Application（スコープ適用フェーズ）

### 2.1 スコープ適用の目的

物理的にファイルアクセスを制限し、Worker AIの自動承認モード（`--dangerously-skip-permissions`等）を安全に使用する。

**優先順位**: `exclude` → `read` → `write`

### 2.2 sparse-checkout適用（exclude）

```bash
# agentmineが内部で実行
cd .agentmine/worktrees/task-5

# sparse-checkout有効化
git sparse-checkout init --cone

# エージェント定義のscopeに基づいて設定
# excludeパターンは自動的に除外される
git sparse-checkout set src/ tests/ docs/ package.json
```

**エージェント定義例**:
```yaml
# coder.yaml (DB内agents.scopeから生成)
name: coder
scope:
  exclude:                 # sparse-checkoutで物理的に除外
    - "**/*.env"
    - "**/secrets/**"
    - "**/.env.*"
  read:                    # worktreeに存在、参照可能
    - "**/*"
  write:                   # 編集可能（明示的指定が必要）
    - "src/**"
    - "tests/**"
    - "package.json"
```

**sparse-checkout動作**:
1. `exclude`にマッチするファイルは物理的に存在しない
2. `read`にマッチするファイルのみworktreeに展開
3. `exclude`が最優先（`read: ["**/*"]`でも除外される）

### 2.3 chmod適用（write制御）

`write`に明示的にマッチしないファイルは読み取り専用にする：

```bash
# agentmineが内部で実行
cd .agentmine/worktrees/task-5

# write対象外を読み取り専用に
find . -type f ! -path "src/*" ! -path "tests/*" ! -name "package.json" -exec chmod a-w {} \;

# または明示的にwrite対象のみ書き込み可能に
chmod a-w -R .
chmod u+w src/ tests/ package.json
```

**結果**:
- `src/`, `tests/`, `package.json`: 編集可能（rw-r--r--）
- `docs/`, `README.md`等: 読み取り専用（r--r--r--）
- `.env`, `secrets/`: 存在しない（sparse-checkoutで除外）

### 2.4 Memory Bank出力

```bash
# agentmineが内部で実行
cd .agentmine/worktrees/task-5

# DBからMemory Bank取得 → ファイル出力
mkdir -p .agentmine/memory
# status=activeのmemoriesのみ出力
```

**出力構造**:
```
.agentmine/memory/
├── architecture/
│   └── 1.md
├── conventions/
│   └── 5.md
└── tooling/
    └── 2.md
```

**注意**: `.agentmine/memory/`は読み取り専用。Workerがこれらを編集することはない。

### 2.5 クライアント設定出力

```bash
# agentmineが内部で実行
cd .agentmine/worktrees/task-5

# Claude Code用設定
mkdir -p .claude
cat > .claude/CLAUDE.md <<'EOF'
# Task #5: ログイン機能実装

## Description
POST /api/login でJWTトークンを返すAPIを実装してください。

## Agent Instructions
[agents.promptContentから取得]

## Memory Bank Summary
- [要約1]
- [要約2]

## Project Context (Memory Bank)
The following project context files are available:
- .agentmine/memory/architecture/1.md
- .agentmine/memory/conventions/5.md

Read these files for details.
EOF
```

**クライアント別ファイル名**:
- Claude Code: `.claude/CLAUDE.md`
- Codex: `.codex/CODEX.md`
- その他: `.agentmine/prompt.md`（汎用）

---

## Phase 3: Worker Execution（Worker実行フェーズ）

### 3.1 Worker AI起動

```bash
# agentmineが内部で実行
cd .agentmine/worktrees/task-5

# Claude Code起動例
timeout --signal=SIGTERM 300 \
  claude-code exec --dangerously-skip-permissions \
  "$(cat .claude/CLAUDE.md)"

# Codex起動例
timeout --signal=SIGTERM 300 \
  codex exec --full-auto \
  "$(cat .codex/CODEX.md)"
```

**対応AIクライアント**:
| クライアント | 実行コマンド | 自動承認フラグ |
|-------------|------------|--------------|
| Claude Code | `claude-code exec` | `--dangerously-skip-permissions` |
| Codex | `codex exec` | `--full-auto` |
| Aider | `aider` | `--yes` |
| Gemini CLI | `gemini` | `-y` |

**タイムアウト設定**:
- デフォルト: 300秒（5分）
- SIGTERMで graceful shutdown
- タイムアウト時のexit code: 124

### 3.2 Worker作業

Workerは以下の作業を行う：

1. **既存コード確認**: プロジェクト構造・実装パターンの理解
2. **コード作成**: タスク要件に従ってファイル作成・編集
3. **テスト追加**: 必要に応じてテストコード作成
4. **動作確認**: ローカルでlint/test実行（任意）
5. **コミット**: 変更をコミット

**Workerの制約**:
- agentmineコマンド実行不可（DBアクセスなし）
- worktree外のファイルアクセス不可
- スコープ外のファイルアクセス不可（物理的に制限）

### 3.3 Worker終了

Workerは作業完了後、自動的に終了する：

```bash
# Worker内部（擬似コード）
git add .
git commit -m "feat: ログイン機能実装

Co-Authored-By: Claude Code <claude-code@agentmine.local>"

# 正常終了
exit 0

# エラー終了
exit 1
```

**exit code**:
- `0`: 成功
- `1-255`: エラー（AIクライアント依存）
- `124`: タイムアウト（timeout コマンド）

---

## Phase 4: Completion（完了フェーズ）

### 4.1 exit code記録

```bash
# Orchestratorスクリプト（例）
EXIT_CODE=$?

# agentmineが自動記録（--exec使用時）
# または手動記録
agentmine session end $SESSION_ID \
  --exit-code $EXIT_CODE \
  --signal "" \
  --artifacts '["src/auth.ts", "tests/auth.test.ts"]'
```

**sessions テーブル更新**:
```typescript
await db.update(sessions)
  .set({
    status: exitCode === 0 ? 'completed' : 'failed',
    exitCode,
    completedAt: new Date(),
    duration: Date.now() - session.startedAt.getTime(),
  })
  .where(eq(sessions.id, sessionId));
```

### 4.2 成果物収集

```bash
# agentmineが内部で実行
cd .agentmine/worktrees/task-5

# 変更ファイル一覧取得
git diff --name-only HEAD

# 例: src/auth.ts, tests/auth.test.ts
```

**sessions.artifacts更新**:
```typescript
const { stdout } = await exec('git diff --name-only HEAD', {
  cwd: session.worktreePath,
});
const artifacts = stdout.trim().split('\n').filter(Boolean);

await db.update(sessions)
  .set({ artifacts })
  .where(eq(sessions.id, sessionId));
```

### 4.3 DoD（Definition of Done）検証

**重要**: DoD検証はOrchestratorが実行する。agentmineは実行しない。

```bash
# Orchestratorスクリプト（例）
cd .agentmine/worktrees/task-5

# lint実行
pnpm lint
if [ $? -ne 0 ]; then
  echo "Lint failed"
  exit 1
fi

# test実行
pnpm test
if [ $? -ne 0 ]; then
  echo "Tests failed"
  exit 1
fi

# build実行
pnpm build
if [ $? -ne 0 ]; then
  echo "Build failed"
  exit 1
fi

echo "DoD passed"
```

**DoD判定結果**:
- `merged`: 全チェック合格、マージ成功
- `timeout`: DoD実行がタイムアウト
- `error`: DoD失敗（lint/test/build失敗）

### 4.4 マージ判断

**Orchestratorの責務**: DoD合格後、マージ実行を判断する。

```bash
# Orchestratorスクリプト（例）
git checkout develop
git merge task-5-s123

if [ $? -eq 0 ]; then
  echo "Merge successful"
  agentmine session end $SESSION_ID --dod-result merged
else
  echo "Merge conflict"
  # Orchestratorがコンフリクト解決するか、失敗扱いにするか判断
fi
```

**タスクステータス自動判定**:
```bash
# マージ後、agentmineが自動判定
git log --oneline develop..task-5-s123

# 結果が空 → マージ済み → task status = done
# 結果があり → まだマージされていない → task status = in_progress
```

### 4.5 完了処理・クリーンアップ

```bash
# Orchestratorが実行
agentmine worker done 5
```

**内部動作**:
1. worktree削除（`git worktree remove .agentmine/worktrees/task-5`）
2. ブランチ削除（オプション、デフォルトはマージ後に削除）
3. セッションステータス確認（既に`completed`/`failed`であることを確認）

---

## 完全な実行例

### 単一Worker実行（フォアグラウンド）

```bash
# 1. Orchestratorがタスク取得
TASK_INFO=$(agentmine task show 5 --json)
echo "$TASK_INFO" | jq

# 2. Worker起動（フォアグラウンド）
agentmine worker run 5 --exec --json > run_result.json

# 3. 結果確認
SESSION_ID=$(cat run_result.json | jq -r '.session.id')
EXIT_CODE=$(cat run_result.json | jq -r '.session.exitCode')

# 4. DoD検証
cd .agentmine/worktrees/task-5
pnpm lint && pnpm test && pnpm build
DOD_RESULT=$?

# 5. マージ
cd ../..
if [ $DOD_RESULT -eq 0 ]; then
  git checkout develop
  git merge task-5-s$SESSION_ID
  agentmine session end $SESSION_ID --dod-result merged
else
  agentmine session end $SESSION_ID --dod-result error
fi

# 6. クリーンアップ
agentmine worker done 5
```

### 並列Worker実行（バックグラウンド）

```bash
# 1. 3つのタスクを並列起動
agentmine worker run 3 --exec --detach --json > task3.json &
agentmine worker run 4 --exec --detach --json > task4.json &
agentmine worker run 5 --exec --detach --json > task5.json &

# 2. 完了待ち
agentmine worker wait 3 4 5

# 3. 各タスクのDoD検証 + マージ（順次）
for TASK_ID in 3 4 5; do
  SESSION_ID=$(cat task$TASK_ID.json | jq -r '.session.id')

  # DoD検証
  cd .agentmine/worktrees/task-$TASK_ID
  pnpm lint && pnpm test && pnpm build
  DOD_RESULT=$?
  cd ../..

  # マージ
  if [ $DOD_RESULT -eq 0 ]; then
    git checkout develop
    git merge task-$TASK_ID-s$SESSION_ID
    agentmine session end $SESSION_ID --dod-result merged
  else
    agentmine session end $SESSION_ID --dod-result error
  fi

  # クリーンアップ
  agentmine worker done $TASK_ID
done
```

---

## プロンプト生成詳細

### buildPromptFromTask()

`agentmine worker run`実行時、以下の情報を統合してプロンプトを生成する。

```typescript
interface BuildPromptOptions {
  task: Task;
  agent: AgentDefinition;
  memoryService: MemoryService;
}

async function buildPromptFromTask(options: BuildPromptOptions): Promise<string> {
  const { task, agent, memoryService } = options;
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
  if (agent.promptContent) {
    parts.push('## Agent Instructions');
    parts.push(agent.promptContent);
  }

  // 4. スコープ情報
  parts.push('## Scope');
  parts.push(`- Read: ${agent.scope.read.join(', ')}`);
  parts.push(`- Write: ${agent.scope.write.join(', ')}`);
  parts.push(`- Exclude: ${agent.scope.exclude.join(', ')}`);

  // 5. Memory Bank（要約 + 参照一覧）
  const memorySummary = await memoryService.buildSummary({
    status: 'active',
    maxItems: 5,
  });
  if (memorySummary.length > 0) {
    parts.push('## Memory Bank Summary');
    parts.push(...memorySummary);
  }

  const memoryFiles = await memoryService.listFiles({ status: 'active' });
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
| Task Header | タスクID、タイトル、タイプ、優先度 | `tasks`テーブル | 全文 |
| Description | タスクの詳細説明 | `tasks.description` | 全文 |
| Agent Instructions | エージェント固有の詳細指示 | `agents.promptContent` (DB) | 全文 |
| Scope | ファイルアクセス範囲 | `agents.scope` (DB) | 全文 |
| Project Context | プロジェクト決定事項 | Memory Bank（DB → `.agentmine/memory`） | **要約 + 参照一覧** |
| Instructions | 共通の作業指示 | ハードコード | 全文 |

**重要**: Memory BankはDBがマスター。`worker run`実行時に`.agentmine/memory/`をスナップショット生成し、`status=active`のみ短い要約と参照一覧を注入する。詳細はファイルを参照する。

---

## ステータス判定

### タスクステータス遷移

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
failed → in_progress (再試行時)
```

### ステータス判定ロジック

```typescript
type TaskStatus = 'open' | 'in_progress' | 'done' | 'failed' | 'cancelled';

async function computeTaskStatus(taskId: number, baseBranch: string): Promise<TaskStatus> {
  // 1. タスクのセッション一覧取得
  const sessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.taskId, taskId));

  if (sessions.length === 0) {
    return 'open';
  }

  // 2. 手動キャンセルチェック
  if (sessions.some(s => s.status === 'cancelled')) {
    return 'cancelled';
  }

  // 3. Git判定: マージ済みか？
  const mergedSession = sessions.find(s => s.dodResult === 'merged');
  if (mergedSession) {
    // ダブルチェック: Git側でも確認
    const { stdout } = await exec(
      `git log --oneline ${baseBranch}..${mergedSession.branch}`
    );
    if (stdout.trim() === '') {
      return 'done';
    }
  }

  // 4. running セッション確認
  const runningSessions = sessions.filter(s => {
    if (!s.pid) return false;
    try {
      process.kill(s.pid, 0); // シグナル0で存在確認のみ
      return true;
    } catch {
      return false;
    }
  });

  if (runningSessions.length > 0) {
    return 'in_progress';
  }

  // 5. 失敗/取消のみ → failed
  const allFailedOrCancelled = sessions.every(
    s => s.status === 'failed' || s.status === 'cancelled'
  );

  if (allFailedOrCancelled) {
    return 'failed';
  }

  // 6. デフォルト: in_progress
  return 'in_progress';
}
```

**判定基準**:
- `open`: セッションなし
- `in_progress`: runningセッションが1つ以上
- `done`: `git log baseBranch..branch`が空（マージ済み）
- `failed`: runningなし、mergedなし、失敗/取消のみ
- `cancelled`: 手動キャンセル（唯一の例外）

詳細: **@../03-core-concepts/observable-facts.md**

---

## よくある質問

### Q1: Worker runとWorker promptの違いは？

**A**:
- `worker run --exec`: worktree作成 + scope適用 + Worker AI起動 + 完了待機
- `worker prompt`: プロンプト生成のみ（手動Worker運用時に使用）

### Q2: --detachオプションはいつ使う？

**A**: 並列実行時に使用。複数のWorkerをバックグラウンドで起動し、後で`worker wait`で完了を待つ。

```bash
agentmine worker run 3 --exec --detach
agentmine worker run 4 --exec --detach
agentmine worker wait 3 4
```

### Q3: Workerが失敗したらどうなる？

**A**: agentmineがセッションを`failed`に記録し、Orchestratorに通知。リトライ判断はOrchestratorが行う。

```bash
# リトライ例
agentmine worker run 5 --exec  # 新しいセッションで再実行
```

### Q4: worktree削除のタイミングは？

**A**: `agentmine worker done`実行時。自動削除は設定で制御可能。

```yaml
# settings
execution:
  parallel:
    worktree:
      cleanup: true  # 完了後に自動削除（デフォルト）
```

### Q5: Workerはagentmineコマンドを実行できる？

**A**: いいえ、できません。Workerは完全に隔離されており、DBアクセスもありません。

---

## 関連ドキュメント

- **@../03-core-concepts/orchestrator-worker.md** - Orchestrator/Workerモデルの役割定義
- **@../03-core-concepts/scope-control.md** - スコープ制御の仕組み
- **@../03-core-concepts/observable-facts.md** - ステータス判定方法
- **@parallel-execution.md** - 並列実行の詳細（複数Worker同時実行）
- **@../05-features/agent-system.md** - エージェント定義
- **@../05-features/memory-bank.md** - Memory Bank
- **@../06-interfaces/cli/commands.md** - CLIコマンドリファレンス
