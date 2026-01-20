# MCP Integration

Model Context Protocol (MCP) によるエディタ連携。

## 概要

MCPサーバーを提供し、Cursor/Windsurf/Claude Desktop等の
MCP対応クライアントからagentmineを操作可能にする。

## Design Philosophy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MCP = CLIラッパー                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【方針】                                                            │
│  MCPは独自実装ではなく、CLIコマンドのラッパーとして動作する          │
│  MCP Tool → agentmine CLI → 結果返却                                │
│                                                                     │
│  【理由】                                                            │
│  - 現在の主流はSkills/CLIベースの操作                               │
│  - CLIとMCPで二重実装を避ける                                       │
│  - CLIのexit codeとエラー処理を統一                                 │
│                                                                     │
│  【Worktree管理】                                                    │
│  worktree作成はagentmineが担当し、MCPはCLI経由で実行する             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 設計目標

1. **CLIラッパー**: 各MCPツールは対応するCLIコマンドを呼び出す
2. **シームレス連携**: エディタから離れずにタスク管理
3. **Memory Bank連携**: プロジェクト決定事項の参照・追加
4. **コード共有**: CLI/MCP間でロジックを共有

## MCP Protocol

### 概要

```
┌─────────────────┐                    ┌─────────────────┐
│  MCP Client     │                    │  MCP Server     │
│  (Cursor etc.)  │◄──── JSON-RPC ────►│  (agentmine)    │
│                 │     over stdio     │                 │
│  Orchestrator (AI)        │                    │  Blackboard     │
└─────────────────┘                    └─────────────────┘
```

### 通信フロー

```
Client (Orchestrator)                         Server (agentmine)
  │                                    │
  │  initialize                        │
  │ ──────────────────────────────────►│
  │                                    │
  │  initialized                       │
  │ ◄──────────────────────────────────│
  │                                    │
  │  tools/list                        │
  │ ──────────────────────────────────►│
  │                                    │
  │  tools: [task_*, worker_*, ...]    │
  │ ◄──────────────────────────────────│
  │                                    │
  │  tools/call: worker_command        │
  │ ──────────────────────────────────►│
  │                                    │
  │  result: { worktree: ".agentmine/worktrees/..." }│
  │ ◄──────────────────────────────────│
```

## 設定

### クライアント設定

```json
// Cursor: .cursor/mcp.json
// Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "agentmine": {
      "command": "agentmine",
      "args": ["mcp", "serve"],
      "cwd": "/path/to/project"
    }
  }
}
```

### サーバー起動

```bash
# stdio通信（デフォルト）
agentmine mcp serve

# デバッグモード
agentmine mcp serve --verbose
```

## MCP Tools

### タスク管理

#### task_list

タスク一覧を取得。

```typescript
{
  name: "task_list",
  description: "Get list of tasks",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["open", "in_progress", "done", "failed", "cancelled"],
        description: "Filter by status"
      },
      assignee: {
        type: "string",
        description: "Filter by assignee name"
      },
      limit: {
        type: "number",
        default: 20,
        description: "Maximum number of tasks to return"
      }
    }
  }
}

// Response
{
  tasks: [
    {
      id: 1,
      title: "認証機能実装",
      status: "open",
      priority: "high",
      assignee: null
    },
    ...
  ]
}
```

#### task_get

タスク詳細を取得。

```typescript
{
  name: "task_get",
  description: "Get task details",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "number",
        description: "Task ID"
      }
    },
    required: ["id"]
  }
}
```

#### task_create

タスクを作成。

```typescript
{
  name: "task_create",
  description: "Create a new task",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "critical"]
      },
      type: {
        type: "string",
        enum: ["task", "feature", "bug", "refactor"]
      },
      assignee: { type: "string" },
      assigneeType: {
        type: "string",
        enum: ["ai", "human"]
      }
    },
    required: ["title"]
  }
}
```

#### task_update

タスクを更新。

```typescript
{
  name: "task_update",
  description: "Update a task",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "number" },
      title: { type: "string" },
      description: { type: "string" },
      priority: { type: "string" },
      assignee: { type: "string" },
      labels: { type: "string", description: "Comma-separated labels" }
    },
    required: ["id"]
  }
}
```

### Worker起動コマンド（Orchestrator向け）

#### worker_command

Worker起動用のコマンドを生成（実行はOrchestratorが行う）。
この時、agentmineがworktree作成/スコープ適用を行う。

```typescript
{
  name: "worker_command",
  description: "Generate worker launch command for a task",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "number" },
      agent: {
        type: "string",
        description: "Agent name (default: from task or 'coder')"
      },
      client: {
        type: "string",
        enum: ["claude-code", "codex", "gemini-cli"],
        description: "AI client (default: from agent definition)"
      },
      auto: {
        type: "boolean",
        description: "Add auto-approval flags",
        default: false
      }
    },
    required: ["taskId"]
  }
}

// Response
{
  command: "cd /project/.agentmine/worktrees/task-5 && claude --print \"$(cat <<'PROMPT'\n# Worker: coder\n...\nPROMPT\n)\"",
  client: "claude-code",
  worktree: ".agentmine/worktrees/task-5",
  sessionId: 123,
  agent: "coder",
  task: {
    id: 5,
    title: "認証機能実装",
    branch: "task-5-s123"
  }
}
```

### セッション管理（Orchestrator向け）

#### session_start

セッションを開始（`worker_command` / `worker_run` を使わない手動/外部Worker運用時のみ）。

```typescript
{
  name: "session_start",
  description: "Start a new session for a task",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "number" },
      agent: { type: "string" },
      sessionGroupId: { type: "string" },
      idempotencyKey: { type: "string" }
    },
    required: ["taskId", "agent"]
  }
}

// Response
{
  sessionId: 123,
  startedAt: "2024-01-15T10:30:00Z"
}
```

#### session_end

セッションを終了（終了後の詳細記録を追記したい場合や手動運用時に使用）。

```typescript
{
  name: "session_end",
  description: "End a session",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "number" },
      exitCode: {
        type: "number",
        description: "Worker process exit code"
      },
      signal: {
        type: "string",
        description: "Termination signal (SIGTERM, SIGKILL, etc.)"
      },
      dodResult: {
        type: "string",
        enum: ["pending", "merged", "timeout", "error"],
        description: "Definition of Done result"
      },
      artifacts: {
        type: "array",
        items: { type: "string" },
        description: "List of modified file paths (worktree relative)"
      },
      error: {
        type: "object",
        description: "Error details if failed",
        properties: {
          type: { type: "string", enum: ["timeout", "crash", "signal", "unknown"] },
          message: { type: "string" }
        }
      }
    },
    required: ["sessionId", "exitCode"]
  }
}

// CLI wrapper
// → agentmine session end <sessionId> --exit-code <code> --dod-result <result> ...
```

#### session_list

セッション一覧を取得。

```typescript
{
  name: "session_list",
  description: "List sessions",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "number" },
      status: { type: "string" }
    }
  }
}
```

### エージェント定義

#### agent_list

エージェント定義一覧を取得。

```typescript
{
  name: "agent_list",
  description: "List agent definitions",
  inputSchema: {
    type: "object",
    properties: {}
  }
}

// Response
{
  agents: [
    {
      name: "coder",
      client: "claude-code",
      model: "sonnet",
      scope: { read: ["**/*"], write: ["src/**"], exclude: ["**/*.env"] }
    },
    {
      name: "reviewer",
      client: "claude-code",
      model: "haiku",
      scope: { read: ["**/*"], write: [], exclude: [] }
    }
  ]
}
```

#### agent_get

エージェント定義詳細を取得。

```typescript
{
  name: "agent_get",
  description: "Get agent definition details",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" }
    },
    required: ["name"]
  }
}
```

### Memory Bank

#### memory_list

プロジェクト決定事項一覧を取得。

```typescript
{
  name: "memory_list",
  description: "List Memory Bank entries",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string" },
      status: {
        type: "string",
        enum: ["draft", "active", "archived"]
      }
    }
  }
}

// Response
{
  memories: [
    {
      id: "test-framework",
      category: "tooling",
      title: "テストフレームワーク",
      summary: "Vitest（高速・Vite互換）",
      status: "active"
    }
  ]
}
```

#### memory_add

決定事項を追加。

```typescript
{
  name: "memory_add",
  description: "Add a Memory Bank entry",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string" },
      category: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      status: {
        type: "string",
        enum: ["draft", "active", "archived"]
      },
      content: { type: "string" }
    },
    required: ["id", "category", "title"]
  }
}
```

#### memory_preview

AIに渡されるコンテキストをプレビュー。

```typescript
{
  name: "memory_preview",
  description: "Preview the context that will be passed to AI",
  inputSchema: {
    type: "object",
    properties: {}
  }
}

// Response
{
  context: "## Memory Bank Summary\n- ルール: バグ修正時は必ず回帰テストを追加\n\n## Project Context (Memory Bank)\n- .agentmine/memory/rule/test-required.md - テスト必須\n\nRead these files in .agentmine/memory/ for details."
}
```

## MCP Resources

### project://memory

Memory Bankの内容。

```typescript
{
  uri: "project://memory",
  name: "Memory Bank",
  description: "Memory Bank summary and references",
  mimeType: "text/markdown"
}

// コンテンツ形式（memory preview と同一）
`
## Memory Bank Summary
- ルール: バグ修正時は必ず回帰テストを追加
- 規約: コミット形式はConventional Commits
- アーキテクチャ: DBはPostgreSQL（本番）/ SQLite（ローカル）

## Project Context (Memory Bank)
- .agentmine/memory/architecture/database-selection.md - データベース選定
- .agentmine/memory/rule/test-required.md - テスト必須

Read these files in .agentmine/memory/ for details.
`
```

### task://{id}

タスクの詳細情報。

```typescript
{
  uri: "task://5",
  name: "Task #5",
  description: "Task details for #5",
  mimeType: "application/json"
}

// コンテンツ形式
{
  "id": 5,
  "title": "認証機能実装",
  "description": "JWT認証を実装する",
  "status": "in_progress",
  "priority": "high",
  "type": "feature",
  "assigneeType": "ai",
  "assigneeName": "coder",
  "selectedSessionId": 123,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T12:00:00Z",
  // セッション履歴は含まない（別途 session_list で取得）
}
```

### agent://{name}

エージェント定義。

```typescript
{
  uri: "agent://coder",
  name: "Agent: coder",
  description: "Agent definition for coder",
  mimeType: "application/yaml"
}

// コンテンツ形式（DBから生成したYAML）
// promptContent は必要に応じて省略/短縮可
`
name: coder
description: コード実装担当
client: claude-code
model: sonnet
scope:
  read:
    - "**/*"
  write:
    - "src/**"
    - "tests/**"
  exclude:
    - "**/*.env"
config:
  temperature: 0.3
promptContent: |
  # コード実装担当
  役割と制約をここに記述
`
```

## 実装

### MCPサーバー（CLIラッパー）

```typescript
// packages/cli/src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execSync } from 'child_process';

export async function startMcpServer() {
  const server = new Server(
    {
      name: 'agentmine',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Tools（全てCLIラッパー）
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // Task management
      taskListTool,      // → agentmine task list --json
      taskGetTool,       // → agentmine task get <id> --json
      taskCreateTool,    // → agentmine task add ...
      taskUpdateTool,    // → agentmine task update <id> ...
      // Worker command (Orchestrator)
      workerCommandTool, // → agentmine worker command <taskId>
      // Session management (Orchestrator)
      sessionStartTool,  // → agentmine session start <taskId>
      sessionEndTool,    // → agentmine session end <id> --exit-code ...
      sessionListTool,   // → agentmine session list --json
      // Agent definitions
      agentListTool,     // → agentmine agent list --json
      agentGetTool,      // → agentmine agent show <name> --format json
      // Memory Bank
      memoryListTool,    // → agentmine memory list --json
      memoryAddTool,     // → agentmine memory add ...
      memoryPreviewTool, // → agentmine memory preview
    ],
  }));

  // CLIラッパー実行
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return executeCLIWrapper(name, args);
  });

  // Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: 'project://memory', name: 'Memory Bank' },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'project://memory') {
      return { contents: [{ text: await getMemoryBankContent() }] };
    }

    if (uri.startsWith('task://')) {
      const taskId = parseInt(uri.replace('task://', ''));
      return { contents: [{ text: JSON.stringify(await getTask(taskId)) }] };
    }

    if (uri.startsWith('agent://')) {
      const agentName = uri.replace('agent://', '');
      return { contents: [{ text: await getAgentDefinition(agentName) }] };
    }
  });

  // Start
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// CLIラッパー実行
async function executeCLIWrapper(toolName: string, args: Record<string, any>) {
  const cliCommand = buildCLICommand(toolName, args);

  try {
    const result = execSync(cliCommand, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    return { content: [{ type: 'text', text: result }] };
  } catch (error) {
    const exitCode = error.status;
    const stderr = error.stderr?.toString() || error.message;
    throw cliExitCodeToMcpError(exitCode, stderr);
  }
}

// ツール名 → CLIコマンド変換
function buildCLICommand(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case 'task_list':
      return `agentmine task list --json ${args.status ? `--status ${args.status}` : ''}`;
    case 'task_get':
      return `agentmine task get ${args.id} --json`;
    case 'session_end':
      return `agentmine session end ${args.sessionId} --exit-code ${args.exitCode} ${
        args.dodResult ? `--dod-result ${args.dodResult}` : ''
      } ${args.signal ? `--signal ${args.signal}` : ''}`;
    // ...
  }
}
```

## 使用例

### Orchestratorによる並列実行準備

```
Orchestrator: 3つのタスクを並列実行します。

<tool_use: task_list status="open">
→ Tasks: #3, #4, #5

<tool_use: worker_command taskId=3 agent="coder">
→ Command: claude-code exec "..."
→ Worktree prepared: .agentmine/worktrees/task-3
→ Session started: id=101

Orchestrator: Workerを起動します（サブプロセス）
```

### Memory Bank参照

```
Orchestrator: プロジェクトの決定事項を確認します。

<tool_use: memory_list>
→ Memories:
  - [tooling] test-framework (active): テストフレームワーク - Vitest（高速・Vite互換）
  - [architecture] database-selection (active): データベース - PostgreSQL
  - [convention] commit-format (draft): コミット形式 - Conventional Commits

Orchestrator: 新しい決定事項を追加します。

<tool_use: memory_add id="linter" category="tooling" title="Linter" summary="ESLint + Biome" status="active">
→ Added memory "linter"
```

## エラーハンドリング

```typescript
// MCPエラーコード（CLIのexit codeと対応）
const ErrorCodes = {
  // CLI exit code 5: リソース不存在
  TaskNotFound: -32001,
  AgentNotFound: -32002,
  SessionNotFound: -32003,

  // CLI exit code 6: 状態エラー
  InvalidStatus: -32004,
  SessionAlreadyRunning: -32005,

  // CLI exit code 3: 設定エラー
  ConfigError: -32006,

  // CLI exit code 2: 引数エラー
  ValidationError: -32007,

  // CLI exit code 5: Git操作エラー
  GitError: -32008,
};

// エラーレスポンス
{
  error: {
    code: -32001,
    message: "Task not found",
    data: { taskId: 999 }
  }
}

// CLIエラーからの変換
function cliExitCodeToMcpError(exitCode: number, stderr: string): McpError {
  switch (exitCode) {
    case 5: // リソース不存在
      if (stderr.includes('Task')) return { code: -32001, message: stderr };
      if (stderr.includes('Agent')) return { code: -32002, message: stderr };
      if (stderr.includes('Session')) return { code: -32003, message: stderr };
      return { code: -32008, message: stderr }; // Git error
    case 6: // 状態エラー
      if (stderr.includes('already running')) return { code: -32005, message: stderr };
      return { code: -32004, message: stderr };
    // ...
  }
}
```

## デバッグ

```bash
# 詳細ログ
agentmine mcp serve --verbose

# ログファイル
tail -f .agentmine/logs/mcp.log

# テスト呼び出し
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | agentmine mcp serve
```

## References

- **@../architecture.md** - システム概要
- **@./agent-execution.md** - Agent実行フロー
- **@./memory-bank.md** - Memory Bank
