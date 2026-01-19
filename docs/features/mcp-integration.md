# MCP Integration

Model Context Protocol (MCP) によるエディタ連携。

## 概要

MCPサーバーを提供し、Cursor/Windsurf/Claude Desktop等の
MCP対応クライアントからagentmineを操作可能にする。

## 設計目標

1. **シームレス連携**: エディタから離れずにタスク管理
2. **双方向**: タスク取得だけでなく更新も可能
3. **コンテキスト共有**: Memory Bankとの連携
4. **リアルタイム**: 変更の即時反映

## MCP Protocol

### 概要

```
┌─────────────────┐                    ┌─────────────────┐
│  MCP Client     │                    │  MCP Server     │
│  (Cursor etc.)  │◄──── JSON-RPC ────►│  (agentmine)    │
└─────────────────┘     over stdio     └─────────────────┘
```

### 通信フロー

```
Client                              Server
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
  │  tools: [task_list, task_create..] │
  │ ◄──────────────────────────────────│
  │                                    │
  │  tools/call: task_list             │
  │ ──────────────────────────────────►│
  │                                    │
  │  result: [{id: 1, title: ...}]     │
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

### task_list

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
        enum: ["open", "in_progress", "review", "done", "cancelled"],
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

### task_get

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

### task_create

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

### task_update

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
      status: { type: "string" },
      priority: { type: "string" },
      assignee: { type: "string" }
    },
    required: ["id"]
  }
}
```

### task_start

タスクを開始（ブランチ作成）。

```typescript
{
  name: "task_start",
  description: "Start working on a task (creates branch)",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "number" }
    },
    required: ["id"]
  }
}

// Response
{
  success: true,
  branchName: "task-1-auth",
  message: "Checked out to task-1-auth"
}
```

### task_done

タスクを完了（PR作成）。

```typescript
{
  name: "task_done",
  description: "Complete a task (creates PR)",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "number" },
      draft: { type: "boolean", default: false }
    },
    required: ["id"]
  }
}

// Response
{
  success: true,
  prUrl: "https://github.com/user/repo/pull/12"
}
```

### context_load

コンテキストを読み込み。

```typescript
{
  name: "context_load",
  description: "Load context for a task",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "number" },
      includeProject: { type: "boolean", default: true }
    },
    required: ["taskId"]
  }
}

// Response
{
  context: "# Task Context\n\n## Previous Work\n..."
}
```

### context_save

コンテキストを保存。

```typescript
{
  name: "context_save",
  description: "Save context for current session",
  inputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      decisions: { 
        type: "array", 
        items: { type: "object" } 
      },
      nextSteps: { 
        type: "array", 
        items: { type: "string" } 
      }
    },
    required: ["summary"]
  }
}
```

### skill_run

スキルを実行。

```typescript
{
  name: "skill_run",
  description: "Run a skill",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      taskId: { type: "number" },
      params: { type: "object" }
    },
    required: ["name"]
  }
}
```

## MCP Resources

### project://context

プロジェクトコンテキスト。

```typescript
{
  uri: "project://context",
  name: "Project Context",
  description: "Current project context and state",
  mimeType: "text/markdown"
}
```

### task://{id}

タスクのコンテキスト。

```typescript
{
  uri: "task://5",
  name: "Task #5 Context",
  description: "Context for task #5",
  mimeType: "text/markdown"
}
```

## 実装

### MCPサーバー

```typescript
// packages/cli/src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

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

  // Tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      taskListTool,
      taskGetTool,
      taskCreateTool,
      taskUpdateTool,
      taskStartTool,
      taskDoneTool,
      contextLoadTool,
      contextSaveTool,
      skillRunTool,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    switch (name) {
      case 'task_list':
        return handleTaskList(args);
      case 'task_create':
        return handleTaskCreate(args);
      // ...
    }
  });

  // Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: 'project://context', name: 'Project Context' },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    if (uri === 'project://context') {
      return { contents: [{ text: await getProjectContext() }] };
    }
    
    if (uri.startsWith('task://')) {
      const taskId = parseInt(uri.replace('task://', ''));
      return { contents: [{ text: await getTaskContext(taskId) }] };
    }
  });

  // Start
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

## 使用例

### Cursorでの使用

```
User: 現在のタスク一覧を教えて
AI: <tool_use: task_list>

現在のタスクは以下の通りです：

| ID | Title | Status | Priority |
|----|-------|--------|----------|
| #1 | 認証機能実装 | open | high |
| #2 | API設計 | in_progress | medium |
| #3 | ダッシュボード | open | medium |

User: タスク#1を開始して

AI: <tool_use: task_start id=1>

タスク#1を開始しました。
ブランチ `task-1-auth` にチェックアウトしました。
```

### Claude Desktopでの使用

```
User: プロジェクトのコンテキストを読み込んで

AI: <resource_read: project://context>

プロジェクトの現在の状態：
- 完了: ユーザー認証基盤
- 進行中: API設計
- 次: ダッシュボード実装

前回の決定事項：
- JWT認証を採用
- PostgreSQLを使用

User: タスク#2の作業を保存して

AI: <tool_use: context_save>
  summary: "API設計のエンドポイント定義を完了"
  decisions:
    - title: "REST vs GraphQL"
      decision: "RESTを採用"
      reason: "シンプルさ優先"
  nextSteps:
    - "エンドポイントの実装"
    - "Swagger定義の作成"

コンテキストを保存しました。
```

## エラーハンドリング

```typescript
// MCPエラーコード
const ErrorCodes = {
  TaskNotFound: -32001,
  InvalidStatus: -32002,
  GitError: -32003,
  PermissionDenied: -32004,
};

// エラーレスポンス
{
  error: {
    code: -32001,
    message: "Task not found",
    data: { taskId: 999 }
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
