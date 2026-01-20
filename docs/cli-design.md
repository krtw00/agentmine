# CLI Design

## Overview

agentmine CLIは **Orchestrator AI / スクリプト専用** のインターフェース。

```
┌─────────────────────────────────────────────────────────────┐
│  インターフェースの役割分担                                   │
│                                                             │
│  人間        → Web UI      （ブラウザで完結）               │
│  Orchestrator → CLI / MCP  （自動化・並列制御）             │
│                                                             │
│  人間がCLIを使う必要はない                                   │
└─────────────────────────────────────────────────────────────┘
```

### 想定ユーザー

| ユーザー | インターフェース | 用途 |
|----------|------------------|------|
| **Orchestrator AI** | CLI / MCP | タスク管理、Worker起動、並列制御 |
| **シェルスクリプト** | CLI | 自動化、CI/CD連携 |
| **MCP経由** | CLI (内部) | Orchestratorからの直接呼び出し |

### 人間が直接使わない理由

- **繰り返し処理**: スクリプト化すべき → Orchestratorが担当
- **状態確認**: Web UIの方が視認性が高い
- **タスク管理**: Web UIの方が効率的

## Design Principles

### 1. AI-First Output

**デフォルトでAI/スクリプトに最適化。** 人間向けフォーマットは補助的。

```bash
# デフォルト: 機械可読（パイプ連携しやすい）
agentmine task list
# ID    STATUS       TITLE
# 1     open         認証機能実装
# 2     in_progress  API設計

# --json: 構造化データ（Orchestrator向け推奨）
agentmine task list --json

# --quiet: IDのみ（スクリプト用）
agentmine task add "タスク" --quiet  # → "1"

# --pretty: 人間向け（デバッグ時のみ）
agentmine task list --pretty
```

### 2. Composable for Automation

```bash
# Orchestratorが実行するパイプライン
agentmine task add "認証機能" --quiet | xargs -I {} agentmine worker run {} --exec --detach

# 並列実行パターン
agentmine worker run 1 --exec --detach
agentmine worker run 2 --exec --detach
agentmine worker wait 1 2

# 結果の条件分岐
if agentmine worker status 1 --json | jq -e '.status == "completed"'; then
  agentmine worker done 1
fi
```

### 3. Predictable Interface

```bash
# 一貫したサブコマンド構造
agentmine <resource> <action> [args] [options]

# 一貫したオプション
--json      # 全コマンドで使用可能
--quiet     # 最小出力（ID等のみ）
--pretty    # 人間向けフォーマット（デバッグ用）
```

## Command Structure

```
agentmine
├── init                    # プロジェクト初期化
├── task                    # タスク管理
│   ├── add
│   ├── list
│   ├── get
│   ├── show
│   ├── update
│   └── delete
├── agent                   # エージェント定義管理
│   ├── list
│   └── show
├── worker                  # Worker環境管理（エージェント非依存）
│   ├── run                 # worktree作成＋指示表示
│   ├── done                # タスク完了＋クリーンアップ
│   ├── list                # アクティブworktree一覧
│   ├── cleanup             # worktree削除
│   ├── prompt              # プロンプト生成
│   └── context             # タスクコンテキスト表示
├── session                 # セッション管理
│   ├── list
│   ├── show
│   ├── start
│   ├── end
│   └── cleanup
├── memory                  # Memory Bank（プロジェクト決定事項）
│   ├── list
│   ├── add
│   ├── edit
│   ├── remove
│   └── preview
├── db                      # データベース管理
│   ├── migrate
│   └── reset
├── mcp                     # MCPサーバー（CLIラッパー）
│   └── serve
└── ui                      # Web UI起動
```

**Note:**
- `skill` コマンドは削除。スキル管理は agentmine の範囲外。
- `agent run` コマンドは削除。Worker起動は `agentmine worker run` に統一。
- `task run` コマンドは削除。`agentmine worker run` が実行入口。
- `worktree` コマンドは削除。worktree作成/削除は `worker run`/`worker cleanup` が内部で実行。
- `task start/done/assign` コマンドは削除。ステータス更新はobservable factsに基づく。
- `errors` コマンドは削除。sessionsテーブルで管理。

## Command Details

### init

```bash
agentmine init [options]

Options:
  --name <name>       プロジェクト名
  --template <name>   テンプレート (default, minimal, full)
  --force             既存設定を上書き

Examples:
  agentmine init
  agentmine init --name "My Project" --template full
```

**動作:**
1. `.agentmine/` ディレクトリ作成
2. `config.yaml` 生成（設定スナップショット: DBインポート用）
3. `data.db` 初期化
4. `agents/`, `prompts/`, `memory/` ディレクトリ作成（スナップショット/エクスポート用）
5. `baseBranch` 存在チェック（警告のみ、エラーにはしない）

**baseBranch警告例:**
```
$ agentmine init
⚠ Warning: Branch 'develop' does not exist.
  `agentmine worker run` will fail when creating worktrees.
  Create it with: git branch develop main

✓ Initialized agentmine in .agentmine/
```

### task add

```bash
agentmine task add <title> [options]

Arguments:
  title               タスクタイトル

Options:
  -d, --description <text>  説明（詳細な要件をここに記述）
  -p, --priority <level>    low | medium | high | critical (default: medium)
  -t, --type <type>         task | feature | bug | refactor (default: task)
  --parent <id>             親タスクID
  --assignee <name>         担当者名
  --ai                      AI担当として割り当て
  --human                   人間担当として割り当て
  --labels <csv>            ラベル（カンマ区切り）
  --json                    JSON出力
  --quiet                   IDのみ出力

Examples:
  agentmine task add "認証機能実装"
  agentmine task add "バグ修正" -p critical -t bug
  agentmine task add "APIリファクタ" --assignee coder --ai

  # 詳細な要件を記述（推奨）
  agentmine task add "Agents画面実装" -t feature \
    -d "AgentServiceから一覧取得、YAMLエディタで編集可能にする。モックデータは使用しない。"
```

**Note:** `--labels`は表示名をそのまま保存する（例: `blocked,needs_review`）。プロジェクト内で一意に扱う。デフォルトセットは編集/削除可能。  
**Note:** `--description`にWorkerが理解できる具体的な要件を記述することを推奨。詳細なプロジェクトルールはMemory Bankに、エージェント固有の指示はpromptContentに記述。

**出力例:**

```
# 通常
Created task #1: 認証機能実装
  Priority: medium
  Type: task
  Status: open

# --json
{"id":1,"title":"認証機能実装","priority":"medium","type":"task","status":"open"}

# --quiet
1
```

### task list

```bash
agentmine task list [options]

Options:
  -s, --status <status>     open | in_progress | done | failed | cancelled
  -p, --priority <level>    low | medium | high | critical
  -t, --type <type>         task | feature | bug | refactor
  --assignee <name>         担当者でフィルタ
  --ai                      AI担当のみ
  --human                   人間担当のみ
  --unassigned              未割り当てのみ
  --parent <id>             親タスクでフィルタ
  --limit <n>               表示件数 (default: 20)
  --json                    JSON出力

Examples:
  agentmine task list
  agentmine task list --status open --ai
  agentmine task list --priority high --json
```

**出力例:**

```
# デフォルト（タブ区切り、パイプ連携用）
ID	STATUS	PRIORITY	TYPE	TITLE
1	open	high	feature	認証機能実装
2	in_progress	medium	task	API設計
3	done	low	refactor	コード整理

# --json（Orchestrator向け推奨）
[
  {"id":1,"title":"認証機能実装","status":"open",...},
  {"id":2,"title":"API設計","status":"in_progress",...}
]

# --pretty（デバッグ用）
ID   Status       Priority  Type     Assignee      Title
#1   open         high      feature  -             認証機能実装
#2   in_progress  medium    task     🤖 coder      API設計
#3   done         low       refactor 👤 tanaka     コード整理
```

### task show

```bash
agentmine task show <id> [options]

Arguments:
  id                  タスクID

Options:
  --json              JSON出力
  --with-sessions     セッション履歴を含める
  --with-subtasks     サブタスクを含める

Examples:
  agentmine task show 1
  agentmine task show 1 --with-sessions
```

### task update

```bash
agentmine task update <id> [options]

Arguments:
  id                  タスクID

Options:
  -d, --description <text>  説明を更新
  -p, --priority <level>    low | medium | high | critical
  -t, --type <type>         task | feature | bug | refactor
  --assignee <name>         担当者名
  --ai                      AI担当として割り当て
  --human                   人間担当として割り当て
  --labels <csv>            ラベルを上書き（カンマ区切り）
  --json                    JSON出力

Examples:
  agentmine task update 1 --labels blocked,needs_review
  agentmine task update 1 -p high -t bug
```

**Note:** タスクステータスは観測可能な事実（セッション状態・マージ状態）で自動判定されるため、手動更新はしない。

### agent list

```bash
agentmine agent list [options]

Options:
  --json              JSON出力

Examples:
  agentmine agent list
```

**出力例:**

```
Name       Client        Model    Scope
───────────────────────────────────────────────────────────────
planner    claude-code   opus     **/* (read-only)
coder      claude-code   sonnet   src/**, tests/** (write)
reviewer   claude-code   haiku    **/* (read-only)
writer     claude-code   sonnet   docs/**, *.md (write)
```

### agent show

```bash
agentmine agent show <name> [options]

Arguments:
  name                エージェント名

Options:
  --format <type>     出力形式 (default | yaml | json)

Examples:
  agentmine agent show coder
  agentmine agent show coder --format yaml
```

**出力例:**

```
Agent: coder

Description: コード実装担当
Client: claude-code
Model: sonnet

Scope:
  Read: **/*
  Write: src/**, tests/**, package.json
  Exclude: **/*.env, **/secrets/**

Config:
  temperature: 0.3
  maxTokens: 8192
  promptContent: (inline markdown)
```

### worker run

```bash
agentmine worker run <task-id> [options]

Arguments:
  task-id             タスクID

Options:
  -a, --agent <name>  エージェント名 (default: coder)
  --exec [client]     Worker AIを起動（clientを指定するとagent定義を上書き）
  --detach            バックグラウンドで起動（PIDを返して即座に終了）
  --no-worktree       worktree作成をスキップ（カレントディレクトリで作業）
  --json              JSON出力

Examples:
  # 環境準備のみ（指示を表示）
  agentmine worker run 1

  # Worker AIを起動（agent定義のclientを使用）
  agentmine worker run 1 --exec

  # 特定のクライアントで起動（agent定義を上書き）
  agentmine worker run 1 --exec codex
  agentmine worker run 1 --exec aider

  # バックグラウンドで並列起動
  agentmine worker run 1 --exec --detach
  agentmine worker run 2 --exec --detach
  agentmine worker wait 1 2  # 両方の完了を待機
```

**動作:**
1. タスク情報取得
2. Git worktree作成（`.agentmine/worktrees/task-<id>/`）
3. ブランチ作成（`task-<id>`）
4. スコープ適用（exclude: sparse-checkout, write: chmod）
5. セッション開始（DBに記録）
6. `--exec`指定時: Worker AIプロセスを起動
   - `--detach`なし: 終了を待機
   - `--detach`あり: PIDをDBに記録して即座に終了
7. `--exec`なし: 各AIクライアント向けの起動コマンドを表示

**出力例（--execなし）:**

```
✓ Worker environment ready

Worktree:  /project/.agentmine/worktrees/task-1
Branch:    task-1
Session:   #1
Task:      #1: 認証機能実装

To start working:

  cd /project/.agentmine/worktrees/task-1

  # Claude Code
  claude --model sonnet "# Task #1: 認証機能実装..."

  # Or run with --exec to auto-start:
  agentmine worker run 1 --exec

When done:
  agentmine worker done 1
```

**出力例（--exec）:**

```
✓ Worker environment ready
✓ Starting Worker AI (claude-code)...

Worktree:  /project/.agentmine/worktrees/task-1
Branch:    task-1
Session:   #1

[Worker AI起動、対話セッション]

✓ Worker AI exited (code: 0)
```

**設計思想:**
- agentmineはエージェント非依存。環境準備とWorker起動を担う
- `--exec`でOrchestratorがWorkerを自動起動できる
- agent定義の`client`がデフォルト、`--exec <client>`で上書き可能
- 対応クライアント: claude-code, codex, opencode, aider, gemini等

### worker done

```bash
agentmine worker done <task-id> [options]

Arguments:
  task-id             タスクID

Options:
  --status <status>   セッション終了ステータス (completed | failed) (default: completed)
  --no-cleanup        worktreeを残す
  --json              JSON出力

Examples:
  agentmine worker done 1
  agentmine worker done 1 --status failed
  agentmine worker done 1 --no-cleanup
```

**動作:**
1. セッション終了（DBに記録）
2. worktree削除（--no-cleanupでスキップ）
3. マージ手順を表示

**Note:** タスクステータスは観測可能な事実（セッション状態・マージ状態）で自動判定される。

**出力例:**

```
✓ Session #1 ended (completed)
✓ Worktree removed

Task status is auto-determined by merge status.

To merge changes:
  git merge task-1
  or create a PR
```

### worker list

```bash
agentmine worker list [options]

Options:
  --json              JSON出力

Examples:
  agentmine worker list
  agentmine worker list --json
```

**出力例:**

```
Active Worktrees:

Task #1: 認証機能実装
  Branch:   task-1
  Path:     /project/.agentmine/worktrees/task-1
  Session:  #1 (running)

Task #3: APIリファクタ
  Branch:   task-3
  Path:     /project/.agentmine/worktrees/task-3
  Session:  #2 (running)
```

### worker cleanup

```bash
agentmine worker cleanup <task-id> [options]

Arguments:
  task-id             タスクID

Options:
  --force             未コミット変更があっても強制削除
  --json              JSON出力

Examples:
  agentmine worker cleanup 1
  agentmine worker cleanup 1 --force
```

### worker wait

バックグラウンドで起動したWorker AIの完了を待機。

```bash
agentmine worker wait [task-ids...] [options]

Arguments:
  task-ids            タスクID（複数指定可、省略時は全実行中Worker）

Options:
  --timeout <ms>      タイムアウト（ミリ秒、デフォルト: 無制限）
  --interval <ms>     ポーリング間隔（ミリ秒、デフォルト: 1000）
  --json              JSON出力

Examples:
  # 特定のタスクを待機
  agentmine worker wait 1 2

  # 全実行中Workerを待機
  agentmine worker wait

  # タイムアウト付き
  agentmine worker wait 1 --timeout 300000
```

**出力例:**

```
Waiting for 2 worker(s)...
✓ Task #1 worker completed (PID: 12345)
✓ Task #2 worker completed (PID: 12346)

✓ All 2 worker(s) completed
```

### worker stop

バックグラウンドで実行中のWorker AIを停止。

```bash
agentmine worker stop <task-ids...> [options]

Arguments:
  task-ids            タスクID（複数指定可）

Options:
  --force             SIGKILL（デフォルト: SIGTERM）
  --json              JSON出力

Examples:
  agentmine worker stop 1
  agentmine worker stop 1 2 3
  agentmine worker stop 1 --force
```

**出力例:**

```
✓ Task #1 worker stopped (PID: 12345)
✓ Task #2 worker stopped (PID: 12346)
```

### worker status

Worker AIの実行状態を表示。

```bash
agentmine worker status [task-id] [options]

Arguments:
  task-id             タスクID（省略時は全実行中Worker）

Options:
  --json              JSON出力

Examples:
  # 特定タスクの状態
  agentmine worker status 1

  # 全実行中Workerの状態
  agentmine worker status
```

**出力例:**

```
Running Workers:

Task #1: 認証機能実装
  Agent:   coder
  Session: #1
  PID:     12345 ● running

Task #2: API設計
  Agent:   coder
  Session: #2
  PID:     12346 ● running
```

### worker prompt

```bash
agentmine worker prompt <task-id> [options]

Arguments:
  task-id             タスクID

Options:
  -a, --agent <name>  エージェント名（promptContent含める場合に必要）
  --json              JSON出力

Examples:
  agentmine worker prompt 1
  agentmine worker prompt 1 --agent webui-coder
  agentmine worker prompt 1 --agent coder --json
```

**動作:** タスク情報、エージェントのpromptContent、Memory Bank参照情報からWorkerプロンプトを生成して表示。`worker run`で実際に渡されるプロンプトを事前確認できる。

### worker context

```bash
agentmine worker context <task-id> [options]

Arguments:
  task-id             タスクID

Options:
  --json              JSON出力

Examples:
  agentmine worker context 1
```

**動作:** タスクの詳細情報（親タスク、サブタスク、セッション、worktree状態）を表示。

### memory list

```bash
agentmine memory list [options]

Options:
  --category <cat>    architecture | tooling | convention | rule
  --json              JSON出力

Examples:
  agentmine memory list
  agentmine memory list --category architecture
```

### memory add

```bash
agentmine memory add [options]

Options:
  --category <cat>    カテゴリ (required)
  --title <text>      タイトル (required)
  --decision <text>   決定事項 (required)
  --reason <text>     理由 (optional)

Examples:
  agentmine memory add \
    --category tooling \
    --title "テストフレームワーク" \
    --decision "Vitest" \
    --reason "高速、Vite互換"
```

### memory preview

```bash
agentmine memory preview

# AIに渡されるコンテキストをプレビュー
```

### session list

```bash
agentmine session list [options]

Options:
  --task <id>         タスクでフィルタ
  --status <status>   running | completed | failed | cancelled
  --json              JSON出力

Examples:
  agentmine session list
  agentmine session list --task 42 --status failed
```

### session show

```bash
agentmine session show <id>

Examples:
  agentmine session show 123
```

### session start

```bash
agentmine session start <task-id> [options]

Arguments:
  task-id             タスクID

Options:
  --agent <name>      エージェント名
  --group <id>        セッショングループID（並列比較用）
  --idempotency-key <key>  重複開始防止キー

Examples:
  agentmine session start 1 --agent coder
  agentmine session start 1 --agent coder --group exp-202501
```

**動作:**
1. 新規セッションレコード作成
2. ステータスを `running` に設定
3. セッションIDを返す

**Note:** OrchestratorがWorker起動前に呼び出す。実際のWorker起動はOrchestratorの責務。

### session end

```bash
agentmine session end <session-id> [options]

Arguments:
  session-id          セッションID

Options:
  --exit-code <code>  Workerプロセスの終了コード
  --signal <signal>   終了シグナル（SIGTERM等、あれば）
  --dod-result <res>  DoD結果: pending | merged | timeout | error
  --artifacts <json>  成果物（JSON配列、worktree相対パス）
  --error <json>      エラー情報（失敗時）

Examples:
  # 正常終了・マージ済み
  agentmine session end 123 \
    --exit-code 0 \
    --dod-result merged \
    --artifacts '["src/auth.ts", "tests/auth.test.ts"]'

  # タイムアウト
  agentmine session end 123 \
    --exit-code 124 \
    --dod-result timeout \
    --error '{"type":"timeout","message":"Worker exceeded 5 minute limit"}'

  # Worker異常終了
  agentmine session end 123 \
    --exit-code 1 \
    --error '{"type":"crash","message":"Process exited with code 1"}'

  # シグナルで終了
  agentmine session end 123 \
    --exit-code 137 \
    --signal SIGKILL \
    --error '{"type":"signal","message":"Process killed"}'
```

**動作:**
1. セッションステータス更新（exit-codeに基づく）
2. 終了時刻・duration記録
3. 成果物/エラー情報保存

**Note:** タスクステータスは観測可能な事実（セッション状態・マージ状態）で自動判定される。

**Note:** OrchestratorがWorker終了後に呼び出す。

### mcp serve

```bash
agentmine mcp serve [options]

Options:
  --stdio             stdio通信（デフォルト）
  --port <port>       HTTP通信

Examples:
  agentmine mcp serve
```

### ui

```bash
agentmine ui [options]

Options:
  --port <port>       ポート (default: 3333)
  --no-open           ブラウザを開かない

Examples:
  agentmine ui
  agentmine ui --port 8080
```

## Global Options

```bash
agentmine [command] [options]

Global Options:
  -C, --cwd <path>    作業ディレクトリ
  --config <path>     設定スナップショット(YAML)のパス
  --json              JSON出力（Orchestrator向け、推奨）
  --quiet             最小出力（IDのみ等、スクリプト用）
  --pretty            人間向けフォーマット（デバッグ用）
  --verbose           詳細出力
  --version           バージョン表示
  --help              ヘルプ表示
```

### 出力モードの使い分け

| モード | 用途 | 例 |
|--------|------|-----|
| デフォルト | パイプ連携、スクリプト | タブ区切りテキスト |
| `--json` | Orchestrator AI | 構造化データ |
| `--quiet` | 単一値の取得 | IDのみ |
| `--pretty` | デバッグ、手動確認 | カラー付きテーブル |

```bash
# Orchestrator AI（推奨）
agentmine task list --json | jq '.[] | select(.status == "open")'

# スクリプト
TASK_ID=$(agentmine task add "タスク" --quiet)

# デバッグ（人間が確認）
agentmine task list --pretty
```

## Exit Codes

| Code | Meaning | 例 |
|------|---------|-----|
| 0 | 成功 | 正常終了 |
| 1 | 一般エラー | 予期しないエラー |
| 2 | 引数エラー | 必須引数不足、不正な値 |
| 3 | 設定エラー | 設定不正（settings）、baseBranch未設定 |
| 4 | データベースエラー | DB接続失敗、マイグレーション失敗 |
| 5 | リソース不存在 | TaskNotFound, AgentNotFound, SessionNotFound |
| 6 | 状態エラー | InvalidStatus, SessionAlreadyRunning |

**Note:**
- MCPはCLIのラッパーとして動作し、同じexit codeを使用
- Worker（AIクライアント）のexit codeは別管理（sessions.exit_codeに記録）

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTMINE_CONFIG` | 設定スナップショット(YAML)のパス | `.agentmine/config.yaml` |
| `AGENTMINE_DB_URL` | データベースURL | `file:.agentmine/data.db` |
| `AGENTMINE_LOG_LEVEL` | ログレベル | `info` |
| `ANTHROPIC_API_KEY` | Anthropic APIキー | - |
| `OPENAI_API_KEY` | OpenAI APIキー | - |

## Implementation Notes

### Commander.js Structure

```typescript
// packages/cli/src/index.ts
import { Command } from 'commander';
import { taskCommand } from './commands/task';
import { agentCommand } from './commands/agent';
import { workerCommand } from './commands/worker';
import { sessionCommand } from './commands/session';
import { memoryCommand } from './commands/memory';
import { mcpCommand } from './commands/mcp';
import { uiCommand } from './commands/ui';
import { dbCommand } from './commands/db';

const program = new Command();

program
  .name('agentmine')
  .description('Safe Parallel AI Development Environment')
  .version('0.1.0');

// Global options
program
  .option('-C, --cwd <path>', 'Working directory')
  .option('--config <path>', 'Settings snapshot file path')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .option('--verbose', 'Verbose output');

// Subcommands
program.addCommand(taskCommand);
program.addCommand(agentCommand);
program.addCommand(workerCommand);
program.addCommand(sessionCommand);
program.addCommand(memoryCommand);
program.addCommand(mcpCommand);
program.addCommand(dbCommand);
program.addCommand(uiCommand);

program.parse();
```

### Output Formatting

AI/スクリプト向けに最適化。`--pretty`でのみ人間向けフォーマット。

```typescript
// packages/cli/src/utils/output.ts
import chalk from 'chalk';
import { table } from 'table';

export function formatTask(task: Task, options: OutputOptions) {
  // JSON: Orchestrator向け（推奨）
  if (options.json) {
    return JSON.stringify(task);
  }

  // Quiet: スクリプト用（IDのみ）
  if (options.quiet) {
    return String(task.id);
  }

  // Pretty: デバッグ用（人間向け）
  if (options.pretty) {
    return `
${chalk.bold(`Task #${task.id}`)}: ${task.title}
  Status: ${colorStatus(task.status)}
  Priority: ${colorPriority(task.priority)}
  Assignee: ${formatAssignee(task)}
    `.trim();
  }

  // Default: 機械可読テキスト（パイプ連携用）
  return `${task.id}\t${task.status}\t${task.title}`;
}

export function formatTaskList(tasks: Task[], options: OutputOptions) {
  // JSON: Orchestrator向け（推奨）
  if (options.json) {
    return JSON.stringify(tasks);
  }

  // Pretty: デバッグ用（人間向けテーブル）
  if (options.pretty) {
    const data = [
      ['ID', 'Status', 'Priority', 'Type', 'Assignee', 'Title'],
      ...tasks.map(t => [
        `#${t.id}`,
        colorStatus(t.status),
        colorPriority(t.priority),
        t.type,
        formatAssignee(t),
        truncate(t.title, 40),
      ]),
    ];
    return table(data);
  }

  // Default: 機械可読テキスト（タブ区切り）
  const header = 'ID\tSTATUS\tPRIORITY\tTYPE\tTITLE';
  const rows = tasks.map(t =>
    `${t.id}\t${t.status}\t${t.priority}\t${t.type}\t${t.title}`
  );
  return [header, ...rows].join('\n');
}
```

---

## Orchestrator Usage Patterns

Orchestrator AI（Claude Code等）がagentmine CLIを使用する典型的なパターン。

### Pattern 1: シーケンシャル実行

```bash
# 1. タスク作成
TASK_ID=$(agentmine task add "認証機能実装" -t feature --quiet)

# 2. Worker起動（完了まで待機）
agentmine worker run $TASK_ID --exec

# 3. 完了処理
agentmine worker done $TASK_ID
```

### Pattern 2: 並列実行

```bash
# 1. 複数タスク作成
TASK1=$(agentmine task add "ログイン実装" --quiet)
TASK2=$(agentmine task add "ログアウト実装" --quiet)
TASK3=$(agentmine task add "認証テスト" --quiet)

# 2. 並列でWorker起動
agentmine worker run $TASK1 --exec --detach
agentmine worker run $TASK2 --exec --detach
agentmine worker run $TASK3 --exec --detach

# 3. 全Worker完了待機
agentmine worker wait $TASK1 $TASK2 $TASK3

# 4. 結果確認・完了処理
for ID in $TASK1 $TASK2 $TASK3; do
  STATUS=$(agentmine worker status $ID --json | jq -r '.status')
  if [ "$STATUS" = "completed" ]; then
    agentmine worker done $ID
  fi
done
```

### Pattern 3: 条件分岐

```bash
# タスク状態に基づく判断
TASK=$(agentmine task show 1 --json)
STATUS=$(echo $TASK | jq -r '.status')

case $STATUS in
  "open")
    agentmine worker run 1 --exec
    ;;
  "in_progress")
    # 既に実行中
    ;;
  "done")
    # マージ確認
    git merge task-1
    ;;
esac
```

### Pattern 4: MCP経由

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "agentmine": {
      "command": "npx",
      "args": ["agentmine", "mcp", "serve"]
    }
  }
}
```

Orchestrator AIがMCP経由でagentmineを直接操作：

```
User: タスク#1のWorkerを起動して

Orchestrator: [MCP call: worker_run(taskId: 1, exec: true)]
→ Workerが起動しました。セッション#5が開始されました。
```

---

## CLI vs Web UI 役割分担

| 操作 | CLI (Orchestrator) | Web UI (人間) |
|------|:------------------:|:-------------:|
| タスク作成 | ✓ `task add` | ✓ フォーム |
| タスク一覧 | ✓ `task list --json` | ✓ テーブル/ボード |
| Worker起動 | ✓ `worker run --exec` | ✓ ボタンクリック |
| Worker停止 | ✓ `worker stop` | ✓ ボタンクリック |
| 状態監視 | ✓ `worker status --json` | ✓ リアルタイム表示 |
| 並列制御 | ✓ `worker wait` | - |
| Agent編集 | - | ✓ UI/YAMLエディタ |
| Memory編集 | ✓ `memory add/edit` | ✓ Markdownエディタ |
| 差分確認 | ✓ `git diff` | ✓ ビジュアル差分 |

**原則:**
- **自動化・並列制御** → CLI（Orchestrator）
- **視覚的確認・編集** → Web UI（人間）
