# Agent System

役割別エージェント定義・実行システム。

## 概要

プロジェクトで使用するAIエージェント（Worker）を定義し、タスクに応じて適切なエージェントを選択・実行。

## Orchestrator/Worker モデル

```
Human (ユーザー)
  ↓ 会話
AI as Orchestrator (メインのAIエージェント)
  ↓ タスク割り振り
AI as Worker (サブエージェント)
  ↓ agentmine を使う
agentmine (データ層・状態管理)
```

- **Orchestrator**: ユーザーと会話し、タスクを割り振るAI（例: Claude Code本体）
- **Worker**: 実際にタスクを実行するAI（例: Taskサブエージェント）
- **Agent定義**: Workerの能力・制約を定義したもの

## 設計目標

1. **役割分離**: 設計者・実装者・レビュアー等の役割を明確化
2. **設定可能**: クライアント・モデル・スコープを柔軟に設定
3. **再利用**: エージェント定義をプロジェクト間で共有
4. **拡張可能**: カスタムエージェントの追加が容易

## ファイル構造

```
.agentmine/
├── config.yaml           # 基本設定（project, database, git, execution）
├── agents/               # エージェント定義（1ファイル1エージェント）
│   ├── coder.yaml
│   ├── reviewer.yaml
│   ├── planner.yaml
│   └── writer.yaml
└── prompts/              # 詳細指示（Markdown）
    ├── coder.md
    ├── reviewer.md
    ├── planner.md
    └── writer.md
```

**メリット:**
- 長文プロンプトを別ファイルで管理
- エージェントごとに独立して編集可能
- プロンプトをMarkdownで記述（可読性向上）

## エージェント定義

### 基本構造

```yaml
# .agentmine/agents/coder.yaml
name: coder
description: "コード実装担当"
client: claude-code              # AIクライアント
model: sonnet                    # AIモデル
scope:                           # アクセス範囲（物理的に強制）
  read:                          # 参照可能（全ファイル存在）
    - "**/*"
  write:                         # 編集可能（それ以外は書き込み禁止）
    - "src/**"
    - "tests/**"
  exclude:                       # 読み取りも禁止（物理的に削除）
    - "**/*.env"
    - "**/secrets/**"
config:
  temperature: 0.3
  maxTokens: 8192
  promptFile: "../prompts/coder.md"   # 別ファイル参照
```

**Note:**
- スキル管理は agentmine の範囲外。各AIツールのネイティブ機能に委ねる。
- ツール制限も agentmine では制御不可。AIクライアント側の責務。
- agentmineはWorker定義を提供し、実際の制約適用はAIクライアント側で行う。

### 組み込みエージェント

#### planner.yaml

```yaml
name: planner
description: "設計・計画・見積もり担当"
client: claude-code
model: opus
scope:
  read: ["**/*"]
  write: []                      # 読み取り専用（ファイル変更なし）
  exclude: ["**/*.env", "**/secrets/**"]
config:
  temperature: 0.7
  promptFile: "../prompts/planner.md"
```

#### coder.yaml

```yaml
name: coder
description: "コード実装担当"
client: claude-code
model: sonnet
scope:
  read: ["**/*"]                 # 全ファイル参照可能
  write:                         # 編集はこれらのみ
    - "src/**"
    - "tests/**"
    - "package.json"
    - "tsconfig.json"
  exclude:
    - "**/*.env"
    - "**/secrets/**"
config:
  temperature: 0.3
  maxTokens: 8192
  promptFile: "../prompts/coder.md"
```

#### reviewer.yaml

```yaml
name: reviewer
description: "コードレビュー担当（読み取り専用）"
client: claude-code
model: haiku
scope:
  read: ["**/*"]
  write: []                      # 読み取り専用
  exclude: ["**/*.env"]
config:
  temperature: 0.5
  promptFile: "../prompts/reviewer.md"
```

#### writer.yaml

```yaml
name: writer
description: "ドキュメント作成担当"
client: claude-code
model: sonnet
scope:
  read: ["**/*"]
  write:                         # ドキュメントのみ編集可能
    - "docs/**"
    - "README.md"
    - "*.md"
  exclude: ["**/*.env"]
config:
  temperature: 0.6
  promptFile: "../prompts/writer.md"
```

## プロンプトファイル

### prompts/coder.md（例）

```markdown
# コード実装担当

## あなたの役割
あなたはコード実装を担当するWorkerです。
Orchestratorから割り当てられたタスクを実装してください。

## 作業フロー
1. `agentmine task get <id>` でタスク詳細を確認
2. 既存コードを理解してから変更
3. 小さな変更を積み重ねる
4. テストを書く/実行する
5. `agentmine task update <id> --status done` で完了報告

## コーディング規約
- TypeScript strict mode を使用
- ESLint/Prettier の設定に従う
- 関数は単一責任の原則に従う
- エラーハンドリングを適切に行う

## 禁止事項
- スコープ外のファイルを変更しない
- 環境変数ファイル（.env）を変更しない
- 破壊的な変更を行う前にOrchestratorに確認する
```

### prompts/reviewer.md（例）

```markdown
# コードレビュー担当

## あなたの役割
あなたはコードレビューを担当するWorkerです。
コードの品質、セキュリティ、保守性を確認してください。

## レビュー観点
1. **正確性**: ロジックは正しいか
2. **セキュリティ**: 脆弱性はないか（OWASP Top 10）
3. **保守性**: 読みやすく変更しやすいか
4. **テスト**: テストカバレッジは十分か
5. **パフォーマンス**: 明らかな問題はないか

## 出力形式
- 問題点は具体的な行番号と改善案を示す
- 重要度を明記（Critical / Warning / Info）
- 良い点も指摘する

## 禁止事項
- ファイルの変更は行わない（レビューコメントのみ）
```

### プロンプトファイルのWorkerプロンプトへの展開

`worker run`実行時、エージェントの`promptFile`内容は**Agent Instructions**セクションとしてWorkerプロンプトに展開される。

```
Workerプロンプト構成:
┌─────────────────────────────────────┐
│ # Task #1: タスクタイトル           │
│ Type: feature | Priority: high      │
├─────────────────────────────────────┤
│ ## Description                      │
│ タスクの説明文                       │
├─────────────────────────────────────┤
│ ## Agent Instructions               │  ← promptFile内容がここに展開
│ [prompts/coder.mdの全文]            │
├─────────────────────────────────────┤
│ ## Scope                            │
│ - Read: **/*                        │
│ - Write: src/**, tests/**           │
│ - Exclude: **/*.env                 │
├─────────────────────────────────────┤
│ ## Project Context (Memory Bank)    │  ← 参照方式（ファイルパスのみ）
│ - architecture/tech-stack.md        │
│ - convention/coding-style.md        │
│ Read files in .agentmine/memory/    │
├─────────────────────────────────────┤
│ ## Instructions                     │
│ 1. 既存の実装パターンを確認          │
│ 2. モックデータは作成しない          │
│ 3. テストが全てパスすることを確認    │
│ 4. 完了したらコミット               │
└─────────────────────────────────────┘
```

**Note:** Memory Bankはコンテキスト長削減のため参照方式を採用。Workerはworktree内の`.agentmine/memory/`ディレクトリから必要なファイルを直接読み込める。

**重要:** promptFileはWorkerが正しく動作するための詳細な指示を含むべき。特に：
- **禁止事項**（モックデータ作成禁止、スコープ外変更禁止等）
- **利用すべきサービス/API**（既存のサービス層を使用する指示）
- **コーディング規約**（プロジェクト固有のルール）
- **具体的な実装パターン**（コード例を含む）

## スコープ制御

### 概要

`scope` はWorkerのファイルアクセス範囲を**物理的に**制限する。

| フィールド | 説明 | 物理的な実装 |
|-----------|------|-------------|
| `read` | 参照可能なファイル | worktreeに存在 |
| `write` | 編集可能なファイル | 書き込み権限あり |
| `exclude` | アクセス不可 | worktreeから削除 |

### 物理的な強制方法

スコープ優先順位: `exclude → read → write`

```bash
# Orchestratorがworktree作成後に実行（agentmineコマンドなし）
cd .worktrees/task-5

# 1. exclude対象をsparse-checkoutで物理的に除外
git sparse-checkout set --no-cone '/*' '!**/*.env' '!**/secrets/**'

# 2. write対象外のファイルを読み取り専用に（chmod a-w）
find . -type f \
  ! -path './src/*' \
  ! -path './tests/*' \
  -exec chmod a-w {} \;
```

詳細は [Worktree & Scope Control](./worktree-scope.md) を参照。

### パターン構文

```yaml
scope:
  read:
    - "**/*"             # 全ファイル参照可能
  write:
    - "src/**"           # srcディレクトリ以下は編集可能
    - "tests/**/*.ts"    # testsのTypeScriptファイルは編集可能
    - "package.json"     # 特定ファイル
  exclude:
    - "**/*.env"         # 全ての.envファイル（存在しない）
    - "**/secrets/**"    # secretsディレクトリ（存在しない）
```

### 使用例

```yaml
# 読み取り専用Worker（reviewer）
scope:
  read: ["**/*"]
  write: []              # 空 = 全ファイル書き込み禁止
  exclude: ["**/*.env"]

# フロントエンド専門Worker
scope:
  read: ["**/*"]         # 型定義等は参照可能
  write:
    - "src/components/**"
    - "src/pages/**"
    - "src/styles/**"
  exclude:
    - "**/*.env"
    - "**/secrets/**"
```

### AIクライアント設定の配置

worktree作成時に、各AIクライアント用の設定ファイルも生成・配置する。

```
.worktrees/task-5/
├── .claude/              # Claude Code用設定
│   ├── settings.json
│   ├── commands/         # カスタムスキル
│   └── CLAUDE.md         # システムプロンプト（promptFileから生成）
├── .codex/               # Codex用設定
│   └── ...
├── src/                  # write可能
├── tests/                # write可能
├── docs/                 # read-only（chmod a-w）
└── ...
```

## API

### AgentService

```typescript
// packages/core/src/services/agent-service.ts

export class AgentService {
  constructor(private config: Config) {}

  // エージェント一覧
  async listAgents(): Promise<Agent[]>;

  // エージェント取得
  async getAgent(name: string): Promise<Agent>;

  // エージェント定義をコンテキストとして出力（Orchestrator向け）
  async getAgentContext(name: string): Promise<string>;

  // プロンプトファイル内容を取得（Workerプロンプト生成用）
  getPromptFileContent(agent: Agent): string | null;
}
```

**Note:** `AgentService`はエージェント定義の管理のみ行う。実際のWorker起動・実行はOrchestrator（AIクライアント）側の責務。

### Agent型

```typescript
interface Agent {
  name: string;
  description: string;
  client: ClientType;
  model: string;           // モデル名（opus, sonnet, gpt-5等）
  scope: AgentScope;
  config: AgentConfig;
}

interface AgentScope {
  read: string[];          // 参照可能（globパターン）
  write: string[];         // 編集可能（globパターン）
  exclude: string[];       // アクセス不可（globパターン）
}

interface AgentConfig {
  temperature?: number;
  maxTokens?: number;
  promptFile?: string;       // プロンプトファイルパス
}

// AIクライアント（ソフトウェア）
type ClientType =
  | 'claude-code'
  | 'opencode'
  | 'codex'
  | 'gemini-cli'
  | 'aider'
  | string;               // カスタムクライアント
```

## 実行フロー

```
┌──────────────────────────────────────────────────────────────┐
│                    Orchestrator/Worker Execution                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Orchestrator: タスクを受け取る                                      │
│     Human → Orchestrator (Claude Code等)                               │
│                                                              │
│  2. Orchestrator: Worker定義を取得                                      │
│     ┌─────────────┐                                         │
│     │ agentmine   │ → Agent { client, model, scope, config }│
│     │ agent show  │                                         │
│     └─────────────┘                                         │
│                                                              │
│  3. Orchestrator: Workerを起動                                         │
│     ┌─────────────┐    ┌─────────────┐                      │
│     │ Task Info   │ +  │ Agent定義   │ → Worker起動         │
│     └─────────────┘    └─────────────┘                      │
│     (AIクライアントのサブエージェント機能を使用)               │
│                                                              │
│  4. Worker: 作業実行                                         │
│     - agentmine task get でコンテキスト取得                   │
│     - コード変更、テスト実行                                  │
│     - agentmine task update でステータス更新                  │
│                                                              │
│  5. Orchestrator: 結果確認                                              │
│     - Workerの出力を確認                                      │
│     - 必要に応じて追加指示                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## CLI

```bash
# エージェント一覧
agentmine agent list

# エージェント詳細（Orchestrator向けコンテキスト出力）
agentmine agent show coder

# エージェント定義をYAML形式で出力
agentmine agent show coder --format yaml

# JSON出力（プログラマティック利用）
agentmine agent show coder --format json
```

**Note:** `agentmine agent run` は提供しない。Worker実行はOrchestrator（AIクライアント）の責務。

## 出力例

### agent list

```
Name       Client        Model    Scope
───────────────────────────────────────────────────────────────
planner    claude-code   opus     **/* (exclude: *.env, secrets/**)
coder      claude-code   sonnet   src/**, tests/**
reviewer   claude-code   haiku    **/* (read-only intent)
writer     claude-code   sonnet   docs/**, *.md
```

### agent show

```
Agent: coder

Description: コード実装担当
Client: claude-code
Model: sonnet

Scope:
  Include:
    - src/**
    - tests/**
    - package.json
    - tsconfig.json
  Exclude:
    - **/*.env
    - **/secrets/**

Config:
  temperature: 0.3
  maxTokens: 8192
```

### agent show --format yaml

```yaml
name: coder
description: コード実装担当
client: claude-code
model: sonnet
scope:
  include:
    - src/**
    - tests/**
    - package.json
    - tsconfig.json
  exclude:
    - "**/*.env"
    - "**/secrets/**"
config:
  temperature: 0.3
  maxTokens: 8192
```

## System Prompt Template

OrchestratorがWorkerを起動する際に使用するプロンプトテンプレート例：

```typescript
const WORKER_PROMPT = `
You are {agent.description}.

## Your Role
Client: {agent.client}
Model: {agent.model}

## Scope (Files you can access)
Include: {agent.scope.include.join(', ')}
Exclude: {agent.scope.exclude.join(', ')}

## Current Task
Project: {project.name}
Task: {task.title} (#{task.id})
Status: {task.status}
Branch: {task.branchName}

## Project Decisions (Memory Bank)
{memoryContext}

## Guidelines
1. 指定されたスコープ内のファイルのみ操作する
2. 変更を加える前に現状を確認する
3. 小さな変更を積み重ねる
4. テストを書く/実行する
5. 完了したら agentmine task update で報告する

{agent.config.systemPrompt}
`;
```

**Note:** このテンプレートはOrchestrator（AIクライアント）側で使用される。agentmineはAgent定義を提供するのみ。

## カスタムエージェント

### agents/security-auditor.yaml

```yaml
name: security-auditor
description: "セキュリティ監査担当（読み取り専用）"
client: claude-code
model: opus
scope:
  read: ["**/*"]
  write: []                # 読み取り専用
  exclude: []
config:
  temperature: 0.2
  promptFile: "../prompts/security-auditor.md"
```

### agents/frontend-coder.yaml

```yaml
name: frontend-coder
description: "フロントエンド実装担当"
client: claude-code
model: sonnet
scope:
  read: ["**/*"]           # 全ファイル参照可能
  write:                   # フロントエンドのみ編集可能
    - "src/components/**"
    - "src/pages/**"
    - "src/styles/**"
    - "src/hooks/**"
  exclude:
    - "**/*.env"
    - "**/secrets/**"
config:
  temperature: 0.3
  promptFile: "../prompts/frontend-coder.md"
```

### agents/fast-coder.yaml（別クライアント例）

```yaml
name: fast-coder
description: "高速実装担当"
client: codex              # OpenAI Codex CLI
model: gpt-4.1
scope:
  read: ["**/*"]
  write: ["src/**", "tests/**"]
  exclude: ["**/*.env"]
config:
  temperature: 0.2
  promptFile: "../prompts/fast-coder.md"
```

## 並列実行との連携

parallel-execution.mdと連携し、複数Workerを同時起動できる。

```bash
# 3つのcoder Workerを並列起動（Orchestratorが実行）
agentmine task run --parallel 3 --agent coder

# 比較モード：同じタスクを異なるエージェントで実行
agentmine task run 5 --agent coder,reviewer --compare
```

詳細は [Parallel Execution](./parallel-execution.md) を参照。
