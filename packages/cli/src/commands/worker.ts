import { Command } from 'commander'
import chalk from 'chalk'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createDb,
  initializeDb,
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
  type Agent,
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

async function getServices() {
  const db = createDb()
  await initializeDb(db)
  return {
    taskService: new TaskService(db),
    sessionService: new SessionService(db),
    agentService: new AgentService(db),
    worktreeService: new WorktreeService(),
    memoryService: new MemoryService(db),
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
    args: (prompt, _model) => {
      // Non-interactive: exec subcommand with --full-auto for autonomous execution
      // Note: Model parameter is ignored for Codex (ChatGPT account doesn't support model selection)
      const args = ['exec', '--full-auto', prompt]
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
  // Test clients for development/testing
  'test': {
    command: 'sleep',
    args: () => ['3'],
  },
  'test-long': {
    command: 'sleep',
    args: () => ['60'],
  },
}

function getClientConfig(clientName: string): ClientConfig | null {
  const normalized = clientName.toLowerCase()
  return CLIENT_CONFIGS[normalized] || null
}

interface LaunchResult {
  pid?: number
  exitCode?: number
}

async function launchWorkerAI(
  client: string,
  prompt: string,
  cwd: string,
  model?: string,
  detach: boolean = false
): Promise<LaunchResult> {
  const config = getClientConfig(client)

  if (!config) {
    console.error(chalk.red(`Unknown AI client: ${client}`))
    console.log(chalk.gray('Supported clients: ' + Object.keys(CLIENT_CONFIGS).join(', ')))
    return { exitCode: 1 }
  }

  const args = config.args(prompt, model)

  if (detach) {
    // Detach mode: spawn and return immediately with PID
    const child = spawn(config.command, args, {
      cwd,
      detached: true,
      stdio: 'ignore', // Don't inherit stdio for background process
      shell: false,
    })

    // Unref to allow parent to exit independently
    child.unref()

    return { pid: child.pid }
  }

  // Foreground mode: wait for completion
  return new Promise((resolve) => {
    const child = spawn(config.command, args, {
      cwd,
      stdio: 'inherit', // Pass through stdin/stdout/stderr for interactive session
      shell: false, // Don't use shell to avoid escaping issues with complex prompts
    })

    child.on('error', (error) => {
      console.error(chalk.red(`Failed to start ${client}: ${error.message}`))
      resolve({ exitCode: 1 })
    })

    child.on('close', (code) => {
      resolve({ exitCode: code ?? 0 })
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
  .option('--detach', 'Run Worker AI in background (returns immediately with PID)')
  .option('--no-worktree', 'Skip worktree creation (work in current directory)')
  .option('--json', 'JSON output')
  .action(async (taskId, options) => {
    ensureInitialized()
    const { taskService, sessionService, agentService, worktreeService, memoryService } = await getServices()

    // Get task
    const task = await taskService.findById(parseInt(taskId))
    if (!task) {
      console.error(chalk.red(`Task #${taskId} not found`))
      process.exit(5)
    }

    // Get agent
    const agent = await agentService.findByName(options.agent)
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

      // Update task status
      await taskService.update(parseInt(taskId), {
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
        branchName: worktreeInfo?.branchName,
        worktreePath: worktreeInfo?.path,
      })
    } catch (error) {
      // Get existing running session if start fails
      const running = await sessionService.findRunningByTask(parseInt(taskId))
      session = running[0]
      if (!session) {
        // Try to get latest session
        session = await sessionService.findLatestByTask(parseInt(taskId))
      }
      if (!session) {
        throw error
      }
    }

    // Build prompt
    const prompt = await buildPromptFromTask({
      task,
      agent,
      agentService,
      memoryService,
    })

    // Determine client to use
    // --exec true (no value) -> use agent's client
    // --exec <client> -> use specified client
    // no --exec -> show instructions only
    const execClient = options.exec === true ? agent.client : options.exec

    // Working directory for AI
    const workingDir = worktreeInfo?.path || process.cwd()

    // Launch AI if --exec specified
    if (execClient) {
      const isDetach = options.detach === true
      const result = await launchWorkerAI(execClient, prompt, workingDir, agent.model, isDetach)

      if (isDetach && result.pid) {
        // Save PID and worktree path to session for later management
        await sessionService.updateProcessInfo(session.id, {
          pid: result.pid,
          worktreePath: workingDir,
        })
      }

      if (options.json) {
        console.log(JSON.stringify({
          task: { id: task.id, title: task.title },
          session: { id: session.id, agentName: session.agentName },
          worktree: worktreeInfo,
          prompt,
          exec: execClient,
          detach: isDetach,
          pid: result.pid || null,
          exitCode: result.exitCode,
        }, null, 2))

        if (!isDetach && result.exitCode !== undefined) {
          process.exit(result.exitCode)
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

      if (isDetach) {
        console.log(chalk.green(`✓ Worker AI started in background (PID: ${result.pid})`))
        console.log('')
        console.log(chalk.bold('To check status:'))
        console.log(chalk.cyan(`  agentmine worker status ${taskId}`))
        console.log('')
        console.log(chalk.bold('To wait for completion:'))
        console.log(chalk.cyan(`  agentmine worker wait ${taskId}`))
        console.log('')
        console.log(chalk.bold('To stop:'))
        console.log(chalk.cyan(`  agentmine worker stop ${taskId}`))
        console.log('')
      } else {
        console.log(chalk.green(`✓ Starting Worker AI (${execClient})...`))
        console.log('')

        // result.exitCode is already set from foreground execution
        console.log('')
        if (result.exitCode === 0) {
          console.log(chalk.green(`✓ Worker AI exited (code: ${result.exitCode})`))
        } else {
          console.log(chalk.yellow(`⚠ Worker AI exited (code: ${result.exitCode})`))
        }

        console.log('')
        console.log(chalk.bold('To complete the task:'))
        console.log(chalk.cyan(`  agentmine worker done ${taskId}`))
        console.log('')
      }
      return
    }

    // No --exec: show instructions only
    if (options.json) {
      console.log(JSON.stringify({
        task: { id: task.id, title: task.title },
        session: { id: session.id, agentName: session.agentName },
        worktree: worktreeInfo,
        prompt,
        exec: null,
      }, null, 2))
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
    const { taskService, sessionService, worktreeService } = await getServices()

    // Get task
    const task = await taskService.findById(parseInt(taskId))
    if (!task) {
      console.error(chalk.red(`Task #${taskId} not found`))
      process.exit(5)
    }

    // End running sessions
    const runningSessions = await sessionService.findRunningByTask(parseInt(taskId))
    let endedSession = null
    for (const session of runningSessions) {
      await sessionService.end(session.id, {
        status: options.status as 'completed' | 'failed',
      })
      endedSession = session
    }
    const session = endedSession

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
    const latestSession = await sessionService.findLatestByTask(parseInt(taskId))
    if (options.status === 'completed' && latestSession?.branchName) {
      console.log('')
      console.log(chalk.bold('To merge changes:'))
      console.log(chalk.cyan(`  git merge ${latestSession.branchName}`))
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
    const { worktreeService, taskService, sessionService } = await getServices()

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
      const sessions = await sessionService.findByTask(wt.taskId)
      const latestSession = sessions[0]

      console.log(chalk.cyan(`Task #${wt.taskId}:`), task?.title || '(unknown)')
      console.log(chalk.gray(`  Branch:   ${wt.branchName}`))
      console.log(chalk.gray(`  Path:     ${wt.path}`))
      if (latestSession) {
        console.log(chalk.gray(`  Session:  #${latestSession.id} (${latestSession.status})`))
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
    const { worktreeService } = await getServices()

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
  .option('-a, --agent <name>', 'Agent name (for including promptFile)')
  .option('--json', 'JSON output')
  .action(async (taskId, options: OutputOptions & { agent?: string }) => {
    ensureInitialized()
    const { taskService, agentService, memoryService } = await getServices()

    const task = await taskService.findById(parseInt(taskId))
    if (!task) {
      console.error(chalk.red(`Task #${taskId} not found`))
      process.exit(5)
    }

    // Get agent if specified
    let agent: Agent | undefined
    if (options.agent) {
      agent = await agentService.findByName(options.agent) ?? undefined
      if (!agent) {
        console.error(chalk.red(`Agent "${options.agent}" not found`))
        process.exit(5)
      }
    }

    const prompt = await buildPromptFromTask({
      task,
      agent,
      agentService: agent ? agentService : undefined,
      memoryService,
    })

    if (options.json) {
      console.log(JSON.stringify({ taskId: task.id, agentName: agent?.name ?? null, prompt }))
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
    const { taskService, sessionService, worktreeService } = await getServices()

    const task = await taskService.findById(parseInt(taskId))
    if (!task) {
      console.error(chalk.red(`Task #${taskId} not found`))
      process.exit(5)
    }

    const subtasks = await taskService.getSubtasks(parseInt(taskId))
    const sessions = await sessionService.findByTask(parseInt(taskId))
    const session = sessions[0] // Latest session
    const worktree = worktreeService.getInfo(parseInt(taskId))

    let parentTask = null
    if (task.parentId) {
      parentTask = await taskService.findById(task.parentId)
    }

    const context = {
      task,
      parentTask,
      subtasks,
      sessions,
      session, // Latest session for backward compatibility
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

// worker wait - Wait for background workers to complete
workerCommand
  .command('wait [taskIds...]')
  .description('Wait for background Worker AI processes to complete')
  .option('--timeout <ms>', 'Timeout in milliseconds (default: no timeout)')
  .option('--interval <ms>', 'Polling interval in milliseconds', '1000')
  .option('--json', 'JSON output')
  .action(async (taskIds: string[], options) => {
    ensureInitialized()
    const { sessionService, taskService } = await getServices()

    // If no task IDs provided, wait for all running sessions with PIDs
    let sessions
    if (taskIds.length === 0) {
      const running = await sessionService.findRunning()
      sessions = running.filter(s => s.pid !== null)
    } else {
      sessions = []
      for (const taskIdStr of taskIds) {
        const taskId = parseInt(taskIdStr)
        const taskSessions = await sessionService.findRunningByTask(taskId)
        for (const session of taskSessions) {
          if (session.pid) {
            sessions.push(session)
          }
        }
      }
    }

    if (sessions.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ completed: [], message: 'No running workers found' }))
      } else {
        console.log(chalk.yellow('No running workers found'))
      }
      return
    }

    const interval = parseInt(options.interval) || 1000
    const timeout = options.timeout ? parseInt(options.timeout) : null
    const startTime = Date.now()
    const completed: Array<{ taskId: number; pid: number }> = []

    if (!options.json) {
      console.log(chalk.gray(`Waiting for ${sessions.length} worker(s)...`))
    }

    // Poll until all processes complete or timeout
    while (sessions.length > 0) {
      // Check timeout
      if (timeout && Date.now() - startTime > timeout) {
        if (options.json) {
          console.log(JSON.stringify({
            completed,
            timedOut: sessions.map(s => ({ taskId: s.taskId, pid: s.pid })),
          }))
        } else {
          console.log(chalk.yellow(`Timeout: ${sessions.length} worker(s) still running`))
        }
        process.exit(1)
      }

      // Check each process
      for (let i = sessions.length - 1; i >= 0; i--) {
        const session = sessions[i]
        const isRunning = isProcessRunning(session.pid!)

        if (!isRunning) {
          completed.push({ taskId: session.taskId!, pid: session.pid! })
          sessions.splice(i, 1)

          // Clear PID from session
          await sessionService.clearProcessInfo(session.id)

          if (!options.json) {
            console.log(chalk.green(`✓ Task #${session.taskId} worker completed (PID: ${session.pid})`))
          }
        }
      }

      if (sessions.length > 0) {
        await sleep(interval)
      }
    }

    if (options.json) {
      console.log(JSON.stringify({ completed, timedOut: [] }))
    } else {
      console.log('')
      console.log(chalk.green(`✓ All ${completed.length} worker(s) completed`))
    }
  })

// worker stop - Stop background worker processes
workerCommand
  .command('stop <taskIds...>')
  .description('Stop background Worker AI processes')
  .option('--force', 'Force kill (SIGKILL instead of SIGTERM)')
  .option('--json', 'JSON output')
  .action(async (taskIds: string[], options) => {
    ensureInitialized()
    const { sessionService } = await getServices()

    const results: Array<{ taskId: number; pid: number; stopped: boolean; error?: string }> = []

    for (const taskIdStr of taskIds) {
      const taskId = parseInt(taskIdStr)
      const runningSessions = await sessionService.findRunningByTask(taskId)
      const session = runningSessions.find(s => s.pid !== null)

      if (!session) {
        results.push({ taskId, pid: 0, stopped: false, error: 'No running session with process' })
        continue
      }

      const pid = session.pid!

      try {
        // Send signal
        const signal = options.force ? 'SIGKILL' : 'SIGTERM'
        process.kill(pid, signal)

        // Clear PID from session
        await sessionService.clearProcessInfo(session.id)

        results.push({ taskId, pid, stopped: true })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        results.push({ taskId, pid, stopped: false, error: errMsg })
      }
    }

    if (options.json) {
      console.log(JSON.stringify({ results }))
      return
    }

    for (const result of results) {
      if (result.stopped) {
        console.log(chalk.green(`✓ Task #${result.taskId} worker stopped (PID: ${result.pid})`))
      } else {
        console.log(chalk.red(`✗ Task #${result.taskId}: ${result.error}`))
      }
    }
  })

// worker status - Show status of workers (enhanced for detach mode)
workerCommand
  .command('status [taskId]')
  .description('Show status of worker(s)')
  .option('--json', 'JSON output')
  .action(async (taskId: string | undefined, options) => {
    ensureInitialized()
    const { sessionService, taskService, worktreeService } = await getServices()

    if (taskId) {
      // Show status for specific task
      const session = await sessionService.findLatestByTask(parseInt(taskId))
      const task = await taskService.findById(parseInt(taskId))
      const worktree = worktreeService.getInfo(parseInt(taskId))

      if (!task) {
        console.error(chalk.red(`Task #${taskId} not found`))
        process.exit(5)
      }

      const isRunning = session?.pid ? isProcessRunning(session.pid) : false

      const status = {
        task: { id: task.id, title: task.title, status: task.status },
        session: session ? {
          id: session.id,
          status: session.status,
          agentName: session.agentName,
          pid: session.pid,
          isRunning,
        } : null,
        worktree: worktree.exists ? worktree : null,
      }

      if (options.json) {
        console.log(JSON.stringify(status, null, 2))
        return
      }

      console.log('')
      console.log(chalk.bold.cyan(`Task #${task.id}: ${task.title}`))
      console.log(chalk.gray(`Status: ${task.status}`))
      if (session) {
        console.log('')
        console.log(chalk.gray('Session:'))
        console.log(chalk.gray(`  Agent:  ${session.agentName}`))
        console.log(chalk.gray(`  Status: ${session.status}`))
        if (session.pid) {
          const runningIcon = isRunning ? chalk.green('●') : chalk.gray('○')
          console.log(chalk.gray(`  PID:    ${session.pid} ${runningIcon} ${isRunning ? 'running' : 'stopped'}`))
        }
      }
      if (worktree.exists) {
        console.log('')
        console.log(chalk.gray('Worktree:'))
        console.log(chalk.gray(`  Path:   ${worktree.path}`))
        console.log(chalk.gray(`  Branch: ${worktree.branchName}`))
      }
      console.log('')
      return
    }

    // Show status for all running sessions
    const running = await sessionService.findRunning()

    if (options.json) {
      const statuses = await Promise.all(running.map(async session => {
        const task = session.taskId ? await taskService.findById(session.taskId) : null
        const isRunning = session.pid ? isProcessRunning(session.pid) : false
        return {
          session: {
            id: session.id,
            status: session.status,
            agentName: session.agentName,
            pid: session.pid,
            isRunning,
          },
          task: task ? { id: task.id, title: task.title, status: task.status } : null,
        }
      }))
      console.log(JSON.stringify({ sessions: statuses }, null, 2))
      return
    }

    if (running.length === 0) {
      console.log(chalk.gray('No running workers.'))
      return
    }

    console.log(chalk.bold('Running Workers:'))
    console.log('')

    for (const session of running) {
      const task = session.taskId ? await taskService.findById(session.taskId) : null
      const isRunning = session.pid ? isProcessRunning(session.pid) : false
      const runningIcon = session.pid ? (isRunning ? chalk.green('●') : chalk.gray('○')) : ''

      console.log(chalk.cyan(`Task #${session.taskId}:`), task?.title || '(unknown)')
      console.log(chalk.gray(`  Agent:   ${session.agentName}`))
      console.log(chalk.gray(`  Session: #${session.id}`))
      if (session.pid) {
        console.log(chalk.gray(`  PID:     ${session.pid} ${runningIcon} ${isRunning ? 'running' : 'stopped'}`))
      }
      console.log('')
    }
  })

// ============================================
// Helper Functions
// ============================================

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================
// Prompt Building
// ============================================

interface BuildPromptOptions {
  task: Task
  agent?: Agent
  agentService?: AgentService
  memoryService?: MemoryService
}

async function buildPromptFromTask(options: BuildPromptOptions): Promise<string> {
  const { task, agent, agentService, memoryService } = options
  const parts: string[] = []

  // Task header
  parts.push(`# Task #${task.id}: ${task.title}`)
  parts.push('')

  // Metadata
  parts.push(`Type: ${task.type} | Priority: ${task.priority}`)
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
    parts.push(`Work on branch: \`${task.branchName}\``)
    parts.push('')
  }

  // Agent instructions from promptContent or promptFile
  if (agent) {
    let content = agent.promptContent

    // Fallback to promptFile if no promptContent in DB
    if (!content && agent.config?.promptFile) {
      const promptPath = join('.agentmine', agent.config.promptFile)
      if (existsSync(promptPath)) {
        content = readFileSync(promptPath, 'utf-8')
      }
    }

    if (content) {
      parts.push('## Agent Instructions')
      parts.push(content)
      parts.push('')
    }
  }

  // Scope information
  if (agent?.scope) {
    parts.push('## Scope')
    parts.push(`- **Read**: ${agent.scope.read.join(', ')}`)
    parts.push(`- **Write**: ${agent.scope.write.join(', ')}`)
    if (agent.scope.exclude.length > 0) {
      parts.push(`- **Exclude**: ${agent.scope.exclude.join(', ')}`)
    }
    parts.push('')
  }

  // Memory Bank context (DB-based)
  if (memoryService) {
    try {
      const memories = await memoryService.list({ status: 'active' })
      if (memories.length > 0) {
        parts.push('## Project Context (Memory Bank)')
        parts.push('')

        // Group by category
        const byCategory = new Map<string, typeof memories>()
        for (const memory of memories) {
          if (!byCategory.has(memory.category)) {
            byCategory.set(memory.category, [])
          }
          byCategory.get(memory.category)!.push(memory)
        }

        for (const [category, categoryMemories] of byCategory) {
          parts.push(`### ${category}`)
          for (const memory of categoryMemories) {
            const summary = memory.summary || memory.content.split('\n')[0]?.trim() || ''
            parts.push(`- **${memory.title}**: ${summary}`)
          }
          parts.push('')
        }
      }
    } catch {
      // Ignore memory errors
    }
  }

  // Instructions
  parts.push('## Instructions')
  parts.push('1. Review existing implementation patterns before starting')
  parts.push('2. Use existing services - do NOT create mock data')
  parts.push('3. Ensure all tests pass')
  parts.push('4. Commit your changes with a descriptive message')
  parts.push('')

  return parts.join('\n')
}
