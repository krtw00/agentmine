import { Command } from 'commander'
import chalk from 'chalk'
import {
  createDb,
  initializeDb,
  isProjectInitialized,
  TaskService,
  SessionService,
  AgentService,
  MemoryService,
  ConfigService,
  type Db,
  type Task,
  type Session,
  type Agent,
  type Memory,
} from '@agentmine/core'

// ============================================
// MCP Types (simplified)
// ============================================

interface McpRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: Record<string, unknown>
}

interface McpResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

// ============================================
// MCP Server
// ============================================

class McpServer {
  private db: Db
  private taskService: TaskService
  private sessionService: SessionService
  private agentService: AgentService
  private memoryService: MemoryService
  private configService: ConfigService
  private initialized: Promise<void>

  constructor() {
    this.db = createDb()
    this.taskService = new TaskService(this.db)
    this.sessionService = new SessionService(this.db)
    this.agentService = new AgentService(this.db)
    this.memoryService = new MemoryService(this.db)
    this.configService = new ConfigService()
    this.initialized = initializeDb(this.db)
  }

  private async ensureInitialized(): Promise<void> {
    await this.initialized
  }

  /**
   * Get list of available tools
   */
  getTools(): McpTool[] {
    return [
      // Task tools
      {
        name: 'task_list',
        description: 'List all tasks with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['open', 'in_progress', 'done', 'failed', 'cancelled'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            type: { type: 'string', enum: ['task', 'feature', 'bug', 'refactor'] },
            limit: { type: 'number' },
          },
        },
      },
      {
        name: 'task_get',
        description: 'Get a task by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Task ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'task_create',
        description: 'Create a new task',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title' },
            description: { type: 'string', description: 'Task description' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            type: { type: 'string', enum: ['task', 'feature', 'bug', 'refactor'] },
            parentId: { type: 'number', description: 'Parent task ID' },
          },
          required: ['title'],
        },
      },
      {
        name: 'task_update',
        description: 'Update a task',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Task ID' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['open', 'in_progress', 'done', 'failed', 'cancelled'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          },
          required: ['id'],
        },
      },

      // Session tools
      {
        name: 'session_list',
        description: 'List all sessions',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['running', 'completed', 'failed', 'cancelled'] },
            agentName: { type: 'string' },
            taskId: { type: 'number' },
          },
        },
      },
      {
        name: 'session_get',
        description: 'Get a session by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Session ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'session_start',
        description: 'Start a new session for a task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'number', description: 'Task ID' },
            agentName: { type: 'string', description: 'Agent name' },
          },
          required: ['taskId', 'agentName'],
        },
      },
      {
        name: 'session_end',
        description: 'End a running session',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Session ID' },
            status: { type: 'string', enum: ['completed', 'failed', 'cancelled'] },
            exitCode: { type: 'number' },
          },
          required: ['id', 'status'],
        },
      },

      // Agent tools
      {
        name: 'agent_list',
        description: 'List all agents',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'agent_get',
        description: 'Get an agent by name',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Agent name' },
          },
          required: ['name'],
        },
      },

      // Memory tools
      {
        name: 'memory_list',
        description: 'List all memory entries',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Filter by category' },
            status: { type: 'string', enum: ['draft', 'active', 'archived'], description: 'Filter by status' },
          },
        },
      },
      {
        name: 'memory_get',
        description: 'Get a memory entry by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Memory entry ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'memory_create',
        description: 'Create a new memory entry',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Category (e.g., "decisions", "context")' },
            title: { type: 'string', description: 'Memory title' },
            content: { type: 'string', description: 'Content to write' },
            summary: { type: 'string', description: 'Short summary (optional)' },
          },
          required: ['category', 'title', 'content'],
        },
      },
      {
        name: 'memory_update',
        description: 'Update a memory entry',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Memory entry ID' },
            title: { type: 'string', description: 'New title (optional)' },
            content: { type: 'string', description: 'New content (optional)' },
            summary: { type: 'string', description: 'New summary (optional)' },
            category: { type: 'string', description: 'New category (optional)' },
          },
          required: ['id'],
        },
      },
      {
        name: 'memory_archive',
        description: 'Archive a memory entry',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Memory entry ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'memory_preview',
        description: 'Get memory bank preview for AI consumption',
        inputSchema: {
          type: 'object',
          properties: {
            compact: { type: 'boolean', description: 'Use compact format' },
          },
        },
      },

      // Config tools
      {
        name: 'config_get',
        description: 'Get current configuration',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ]
  }

  /**
   * Handle tool call
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    await this.ensureInitialized()

    switch (name) {
      // Task tools
      case 'task_list':
        return this.taskService.findAll(args as any)
      case 'task_get':
        return this.taskService.findById(args.id as number)
      case 'task_create':
        return this.taskService.create(args as any)
      case 'task_update':
        return this.taskService.update(args.id as number, args as any)

      // Session tools
      case 'session_list':
        return this.sessionService.findAll(args as any)
      case 'session_get':
        return this.sessionService.findById(args.id as number)
      case 'session_start':
        return this.sessionService.start(args as any)
      case 'session_end':
        return this.sessionService.end(args.id as number, args as any)

      // Agent tools
      case 'agent_list':
        return this.agentService.findAll()
      case 'agent_get':
        return this.agentService.findByName(args.name as string)

      // Memory tools
      case 'memory_list':
        return this.memoryService.list({
          category: args.category as string | undefined,
          status: args.status as 'draft' | 'active' | 'archived' | undefined,
        })
      case 'memory_get':
        return this.memoryService.get(args.id as number)
      case 'memory_create':
        return this.memoryService.create({
          category: args.category as string,
          title: args.title as string,
          content: args.content as string,
          summary: args.summary as string | undefined,
        })
      case 'memory_update':
        return this.memoryService.update(args.id as number, {
          title: args.title as string | undefined,
          content: args.content as string | undefined,
          summary: args.summary as string | undefined,
          category: args.category as string | undefined,
        })
      case 'memory_archive':
        return this.memoryService.archive(args.id as number)
      case 'memory_preview':
        return args.compact
          ? this.memoryService.previewCompact()
          : this.memoryService.preview()

      // Config tools
      case 'config_get':
        return this.configService.loadWithDefaults()

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  /**
   * Handle incoming MCP request
   */
  async handleRequest(request: McpRequest): Promise<McpResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'agentmine',
                version: '0.1.0',
              },
            },
          }

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: this.getTools(),
            },
          }

        case 'tools/call':
          const params = request.params as { name: string; arguments?: Record<string, unknown> }
          const result = await this.callTool(params.name, params.arguments || {})
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            },
          }

        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`,
            },
          }
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      }
    }
  }

  /**
   * Start stdio server
   */
  async serve(): Promise<void> {
    const readline = await import('readline')

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })

    rl.on('line', async (line) => {
      try {
        const request = JSON.parse(line) as McpRequest
        const response = await this.handleRequest(request)
        console.log(JSON.stringify(response))
      } catch (error) {
        const errorResponse: McpResponse = {
          jsonrpc: '2.0',
          id: 0,
          error: {
            code: -32700,
            message: 'Parse error',
          },
        }
        console.log(JSON.stringify(errorResponse))
      }
    })

    rl.on('close', () => {
      process.exit(0)
    })
  }
}

// ============================================
// Commands
// ============================================

export const mcpCommand = new Command('mcp')
  .description('MCP server commands')

// mcp serve
mcpCommand
  .command('serve')
  .description('Start MCP server (stdio)')
  .action(async () => {
    if (!isProjectInitialized()) {
      process.stderr.write('Error: agentmine not initialized\n')
      process.exit(3)
    }

    const server = new McpServer()
    await server.serve()
  })

// mcp tools
mcpCommand
  .command('tools')
  .description('List available MCP tools')
  .option('--json', 'JSON output')
  .action(async (options) => {
    if (!isProjectInitialized()) {
      console.error(chalk.red('Error: agentmine not initialized'))
      process.exit(3)
    }

    const server = new McpServer()
    const tools = server.getTools()

    if (options.json) {
      console.log(JSON.stringify(tools, null, 2))
      return
    }

    console.log(chalk.bold('Available MCP Tools:'))
    console.log('')

    for (const tool of tools) {
      console.log(chalk.cyan(tool.name))
      console.log(chalk.gray(`  ${tool.description}`))

      const required = tool.inputSchema.required || []
      const props = Object.entries(tool.inputSchema.properties)
      if (props.length > 0) {
        console.log(chalk.gray('  Parameters:'))
        for (const [name, schema] of props) {
          const isRequired = required.includes(name)
          const s = schema as Record<string, unknown>
          console.log(chalk.gray(`    ${name}${isRequired ? '*' : ''}: ${s.type || 'any'}`))
        }
      }
      console.log('')
    }
  })
