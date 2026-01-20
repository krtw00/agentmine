# Worktree & Scope Control

Git Worktreeを使ったWorker隔離とスコープ制御。

## 概要

Workerが作業する際、専用のworktreeを作成し、スコープに基づいてアクセス制御を適用する。

**Note:** Worktree管理は `agentmine worker run` が内部でgitを使用して行う。

## Design Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                    agentmineがgitを直接使用                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  【agentmineの役割】                                             │
│  - worktree作成/削除（git worktreeを内部実行）                   │
│  - スコープ適用（sparse-checkout + chmod）                      │
│  - 事後チェック用の情報提供                                     │
│                                                                  │
│  【Orchestratorの役割】                                          │
│  - `agentmine worker run` の実行                                │
│  - 事後チェック結果の参照（差分はagentmineが自動収集）          │
│  - 結果判断（マージ/失敗など）                                   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  【レベル1: sparse-checkout + 事後チェック】                     │
│  - exclude: sparse-checkoutで物理的に除外（存在しない）          │
│  - write: 明示的に指定されたファイルのみ編集可能                 │
│  - read: writeに含まれないファイルは参照のみ                     │
│  - 事後チェック: agentmineがgit diffでスコープ違反を検出         │
├─────────────────────────────────────────────────────────────────┤
│  【将来（レベル2）】                                              │
│  - Docker隔離による完全なアクセス制御                            │
└─────────────────────────────────────────────────────────────────┘
```

## スコープ定義

エージェント定義でスコープを指定:

```yaml
# coder.yaml (agent snapshot)
name: coder
scope:
  read:                    # 参照可能（全ファイル）
    - "**/*"
  write:                   # 編集可能（限定）
    - "src/**"
    - "tests/**"
    - "package.json"
  exclude:                 # アクセス不可（物理的に除外）
    - "**/*.env"
    - "**/secrets/**"
    - ".git/**"
```

### スコープ優先順位

```
exclude → read → write
```

| 優先度 | フィールド | 説明 |
|--------|-----------|------|
| 1（最優先） | `exclude` | マッチしたファイルはsparse-checkoutで物理的に除外 |
| 2 | `read` | マッチしたファイルは参照可能（worktreeに存在） |
| 3 | `write` | 明示的に指定されたファイルのみ編集可能 |

**重要:** タスクに分ける以上、編集場所は明確に指定する必要がある。writeは暗黙的に許可されず、必ず明示的に指定する。

### 物理的実装

| フィールド | 説明 | 物理的実装 |
|-----------|------|-----------|
| `exclude` | アクセス不可 | sparse-checkoutで除外（存在しない） |
| `read` | 参照可能なファイル | worktreeに存在 |
| `write` | 編集可能なファイル | 通常権限 |
| （暗黙） | read - write - exclude | read-only化（chmod a-w） |

## Worktree作成フロー

`agentmine worker run` が内部でgitを使用してworktreeを作成（実装例）:

```bash
# agentmineが内部で実行

# 1. ブランチ作成
git branch task-5-s123 develop

# 2. worktree作成（sparse-checkout有効）
git worktree add --sparse .agentmine/worktrees/task-5 task-5-s123

# 3. sparse-checkout設定（exclude対象を除外、Memory Bankは含める）
cd .agentmine/worktrees/task-5
git sparse-checkout set --no-cone \
  '/*' \
  '.agentmine/memory/**' \
  '!**/*.env' \
  '!**/secrets/**' \
  '!.git/**'

# 4. write対象外をread-only化
# Unix/macOS
find . -type f \
  ! -path './src/*' \
  ! -path './tests/*' \
  ! -name 'package.json' \
  -exec chmod a-w {} \;

# Windows
forfiles /S /M * /C "cmd /c attrib +R @path"
# 次にwrite対象のみ attrib -R で解除

# 5. AIクライアント設定を配置（必要な場合）
mkdir -p .claude
cat > .claude/CLAUDE.md << 'EOF'
# Worker: coder
...（promptContentの内容）
EOF
```

### クライアント固有コンテキスト（暫定枠）

promptContentはAIクライアントが自動で読み込む設定ファイルへ出力する。対応は順次追加する。

| client | config dir | context file | note |
|--------|------------|--------------|------|
| claude-code | `.claude/` | `CLAUDE.md` | 自動読込 |
| codex | (TBD) | (TBD) | placeholder |
| aider | (TBD) | (TBD) | placeholder |
| gemini | (TBD) | (TBD) | placeholder |
| opencode | (TBD) | (TBD) | placeholder |

## クロスプラットフォーム対応

### read-only化

```typescript
// packages/core/src/worktree/scope.ts

async function makeReadOnly(filePath: string): Promise<void> {
  if (process.platform === 'win32') {
    // Windows: attrib +R
    await exec(`attrib +R "${filePath}"`);
  } else {
    // Unix/macOS: chmod a-w
    await exec(`chmod a-w "${filePath}"`);
  }
}

async function makeWritable(filePath: string): Promise<void> {
  if (process.platform === 'win32') {
    await exec(`attrib -R "${filePath}"`);
  } else {
    await exec(`chmod u+w "${filePath}"`);
  }
}
```

### sparse-checkout

```typescript
async function applySparseCheckout(
  worktreePath: string,
  excludePatterns: string[]
): Promise<void> {
  const patterns = ['/*', ...excludePatterns.map(p => `!${p}`)];

  await exec(
    `git sparse-checkout set --no-cone ${patterns.map(p => `'${p}'`).join(' ')}`,
    { cwd: worktreePath }
  );
}
```

## 事後チェック（Verify）

agentmineはWorker完了時にworktree内でgit diffを実行し、変更ファイル一覧を自動収集してスコープ違反を検出する。フルパッチは明示的オプションでのみ取得する。

```bash
# agentmine内部処理
cd .agentmine/worktrees/task-5
git diff --name-only HEAD
git diff --name-only --cached
git ls-files --others --exclude-standard
```

### 検証ロジック

```typescript
// packages/core/src/worktree/verify.ts

interface VerifyResult {
  valid: boolean;
  violations: Violation[];
  changedFiles: string[];
}

interface Violation {
  type: 'modified' | 'created' | 'deleted';
  path: string;
  reason: 'read-only' | 'excluded';
}

async function verifyWorktree(
  taskId: number,
  scope: AgentScope
): Promise<VerifyResult> {
  const worktreePath = `.agentmine/worktrees/task-${taskId}`;

  // 1. 変更ファイルを取得
  const changedFiles = await getChangedFiles(worktreePath);

  // 2. スコープと照合
  const violations: Violation[] = [];

  for (const file of changedFiles) {
    // exclude対象に変更があったら違反（本来存在しないはず）
    if (matchesPattern(file, scope.exclude)) {
      violations.push({
        type: 'modified',
        path: file,
        reason: 'excluded'
      });
      continue;
    }

    // write対象外に変更があったら違反
    if (!matchesPattern(file, scope.write)) {
      violations.push({
        type: 'modified',
        path: file,
        reason: 'read-only'
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    changedFiles
  };
}

async function getChangedFiles(worktreePath: string): Promise<string[]> {
  // staged + unstaged + untracked
  const result = await exec(
    'git diff --name-only HEAD && git diff --name-only --cached && git ls-files --others --exclude-standard',
    { cwd: worktreePath }
  );

  return [...new Set(result.stdout.split('\n').filter(Boolean))];
}
```

## Worktree構造

```
.agentmine/worktrees/
├── task-5/                     # タスク#5用
│   ├── .agentmine/
│   │   └── memory/             # Memory Bank（参照用、read-only）
│   │       ├── architecture/
│   │       │   └── tech-stack.md
│   │       └── convention/
│   │           └── coding-style.md
│   │   # agents/, settings snapshot, prompts/ はスナップショットのため除外
│   ├── .claude/                # Claude Code設定
│   │   ├── settings.json
│   │   └── CLAUDE.md           # promptContentから生成
│   ├── src/                    # write可能
│   ├── tests/                  # write可能
│   ├── package.json            # write可能
│   ├── docs/                   # read-only (chmod a-w)
│   ├── README.md               # read-only
│   └── tsconfig.json           # read-only
│   # .env, secrets/ は存在しない（sparse-checkout）
│
├── task-6/                     # タスク#6用
│   └── ...
```

**Note:** `.agentmine/memory/`はWorkerがプロジェクト決定事項を参照するために含まれる。エージェント定義や設定のスナップショットは除外。

## セキュリティ考慮事項

### 突破可能性

| 攻撃ベクトル | 対策 | 効果 |
|-------------|------|------|
| `chmod u+w` で解除 | 事後チェック | 検出可能 |
| `git sparse-checkout disable` | 事後チェック | 検出可能 |
| 直接ファイル作成 | 事後チェック | 検出可能 |

### 想定脅威モデル

```
【対策対象: 暴走】
- AIが意図せずスコープ外を編集
- 多くのケースはこれ
- 事後チェックで十分検出可能

【対策対象外: 悪意】
- AIが意図的に制限を突破
- レベル1では防げない
- レベル2（Docker）で対応
```

## 将来: Docker隔離（レベル2）

```yaml
# settings snapshot (import/export)
execution:
  parallel:
    isolation: docker    # worktree | docker
    docker:
      image: node:20
      memory: 4g
      cpu: 2
      user: worker       # non-root
```

```
┌──────────────────────────────────────────────────────────────┐
│  Host                                                        │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   Container      │  │   Container      │                 │
│  │   Task #5        │  │   Task #6        │                 │
│  │   ┌──────────┐   │  │   ┌──────────┐   │                 │
│  │   │ Worker   │   │  │   │ Worker   │   │                 │
│  │   └──────────┘   │  │   └──────────┘   │                 │
│  │   /workspace     │  │   /workspace     │                 │
│  │   (scope強制)    │  │   (scope強制)    │                 │
│  └──────────────────┘  └──────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

## References

- [Agent System](./agent-system.md)
- [Parallel Execution](./parallel-execution.md)
- [Agent Execution](./agent-execution.md)
