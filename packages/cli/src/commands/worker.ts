import { Command } from 'commander'
import chalk from 'chalk'
import { spawn } from 'node:child_process'
import {
  createDb,
  isProjectInitialized,
  TaskService,
  SessionService,
  AgentService,
  WorktreeService,
  MemoryService,
  TaskNotFoundError,
  WorktreeAlreadyExistsError,
  WorktreeNotFoundError,
  type Task,
  type AgentDefinition,
} from '@agentmine/core'

// ============================================
// Helpers
// ============================================

function ensureInitialized(): boolean {
  if (!isProjectInitialized()) {
    console.error(chalk.red('Error: agentmine not initialized'))
    console.log(chalk.gray('Run `agentmine init` first'))
    process.exit(3)
  }
  return true
}

function getServices() {
  const db = createDb()
  return {
    taskService: new TaskService(db),
    sessionService: new SessionService(db),
    agentService: new AgentService(),
    worktreeService: new WorktreeService(),
    memoryService: new MemoryService(),
  }
}

interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

// ============================================
// AI Client Launcher
// ============================================

interface ClientConfig {
  command: string
  args: (prompt: string, model?: string) => string[]
}

// Non-interactive (autonomous) mode configurations for each AI client
const CLIENT_CONFIGS: Record<string, ClientConfig> = {
  'claude-code': {
    command: 'claude',
    args: (prompt, model) => {
      // Non-interactive: --dangerously-skip-permissions for autonomous execution
      const args = ['--dangerously-skip-permissions']
      if (model) args.push('--model', model)
      args.push(prompt)
      return args
    },
  },
  'claude': {
    command: 'claude',
    args: (prompt, model) => {
      const args = ['--dangerously-skip-permissions']
      if (model) args.push('--model', model)
      args.push(prompt)
      return args
    },
  },
  'codex': {
    command: 'codex',
    args: (prompt, model) => {
      // Non-interactive: --full-auto for autonomous execution
      const args = ['--full-auto']
      if (model) args.push('-m', model)
      args.push(prompt)
      return args
    },
  },
  'opencode': {
    command: 'opencode',
    args: (prompt) => {
      // OpenCode: --auto-approve for autonomous execution
      return ['--auto-approve', prompt]
    },
  },
  'aider': {
    command: 'aider',
    args: (prompt) => {
      // Aider: --yes for autonomous execution
      return ['--yes', '--message', prompt]
    },
  },
  'gemini': {
    command: 'gemini',
    args: (prompt, model) => {
      // Gemini CLI: -y for auto-approve
      const args = ['-y']
      if (model) args.push('-m', model)
      args.push(prompt)
      return args
    },
  },
  'gemini-cli': {
    command: 'gemini',
    args: (prompt, model) => {
      const args = ['-y']
      if (model) args.push('-m', model)
      args.push(prompt)
      return args
    },
  },
}

function getClientConfig(clientName: string): ClientConfig | null {
  const normalized = clientName.toLowerCase()
  return CLIENT_CONFIGS[normalized] || null
}

async function launchWorkerAI(
  client: string,
  prompt: string,
  cwd: string,
  model?: string
): Promise<number> {
  const config = getClientConfig(client)

  if (!config) {
    console.error(chalk.red(`Unknown AI client: ${client}`))
    console.log(chalk.gray('Supported clients: ' + Object.keys(CLIENT_CONFIGS).join(', ')))
    return 1
  }

  const args = config.args(prompt, model)

  return new Promise((resolve) => {
    const child = spawn(config.command, args, {
      cwd,
      stdio: 'inherit', // Pass through stdin/stdout/stderr for interactive session
      shell: false, // Don't use shell to avoid escaping issues with complex prompts
    })

    child.on('error', (error) => {
      console.error(chalk.red(`Failed to start ${client}: ${error.message}`))
      resolve(1)
    })

    child.on('close', (code) => {
      resolve(code ?? 0)
    })
  })
}

// ============================================
// Commands
// ============================================

export const workerCommand = new Command('worker')
  .description('Worker commands for task execution')

// worker run - Set up worktree and optionally launch AI
workerCommand
  .command('run <taskId>')
  .description('Create worktree for a task and optionally start Worker AI')
  .option('-a, --agent <name>', 'Agent name (default: coder)', 'coder')
  .option('--exec [client]', 'Start Worker AI (uses agent client if not specified)')
  .option('--no-worktree', 'Skip worktree creation (work in current directory)')
  .option('--json', 'JSON output')
  .action(async (taskId, options) => {
    ensureInitialized()
    const { taskService, sessionService, agentService, worktreeService, memoryService } = getServices()

    // Get task
    const task = await taskService.findById(parseInt(taskId))
    if (!task) {
      console.error(chalk.red(`Task #${taskId} not found`))
      process.exit(5)
    }

    // Get agent
    const agent = agentService.findByName(options.agent)
    if (!agent) {
      console.error(chalk.red(`Agent "${options.agent}" not found`))
      process.exit(5)
    }

    let worktreeInfo = null
    let scopeApplied = false

    // Create worktree (unless --no-worktree)
    if (options.worktree !== false) {
      let isNewWorktree = false
      try {
        worktreeInfo = worktreeService.create({ taskId: parseInt(taskId) })
        isNewWorktree = true
      } catch (error) {
        if (error instanceof WorktreeAlreadyExistsError) {
          // Worktree already exists, get info
          worktreeInfo = worktreeService.getInfo(parseInt(taskId))
          if (!options.json) {
            console.log(chalk.yellow(`⚠ Worktree already exists for task #${taskId}`))
          }
        } else {
          console.error(chalk.red(`Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`))
          process.exit(1)
        }
      }

      // Apply scope restrictions to worktree (only for new worktrees)
      if (isNewWorktree && agent.scope) {
        try {
          const scopeResult = worktreeService.applyScope(parseInt(taskId), agent.scope)
          scopeApplied = true
          if (!options.json && (scopeResult.deletedCount > 0 || scopeResult.readOnlyCount > 0)) {
            console.log(chalk.gray(`  Scope applied: ${scopeResult.deletedCount} files excluded, ${scopeResult.readOnlyCount} files read-only`))
          }
        } catch (error) {
          if (!options.json) {
            console.log(chalk.yellow(`⚠ Failed to apply scope: ${error instanceof Error ? error.message : 'Unknown error'}`))
          }
        }
      }

      // Update task with branch name
      await taskService.update(parseInt(taskId), {
        branchName: worktreeInfo.branchName,
        status: 'in_progress',
      })
    } else {
      // Update task status only
      await taskService.update(parseInt(taskId), { status: 'in_progress' })
    }

    // Start session
    let session
    try {
      session = await sessionService.start({
        taskId: parseInt(taskId),
        agentName: options.agent,
      })
    } catch (error) {
      // Session might already exist
      session = await sessionService.findByTask(parseInt(taskId))
      if (!session) {
        throw error
      }
    }

    // Build prompt
    const prompt = buildPromptFromTask(task, memoryService)

    // Determine client to use
    // --exec true (no value) -> use agent's client
    // --exec <client> -> use specified client
    // no --exec -> show instructions only
    const execClient = options.exec === true ? agent.client : options.exec

    // Working directory for AI
    const workingDir = worktreeInfo?.path || process.cwd()

    if (options.json) {
      console.log(JSON.stringify({
        task: { id: task.id, title: task.title },
        session: { id: session.id, agentName: session.agentName },
        worktree: worktreeInfo,
        prompt,
        exec: execClient || null,
      }, null, 2))

      if (execClient) {
        const exitCode = await launchWorkerAI(execClient, prompt, workingDir, agent.model)
        process.exit(exitCode)
      }
      return
    }

    // Display status
    console.log('')
    console.log(chalk.green('✓ Worker environment ready'))

    if (worktreeInfo) {
      console.log(chalk.gray('Worktree: '), chalk.cyan(worktreeInfo.path))
      console.log(chalk.gray('Branch:   '), chalk.cyan(worktreeInfo.branchName))
    }
    console.log(chalk.gray('Session:  '), chalk.cyan(`#${session.id}`))
    console.log(chalk.gray('Task:     '), chalk.cyan(`#${task.id}: ${task.title}`))
    console.log('')

    // If --exec specified, launch AI
    if (execClient) {
      console.log(chalk.green(`✓ Starting Worker AI (${execClient})...`))
      console.log('')

      const exitCode = await launchWorkerAI(execClient, prompt, workingDir, agent.model)

      console.log('')
      if (exitCode === 0) {
        console.log(chalk.green(`✓ Worker AI exited (code: ${exitCode})`))
      } else {
        console.log(chalk.yellow(`⚠ Worker AI exited (code: ${exitCode})`))
      }

      console.log('')
      console.log(chalk.bold('To complete the task:'))
      console.log(chalk.cyan(`  agentmine worker done ${taskId}`))
      console.log('')
      return
    }

    // Show instructions (no --exec)
    const agentCommand = agentService.buildCommand(agent, prompt)

    console.log(chalk.bold('To start working:'))
    console.log('')

    if (worktreeInfo) {
      console.log(chalk.white(`  cd ${worktreeInfo.path}`))
      console.log('')
    }

    console.log(chalk.gray('  # Claude Code'))
    console.log(chalk.white(`  ${agentCommand}`))
    console.log('')
    console.log(chalk.gray('  # Or run with --exec to auto-start:'))
    console.log(chalk.white(`  agentmine worker run ${taskId} --exec`))
    console.log('')

    console.log(chalk.bold('When done:'))
    console.log(chalk.cyan(`  agentmine worker done ${taskId}`))
    console.log('')
  })

// worker done - Complete a task and clean up
workerCommand
  .command('done <taskId>')
  .description('Mark task as done and clean up worktree')
  .option('--status <status>', 'Final status (completed, failed)', 'completed')
  .option('--no-cleanup', 'Keep worktree after completion')
  .option('--json', 'JSON output')
  .action(async (taskId, options) => {
    ensureInitialized()
    const { taskService, sessionService, worktreeService } = getServices()

    // Get task
    const task = await taskService.findById(parseInt(taskId))
    if (!task) {
      console.error(chalk.red(`Task #${taskId} not found`))
      process.exit(5)
    }

    // End session if exists
    const session = await sessionService.findByTask(parseInt(taskId))
    if (session && session.status === 'running') {
      await sessionService.end(session.id, {
        status: options.status as 'completed' | 'failed',
      })
    }

    // Update task status
    const taskStatus = options.status === 'completed' ? 'done' : 'failed'
    await taskService.update(parseInt(taskId), { status: taskStatus })

    // Clean up worktree
    let worktreeRemoved = false
    if (options.cleanup !== false) {
      try {
        if (worktreeService.exists(parseInt(taskId))) {
          worktreeService.remove(parseInt(taskId))
          worktreeRemoved = true
        }
      } catch (error) {
        if (!options.json) {
          console.log(chalk.yellow(`⚠ Could not remove worktree: ${error instanceof Error ? error.message : 'Unknown error'}`))
          console.log(chalk.gray('  You may need to remove it manually or use --force'))
        }
      }
    }

    if (options.json) {
      console.log(JSON.stringify({
        taskId: parseInt(taskId),
        status: taskStatus,
        sessionEnded: !!session,
        worktreeRemoved,
      }))
      return
    }

    console.log(chalk.green(`✓ Task #${taskId} marked as ${taskStatus}`))
    if (session) {
      console.log(chalk.green(`✓ Session #${session.id} ended`))
    }
    if (worktreeRemoved) {
      console.log(chalk.green(`✓ Worktree removed`))
    }

    // Show merge instructions if completed
    if (options.status === 'completed' && task.branchName) {
      console.log('')
      console.log(chalk.bold('To merge changes:'))
      console.log(chalk.cyan(`  git merge ${task.branchName}`))
      console.log(chalk.gray('  or create a PR'))
    }
  })

// worker list - List active worktrees
workerCommand
  .command('list')
  .description('List active worktrees')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()
    const { worktreeService, taskService, sessionService } = getServices()

    const worktrees = worktreeService.list()

    if (options.json) {
      console.log(JSON.stringify(worktrees, null, 2))
      return
    }

    if (worktrees.length === 0) {
      console.log(chalk.gray('No active worktrees.'))
      console.log(chalk.gray('Start one with:'))
      console.log(chalk.cyan('  agentmine worker run <taskId>'))
      return
    }

    console.log(chalk.bold('Active Worktrees:'))
    console.log('')

    for (const wt of worktrees) {
      const task = await taskService.findById(wt.taskId)
      const session = await sessionService.findByTask(wt.taskId)

      console.log(chalk.cyan(`Task #${wt.taskId}:`), task?.title || '(unknown)')
      console.log(chalk.gray(`  Branch:   ${wt.branchName}`))
      console.log(chalk.gray(`  Path:     ${wt.path}`))
      if (session) {
        console.log(chalk.gray(`  Session:  #${session.id} (${session.status})`))
      }
      console.log('')
    }
  })

// worker cleanup - Remove a worktree
workerCommand
  .command('cleanup <taskId>')
  .description('Remove worktree for a task')
  .option('--force', 'Force removal even with uncommitted changes')
  .option('--json', 'JSON output')
  .action(async (taskId, options) => {
    ensureInitialized()
    const { worktreeService } = getServices()

    try {
      worktreeService.remove(parseInt(taskId), options.force)

      if (options.json) {
        console.log(JSON.stringify({ success: true, taskId: parseInt(taskId) }))
      } else {
        console.log(chalk.green(`✓ Worktree for task #${taskId} removed`))
      }
    } catch (error) {
      if (error instanceof WorktreeNotFoundError) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'Worktree not found' }))
        } else {
          console.error(chalk.red(`Worktree for task #${taskId} not found`))
        }
        process.exit(5)
      }
      throw error
    }
  })

// worker prompt - Generate the prompt for a task
workerCommand
  .command('prompt <taskId>')
  .description('Generate the prompt for a task')
  .option('--json', 'JSON output')
  .action(async (taskId, options: OutputOptions) => {
    ensureInitialized()
    const { taskService, memoryService } = getServices()

    const task = await taskService.findById(parseInt(taskId))
    if (!task) {
      console.error(chalk.red(`Task #${taskId} not found`))
      process.exit(5)
    }

    const prompt = buildPromptFromTask(task, memoryService)

    if (options.json) {
      console.log(JSON.stringify({ taskId: task.id, prompt }))
    } else {
      console.log(prompt)
    }
  })

// worker context - Show context for a task
workerCommand
  .command('context <taskId>')
  .description('Show context for a task')
  .option('--json', 'JSON output')
  .action(async (taskId, options: OutputOptions) => {
    ensureInitialized()
    const { taskService, sessionService, worktreeService } = getServices()

    const task = await taskService.findById(parseInt(taskId))
    if (!task) {
      console.error(chalk.red(`Task #${taskId} not found`))
      process.exit(5)
    }

    const subtasks = await taskService.getSubtasks(parseInt(taskId))
    const session = await sessionService.findByTask(parseInt(taskId))
    const worktree = worktreeService.getInfo(parseInt(taskId))

    let parentTask = null
    if (task.parentId) {
      parentTask = await taskService.findById(task.parentId)
    }

    const context = {
      task,
      parentTask,
      subtasks,
      session,
      worktree,
    }

    if (options.json) {
      console.log(JSON.stringify(context, null, 2))
      return
    }

    console.log('')
    console.log(chalk.bold.cyan(`Task #${task.id}: ${task.title}`))
    console.log('')

    if (task.description) {
      console.log(chalk.gray('Description:'))
      console.log(task.description)
      console.log('')
    }

    console.log(chalk.gray('Status:  '), task.status)
    console.log(chalk.gray('Priority:'), task.priority)
    console.log(chalk.gray('Type:    '), task.type)

    if (task.branchName) {
      console.log(chalk.gray('Branch:  '), task.branchName)
    }

    if (worktree.exists) {
      console.log(chalk.gray('Worktree:'), worktree.path)
    }

    if (parentTask) {
      console.log('')
      console.log(chalk.gray('Parent Task:'))
      console.log(chalk.gray(`  #${parentTask.id}: ${parentTask.title}`))
    }

    if (subtasks.length > 0) {
      console.log('')
      console.log(chalk.gray('Subtasks:'))
      subtasks.forEach(st => {
        const statusIcon = st.status === 'done' ? '✓' : st.status === 'in_progress' ? '→' : '○'
        console.log(chalk.gray(`  ${statusIcon} #${st.id}: ${st.title}`))
      })
    }

    if (session) {
      console.log('')
      console.log(chalk.gray('Session:'))
      console.log(chalk.gray(`  ID:     #${session.id}`))
      console.log(chalk.gray(`  Agent:  ${session.agentName}`))
      console.log(chalk.gray(`  Status: ${session.status}`))
    }

    console.log('')
  })

// ============================================
// Prompt Building
// ============================================

function buildPromptFromTask(task: Task, memoryService?: MemoryService): string {
  const parts: string[] = []

  // Task header
  parts.push(`# Task #${task.id}: ${task.title}`)
  parts.push('')

  // Metadata
  parts.push(`Type: ${task.type}`)
  parts.push(`Priority: ${task.priority}`)
  parts.push('')

  // Description
  if (task.description) {
    parts.push('## Description')
    parts.push(task.description)
    parts.push('')
  }

  // Branch info
  if (task.branchName) {
    parts.push('## Branch')
    parts.push(`Work on branch: ${task.branchName}`)
    parts.push('')
  }

  // Memory Bank context (compact)
  if (memoryService) {
    try {
      const preview = memoryService.previewCompact()
      if (preview && preview !== 'No memory entries.') {
        parts.push('## Context (from Memory Bank)')
        parts.push(preview)
        parts.push('')
      }
    } catch {
      // Ignore memory errors
    }
  }

  // Instructions
  parts.push('## Instructions')
  parts.push('1. Implement the changes required for this task')
  parts.push('2. Ensure all tests pass')
  parts.push('3. Commit your changes with a descriptive message')
  parts.push('')

  return parts.join('\n')
}
