# CLI Design

## Overview

agentmine CLIは2つのユーザーを想定：

1. **人間**: プロジェクト管理、設定、モニタリング
2. **AIエージェント**: タスク取得、ステータス更新、コンテキスト操作

## Design Principles

### 1. AI-Friendly Output

```bash
# デフォルト: 人間向け（カラー、テーブル）
agentmine task list

# --json: AI向け（構造化データ）
agentmine task list --json

# --quiet: 最小出力（パイプ用）
agentmine task add "タスク" --quiet  # → "1" (IDのみ)
```

### 2. Composable Commands

```bash
# パイプで連携
agentmine task list --status open --json | jq '.[0].id' | xargs agentmine task start

# サブコマンドの一貫性
agentmine <resource> <action> [args] [options]
```

### 3. Progressive Disclosure

```bash
# 基本（必須のみ）
agentmine task add "タイトル"

# 詳細（オプション追加）
agentmine task add "タイトル" -p high -t feature --assignee coder
```

## Command Structure

```
agentmine
├── init                    # プロジェクト初期化
├── task                    # タスク管理
│   ├── add
│   ├── list
│   ├── show
│   ├── update
│   ├── delete
│   ├── assign
│   ├── start
│   ├── done
│   ├── parse-prd
│   ├── expand
│   ├── analyze
│   └── run
├── agent                   # エージェント管理
│   ├── list
│   ├── show
│   └── run
├── skill                   # スキル管理
│   ├── list
│   ├── show
│   ├── run
│   ├── add
│   └── remove
├── context                 # コンテキスト管理
│   ├── show
│   ├── load
│   └── save
├── db                      # データベース管理
│   ├── migrate
│   └── reset
├── mcp                     # MCPサーバー
│   └── serve
└── ui                      # Web UI起動
```

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
2. `config.yaml` 生成（インタラクティブ or テンプレート）
3. `data.db` 初期化
4. `memory/`, `skills/` ディレクトリ作成

### task add

```bash
agentmine task add <title> [options]

Arguments:
  title               タスクタイトル

Options:
  -d, --description <text>  説明
  -p, --priority <level>    low | medium | high | critical (default: medium)
  -t, --type <type>         task | feature | bug | refactor (default: task)
  --parent <id>             親タスクID
  --assignee <name>         担当者名
  --ai                      AI担当として割り当て
  --human                   人間担当として割り当て
  --json                    JSON出力
  --quiet                   IDのみ出力

Examples:
  agentmine task add "認証機能実装"
  agentmine task add "バグ修正" -p critical -t bug
  agentmine task add "APIリファクタ" --assignee coder --ai
```

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
  -s, --status <status>     open | in_progress | review | done | cancelled
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
# 通常（テーブル）
ID   Status       Priority  Type     Assignee      Title
#1   open         high      feature  -             認証機能実装
#2   in_progress  medium    task     🤖 coder      API設計
#3   review       low       refactor 👤 tanaka     コード整理

# --json
[
  {"id":1,"title":"認証機能実装","status":"open",...},
  {"id":2,"title":"API設計","status":"in_progress",...}
]
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

### task start

```bash
agentmine task start <id> [options]

Arguments:
  id                  タスクID

Options:
  --no-branch         ブランチを作成しない
  --branch <name>     カスタムブランチ名

Examples:
  agentmine task start 1
  agentmine task start 1 --branch feature/custom-auth
```

**動作:**
1. ステータスを `in_progress` に変更
2. Gitブランチ作成: `task-{id}-{slug}`
3. ブランチにチェックアウト

### task done

```bash
agentmine task done <id> [options]

Arguments:
  id                  タスクID

Options:
  --no-pr             PRを作成しない
  --draft             ドラフトPRとして作成
  --title <text>      PRタイトル
  --body <text>       PR本文

Examples:
  agentmine task done 1
  agentmine task done 1 --draft
```

**動作:**
1. 変更をコミット（未コミットがあれば）
2. リモートにプッシュ
3. PR作成
4. ステータスを `review` に変更

### task parse-prd

```bash
agentmine task parse-prd <file> [options]

Arguments:
  file                PRDファイルパス

Options:
  --dry-run           実際には作成せず結果のみ表示
  --parent <id>       親タスクID
  --assignee <name>   デフォルト担当者

Examples:
  agentmine task parse-prd ./docs/prd.md
  agentmine task parse-prd ./docs/auth-spec.md --parent 1
```

**動作:**
1. PRDファイル読み込み
2. AIでタスク分解
3. タスク一括作成

### task expand

```bash
agentmine task expand <id> [options]

Arguments:
  id                  タスクID

Options:
  --depth <n>         展開深度 (default: 1)
  --dry-run           実際には作成せず結果のみ表示

Examples:
  agentmine task expand 3
  agentmine task expand 3 --depth 2 --dry-run
```

### task analyze

```bash
agentmine task analyze <id> [options]

Arguments:
  id                  タスクID

Options:
  --json              JSON出力

Examples:
  agentmine task analyze 3
```

**出力例:**

```
Task #3: 認証機能実装

Complexity: 7/10
Estimated subtasks: 4
Dependencies: None detected

Suggested approach:
1. JWTライブラリ選定・セットアップ
2. 認証エンドポイント実装
3. ミドルウェア作成
4. テスト作成

Risks:
- セキュリティ考慮事項が多い
- 既存コードとの統合が必要
```

### task run

```bash
agentmine task run [options]

Options:
  --parallel <n>      並列実行数 (default: 1)
  --status <status>   対象ステータス (default: open)
  --agent <names>     使用エージェント（カンマ区切り）
  --compare           同一タスクを複数エージェントで比較
  --dry-run           実際には実行せず計画のみ表示

Examples:
  agentmine task run --parallel 3
  agentmine task run --agent coder,reviewer --compare
```

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
Name       Model          Tools                        Skills
coder      claude-sonnet  Read,Write,Edit,Bash,...    implement,test,debug
reviewer   claude-haiku   Read,Grep                   review,security-check
planner    claude-opus    Read,WebSearch,Grep         analyze,design
```

### agent run

```bash
agentmine agent run <name> [prompt] [options]

Arguments:
  name                エージェント名
  prompt              プロンプト（省略時はstdinから）

Options:
  --task <id>         タスクに紐づけ
  --context           前回のコンテキストを読み込み
  --json              JSON出力

Examples:
  agentmine agent run coder "認証機能を実装してください"
  agentmine agent run coder --task 1 "続きを実装してください"
  echo "レビューしてください" | agentmine agent run reviewer
```

### context show

```bash
agentmine context show [options]

Options:
  --session <id>      特定セッションのコンテキスト
  --task <id>         特定タスクのコンテキスト
  --json              JSON出力

Examples:
  agentmine context show
  agentmine context show --task 1
```

### context load

```bash
agentmine context load [options]

Options:
  --session <id>      セッションID
  --task <id>         タスクID（最新セッション）

Examples:
  agentmine context load --session 42
  agentmine context load --task 1
```

**出力:**
コンテキストを標準出力に出力（AIエージェントが読み込むため）

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
  --config <path>     設定ファイルパス
  --json              JSON出力（対応コマンドのみ）
  --quiet             最小出力
  --verbose           詳細出力
  --version           バージョン表示
  --help              ヘルプ表示
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | 成功 |
| 1 | 一般エラー |
| 2 | 引数エラー |
| 3 | 設定エラー（config.yaml不正等） |
| 4 | データベースエラー |
| 5 | Git操作エラー |
| 6 | ネットワークエラー |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTMINE_CONFIG` | 設定ファイルパス | `.agentmine/config.yaml` |
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
// ...

const program = new Command();

program
  .name('agentmine')
  .description('AI Project Manager - Redmine for AI Agents')
  .version('0.1.0');

// Global options
program
  .option('-C, --cwd <path>', 'Working directory')
  .option('--config <path>', 'Config file path')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .option('--verbose', 'Verbose output');

// Subcommands
program.addCommand(taskCommand);
program.addCommand(agentCommand);
program.addCommand(skillCommand);
program.addCommand(contextCommand);
program.addCommand(mcpCommand);
program.addCommand(uiCommand);

program.parse();
```

### Output Formatting

```typescript
// packages/cli/src/utils/output.ts
import chalk from 'chalk';
import { table } from 'table';

export function formatTask(task: Task, options: OutputOptions) {
  if (options.json) {
    return JSON.stringify(task);
  }
  
  if (options.quiet) {
    return String(task.id);
  }
  
  return `
${chalk.bold(`Task #${task.id}`)}: ${task.title}
  Status: ${colorStatus(task.status)}
  Priority: ${colorPriority(task.priority)}
  Assignee: ${formatAssignee(task)}
  `.trim();
}

export function formatTaskList(tasks: Task[], options: OutputOptions) {
  if (options.json) {
    return JSON.stringify(tasks);
  }
  
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
```
