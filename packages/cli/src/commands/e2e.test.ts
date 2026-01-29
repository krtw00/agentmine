import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'

const execAsync = promisify(exec)

/**
 * CLI E2E Tests
 *
 * These tests verify the full CLI workflow:
 * 1. Task creation/listing
 * 2. Worker execution (with test client)
 * 3. MCP server operations
 */

const CLI_PATH = path.resolve(__dirname, '../../dist/index.js')
// Project root where .agentmine/data.db exists
const PROJECT_ROOT = path.resolve(__dirname, '../../../../')
const runCli = (args: string) => `node ${CLI_PATH} ${args}`

// Default exec options - run from project root where .agentmine exists
const defaultExecOpts = { cwd: PROJECT_ROOT, timeout: 30000 }

describe('CLI E2E Tests', () => {
  // Use existing test database (project already initialized)

  describe('Task Commands', () => {
    let createdTaskId: number

    it('should create a task', async () => {
      const { stdout } = await execAsync(
        runCli('task add "E2E Test Task" --description "Created by E2E test" --json'),
        defaultExecOpts
      )
      const task = JSON.parse(stdout)

      expect(task.id).toBeDefined()
      expect(task.title).toBe('E2E Test Task')
      expect(task.status).toBe('open')
      createdTaskId = task.id
    })

    it('should list tasks', async () => {
      const { stdout } = await execAsync(runCli('task list --json'), defaultExecOpts)
      const tasks = JSON.parse(stdout)

      expect(Array.isArray(tasks)).toBe(true)
      expect(tasks.length).toBeGreaterThan(0)
    })

    it('should update a task', async () => {
      const { stdout } = await execAsync(
        runCli(`task update ${createdTaskId} --priority high --json`),
        defaultExecOpts
      )
      const task = JSON.parse(stdout)

      expect(task.priority).toBe('high')
    })

    afterAll(async () => {
      // Cleanup: delete the test task
      if (createdTaskId) {
        await execAsync(runCli(`task delete ${createdTaskId}`), defaultExecOpts).catch(() => {})
      }
    })
  })

  describe('Agent Commands', () => {
    it('should list agents', async () => {
      const { stdout } = await execAsync(runCli('agent list --json'), defaultExecOpts)
      const agents = JSON.parse(stdout)

      expect(Array.isArray(agents)).toBe(true)
      expect(agents.length).toBeGreaterThan(0)
    })

    it('should show agent by name', async () => {
      const { stdout } = await execAsync(runCli('agent show coder --json'), defaultExecOpts)
      const agent = JSON.parse(stdout)

      expect(agent.name).toBe('coder')
      expect(agent.client).toBeDefined()
    })
  })

  describe('Session Commands', () => {
    it('should list sessions', async () => {
      const { stdout } = await execAsync(runCli('session list --json'), defaultExecOpts)
      const sessions = JSON.parse(stdout)

      expect(Array.isArray(sessions)).toBe(true)
    })
  })

  describe('Worker Commands', () => {
    let testTaskId: number

    beforeAll(async () => {
      // Create a test task for worker tests
      const { stdout } = await execAsync(
        runCli('task add "Worker E2E Test" --description "For worker testing" --json'),
        defaultExecOpts
      )
      const task = JSON.parse(stdout)
      testTaskId = task.id
    })

    it('should run worker with test client (foreground)', async () => {
      const { stdout } = await execAsync(
        runCli(`worker run ${testTaskId} --exec test`),
        { ...defaultExecOpts, timeout: 60000 }
      )

      expect(stdout).toContain('Worker environment ready')
      expect(stdout).toContain('Worker AI exited')
    })

    it('should show worker status', async () => {
      const { stdout } = await execAsync(
        runCli(`worker status ${testTaskId}`),
        defaultExecOpts
      )

      expect(stdout).toContain('Task #')
    })

    afterAll(async () => {
      // Cleanup
      if (testTaskId) {
        await execAsync(runCli(`worker done ${testTaskId}`), defaultExecOpts).catch(() => {})
      }
    })
  })

  describe('MCP Server', () => {
    it('should respond to initialize request', async () => {
      const request = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      })

      const { stdout } = await execAsync(
        `echo '${request}' | ${runCli('mcp serve')}`,
        { ...defaultExecOpts, timeout: 10000 }
      )

      const response = JSON.parse(stdout)
      expect(response.jsonrpc).toBe('2.0')
      expect(response.result.protocolVersion).toBeDefined()
      expect(response.result.serverInfo.name).toBe('agentmine')
    })

    it('should list available tools', async () => {
      const request = JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      })

      const { stdout } = await execAsync(
        `echo '${request}' | ${runCli('mcp serve')}`,
        { ...defaultExecOpts, timeout: 10000 }
      )

      const response = JSON.parse(stdout)
      expect(response.result.tools).toBeDefined()
      expect(Array.isArray(response.result.tools)).toBe(true)

      // Check key tools exist
      const toolNames = response.result.tools.map((t: { name: string }) => t.name)
      expect(toolNames).toContain('task_list')
      expect(toolNames).toContain('task_create')
      expect(toolNames).toContain('session_list')
      expect(toolNames).toContain('agent_list')
      expect(toolNames).toContain('memory_list')
    })

    it('should execute tools/call for task_list', async () => {
      const request = JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'task_list',
          arguments: { limit: 5 },
        },
      })

      const { stdout } = await execAsync(
        `echo '${request}' | ${runCli('mcp serve')}`,
        { ...defaultExecOpts, timeout: 10000 }
      )

      const response = JSON.parse(stdout)
      expect(response.result.content).toBeDefined()
      expect(response.result.content[0].type).toBe('text')

      // Parse the embedded JSON
      const tasks = JSON.parse(response.result.content[0].text)
      expect(Array.isArray(tasks)).toBe(true)
    })
  })

  describe('Memory Commands', () => {
    it('should list memories', async () => {
      const { stdout } = await execAsync(runCli('memory list --json'), defaultExecOpts)
      const memories = JSON.parse(stdout)

      expect(Array.isArray(memories)).toBe(true)
    })
  })
})
