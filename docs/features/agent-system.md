# Agent System

役割別エージェント定義・実行システム。

## 概要

プロジェクトで使用するAIエージェントを定義し、タスクに応じて適切なエージェントを選択・実行。

## 設計目標

1. **役割分離**: 設計者・実装者・レビュアー等の役割を明確化
2. **設定可能**: モデル・ツール・スキルを柔軟に設定
3. **再利用**: エージェント定義をプロジェクト間で共有
4. **拡張可能**: カスタムエージェントの追加が容易

## エージェント定義

### 基本構造

```yaml
# .agentmine/config.yaml
agents:
  <name>:
    description: string       # 説明
    model: string            # AIモデル
    tools: string[]          # 使用可能ツール
    skills: string[]         # 使用可能スキル
    config:                  # 追加設定
      temperature: number
      maxTokens: number
      systemPrompt: string
```

### 組み込みエージェント

```yaml
agents:
  # 設計・計画担当
  planner:
    description: "設計・計画・見積もり担当"
    model: claude-opus
    tools:
      - Read
      - Grep
      - Glob
      - WebSearch
    skills:
      - analyze
      - design
      - estimate
    config:
      temperature: 0.7

  # 実装担当
  coder:
    description: "コード実装担当"
    model: claude-sonnet
    tools:
      - Read
      - Write
      - Edit
      - Bash
      - Grep
      - Glob
    skills:
      - implement
      - test
      - debug
      - commit
    config:
      temperature: 0.3
      maxTokens: 8192

  # レビュー担当
  reviewer:
    description: "コードレビュー担当"
    model: claude-haiku
    tools:
      - Read
      - Grep
      - Glob
    skills:
      - review
      - security-check
    config:
      temperature: 0.5

  # ドキュメント担当
  writer:
    description: "ドキュメント作成担当"
    model: claude-sonnet
    tools:
      - Read
      - Write
      - Grep
    skills:
      - document
      - explain
    config:
      temperature: 0.6
```

## ツール定義

### 使用可能ツール

| Tool | Description | Risk Level |
|------|-------------|------------|
| `Read` | ファイル読み込み | Low |
| `Write` | ファイル書き込み | Medium |
| `Edit` | ファイル編集 | Medium |
| `Bash` | コマンド実行 | High |
| `Grep` | 内容検索 | Low |
| `Glob` | ファイル検索 | Low |
| `WebSearch` | Web検索 | Low |
| `WebFetch` | URL取得 | Low |

### ツール制限

```yaml
# 最小権限の原則
agents:
  reviewer:
    tools:
      - Read    # 読み取りのみ
      - Grep
      - Glob
    # Write, Edit, Bash は許可しない
```

## API

### AgentService

```typescript
// packages/core/src/services/agent-service.ts

export class AgentService {
  constructor(
    private config: Config,
    private aiClient: AIClient,
  ) {}

  // エージェント一覧
  async listAgents(): Promise<Agent[]>;

  // エージェント取得
  async getAgent(name: string): Promise<Agent>;

  // エージェント実行
  async run(
    agentName: string,
    prompt: string,
    options?: RunOptions,
  ): Promise<AgentResult>;

  // タスクに紐づけて実行
  async runForTask(
    agentName: string,
    taskId: number,
    prompt: string,
  ): Promise<AgentResult>;
}

interface RunOptions {
  taskId?: number;
  loadContext?: boolean;
  saveContext?: boolean;
  tools?: string[];      // ツールを追加制限
  timeout?: number;
}

interface AgentResult {
  sessionId: number;
  output: string;
  tokensUsed: number;
  filesChanged: string[];
  decisions: Decision[];
}
```

### Agent型

```typescript
interface Agent {
  name: string;
  description: string;
  model: ModelType;
  tools: ToolType[];
  skills: string[];
  config: AgentConfig;
}

type ModelType = 
  | 'claude-opus'
  | 'claude-sonnet'
  | 'claude-haiku'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gemini-pro';

type ToolType =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Grep'
  | 'Glob'
  | 'WebSearch'
  | 'WebFetch';
```

## 実行フロー

```
┌──────────────────────────────────────────────────────────────┐
│                      Agent Execution                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Load Agent Definition                                    │
│     ┌─────────────┐                                         │
│     │ config.yaml │ → Agent { model, tools, skills }        │
│     └─────────────┘                                         │
│                                                              │
│  2. Prepare Context                                          │
│     ┌─────────────┐    ┌─────────────┐                      │
│     │  Task Info  │ +  │Memory Bank  │ → System Prompt      │
│     └─────────────┘    └─────────────┘                      │
│                                                              │
│  3. Load Skills                                              │
│     ┌─────────────┐                                         │
│     │   Skills    │ → Additional Instructions               │
│     └─────────────┘                                         │
│                                                              │
│  4. Execute                                                  │
│     ┌─────────────┐                                         │
│     │  AI Model   │ → Response + Tool Calls                 │
│     └─────────────┘                                         │
│                                                              │
│  5. Save Session                                             │
│     ┌─────────────┐    ┌─────────────┐                      │
│     │  Database   │ +  │Memory Bank  │                      │
│     └─────────────┘    └─────────────┘                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## CLI

```bash
# エージェント一覧
agentmine agent list

# エージェント詳細
agentmine agent show coder

# エージェント実行
agentmine agent run coder "認証機能を実装してください"

# タスクに紐づけて実行
agentmine agent run coder --task 5 "続きを実装してください"

# コンテキスト付きで実行
agentmine agent run coder --task 5 --context

# stdinからプロンプト
echo "バグを修正してください" | agentmine agent run coder --task 3

# JSON出力
agentmine agent run coder "コードレビュー" --json
```

## 出力例

### agent list

```
Name       Model          Tools                         Skills
─────────────────────────────────────────────────────────────────────
planner    claude-opus    Read,Grep,Glob,WebSearch     analyze,design,estimate
coder      claude-sonnet  Read,Write,Edit,Bash,...     implement,test,debug
reviewer   claude-haiku   Read,Grep,Glob               review,security-check
writer     claude-sonnet  Read,Write,Grep              document,explain
```

### agent show

```
Agent: coder

Description: コード実装担当
Model: claude-sonnet

Tools:
  ✓ Read     - ファイル読み込み
  ✓ Write    - ファイル書き込み
  ✓ Edit     - ファイル編集
  ✓ Bash     - コマンド実行
  ✓ Grep     - 内容検索
  ✓ Glob     - ファイル検索

Skills:
  - implement
  - test
  - debug
  - commit

Config:
  temperature: 0.3
  maxTokens: 8192
```

### agent run

```
Running agent: coder
Task: #5 (ダッシュボード実装)
Context: loaded (session #41)

───────────────────────────────────────────────────

[coder] ダッシュボードの実装を進めます。

まず、現在の状態を確認します...

<tool_use: Read src/components/Dashboard.tsx>

コンポーネントの構造を理解しました。
統計カードを追加します。

<tool_use: Edit src/components/Dashboard.tsx>

変更を適用しました。テストを実行します。

<tool_use: Bash npm test>

テストが通りました。

───────────────────────────────────────────────────

Session Complete
  ID: #42
  Tokens: 3,245
  Files changed: 2
  Duration: 2m 15s

Context saved to: .agentmine/memory/sessions/session-042.md
```

## System Prompt Template

```typescript
const SYSTEM_PROMPT = `
You are {agent.description}.

## Your Capabilities
Model: {agent.model}
Tools: {agent.tools.join(', ')}
Skills: {agent.skills.join(', ')}

## Current Context
Project: {project.name}
Task: {task.title} (#{task.id})
Status: {task.status}
Branch: {task.branchName}

## Previous Context
{memoryContext}

## Instructions
{skillInstructions}

## Guidelines
1. 変更を加える前に現状を確認する
2. 小さな変更を積み重ねる
3. テストを書く/実行する
4. 決定事項を明記する
5. 次のステップを提案する
`;
```

## カスタムエージェント

```yaml
# .agentmine/config.yaml
agents:
  # カスタムエージェント
  security-auditor:
    description: "セキュリティ監査担当"
    model: claude-opus
    tools:
      - Read
      - Grep
      - Glob
      - WebSearch
    skills:
      - security-audit
      - vulnerability-check
    config:
      temperature: 0.2
      systemPrompt: |
        あなたはセキュリティ専門家です。
        コードのセキュリティ脆弱性を徹底的に調査してください。
        OWASP Top 10を常に念頭に置いてください。
```

## エージェント間連携（将来）

```yaml
# ワークフロー定義
workflows:
  feature-implementation:
    steps:
      - agent: planner
        action: design
        output: design-doc
      
      - agent: coder
        action: implement
        input: design-doc
        output: code
      
      - agent: reviewer
        action: review
        input: code
        output: review-comments
      
      - agent: coder
        action: fix
        input: review-comments
        condition: review-comments.hasIssues
```
