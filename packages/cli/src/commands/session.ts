import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import {
  createDb,
  initializeDb,
  isProjectInitialized,
  SessionService,
  AgentService,
  SessionNotFoundError,
  SessionAlreadyEndedError,
  TaskNotFoundError,
  type Db,
  type Session,
  type SessionStatus,
  type DodResult,
  type ReviewStatus,
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

async function getDb(): Promise<Db> {
  const db = createDb()
  await initializeDb(db)
  return db
}

function getSessionService(db: Db): SessionService {
  return new SessionService(db)
}

function getAgentService(db: Db): AgentService {
  return new AgentService(db)
}

interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function formatSession(session: Session, options: OutputOptions): string {
  if (options.json) {
    return JSON.stringify(session)
  }
  if (options.quiet) {
    return String(session.id)
  }
  return `#${session.id} (Task #${session.taskId}) - ${session.status}`
}

function formatSessionList(sessions: Session[], options: OutputOptions): void {
  if (options.json) {
    console.log(JSON.stringify(sessions, null, 2))
    return
  }

  if (options.quiet) {
    sessions.forEach(s => console.log(s.id))
    return
  }

  if (sessions.length === 0) {
    console.log(chalk.gray('No sessions found.'))
    return
  }

  const table = new Table({
    head: [
      chalk.white('ID'),
      chalk.white('Task'),
      chalk.white('Agent'),
      chalk.white('Status'),
      chalk.white('Duration'),
      chalk.white('DoD'),
    ],
    style: { head: [], border: [] },
  })

  for (const session of sessions) {
    const statusColor = {
      running: chalk.yellow,
      completed: chalk.green,
      failed: chalk.red,
      cancelled: chalk.gray,
    }[session.status] ?? chalk.white

    const dodColor = {
      passed: chalk.green,
      failed: chalk.red,
      skipped: chalk.gray,
      timeout: chalk.yellow,
    }[session.dodResult as string] ?? chalk.gray

    table.push([
      chalk.cyan(`#${session.id}`),
      session.taskId ? `#${session.taskId}` : '-',
      session.agentName,
      statusColor(session.status),
      formatDuration(session.durationMs),
      session.dodResult ? dodColor(session.dodResult) : chalk.gray('-'),
    ])
  }

  console.log(table.toString())
}

// ============================================
// Commands
// ============================================

export const sessionCommand = new Command('session')
  .description('Manage sessions')

// session start
sessionCommand
  .command('start <taskId> <agentName>')
  .description('Start a new session for a task')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (ID only)')
  .action(async (taskId, agentName, options) => {
    ensureInitialized()
    const db = await getDb()
    const sessionService = getSessionService(db)
    const agentService = getAgentService(db)

    // Validate agent exists
    const agent = await agentService.findByName(agentName)
    if (!agent) {
      console.error(chalk.red(`Agent "${agentName}" not found`))
      process.exit(5)
    }

    try {
      const session = await sessionService.start({
        taskId: parseInt(taskId),
        agentName,
      })

      if (options.json) {
        console.log(JSON.stringify(session))
      } else if (options.quiet) {
        console.log(session.id)
      } else {
        console.log(chalk.green('✓ Started session'), chalk.cyan(`#${session.id}`))
        console.log(chalk.gray('  Task:  '), `#${taskId}`)
        console.log(chalk.gray('  Agent: '), agentName)
      }
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        console.error(chalk.red(`Task #${taskId} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// session end
sessionCommand
  .command('end <sessionId>')
  .description('End a running session')
  .option('-s, --status <status>', 'End status (completed, failed, cancelled)', 'completed')
  .option('-e, --exit-code <code>', 'Exit code')
  .option('--signal <signal>', 'Signal (SIGTERM, SIGKILL, etc)')
  .option('--dod <result>', 'DoD result (passed, failed, skipped, timeout)')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (sessionId, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSessionService(db)

    try {
      const { session, durationMs } = await service.end(parseInt(sessionId), {
        status: options.status as 'completed' | 'failed' | 'cancelled',
        exitCode: options.exitCode ? parseInt(options.exitCode) : undefined,
        signal: options.signal,
        dodResult: options.dod as DodResult,
      })

      if (options.json) {
        console.log(JSON.stringify({ session, durationMs }))
      } else if (options.quiet) {
        console.log(sessionId)
      } else {
        console.log(chalk.green('✓ Ended session'), chalk.cyan(`#${sessionId}`))
        console.log(chalk.gray('  Status:  '), session.status)
        console.log(chalk.gray('  Duration:'), formatDuration(durationMs))
      }
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        console.error(chalk.red(`Session #${sessionId} not found`))
        process.exit(5)
      }
      if (error instanceof SessionAlreadyEndedError) {
        console.error(chalk.red(`Session #${sessionId} has already ended`))
        process.exit(6)
      }
      throw error
    }
  })

// session list
sessionCommand
  .command('list')
  .description('List sessions')
  .option('-s, --status <status>', 'Filter by status')
  .option('-a, --agent <name>', 'Filter by agent name')
  .option('-t, --task <id>', 'Filter by task ID')
  .option('--running', 'Show only running sessions')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (IDs only)')
  .action(async (options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSessionService(db)

    const sessions = await service.findAll({
      status: options.running ? 'running' : options.status as SessionStatus | undefined,
      agentName: options.agent,
      taskId: options.task ? parseInt(options.task) : undefined,
    })

    formatSessionList(sessions, options)
  })

// session show
sessionCommand
  .command('show <sessionId>')
  .description('Show session details')
  .option('--json', 'JSON output')
  .action(async (sessionId, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSessionService(db)

    const result = await service.findByIdWithTask(parseInt(sessionId))

    if (!result) {
      console.error(chalk.red(`Session #${sessionId} not found`))
      process.exit(5)
    }

    const { session, task } = result

    if (options.json) {
      console.log(JSON.stringify({ session, task }, null, 2))
      return
    }

    const statusColor = {
      running: chalk.yellow,
      completed: chalk.green,
      failed: chalk.red,
      cancelled: chalk.gray,
    }[session.status] ?? chalk.white

    console.log('')
    console.log(chalk.cyan(`Session #${session.id}`))
    console.log('')
    console.log(chalk.gray('Task:     '), task ? `#${task.id} ${task.title}` : '-')
    console.log(chalk.gray('Agent:    '), session.agentName)
    console.log(chalk.gray('Status:   '), statusColor(session.status))
    console.log(chalk.gray('DoD:      '), session.dodResult ?? 'pending')
    console.log(chalk.gray('Started:  '), session.startedAt?.toISOString() ?? '-')
    console.log(chalk.gray('Completed:'), session.completedAt?.toISOString() ?? '-')
    console.log(chalk.gray('Duration: '), formatDuration(session.durationMs))

    if (session.exitCode !== null && session.exitCode !== undefined) {
      console.log(chalk.gray('Exit Code:'), session.exitCode)
    }
    if (session.signal) {
      console.log(chalk.gray('Signal:   '), session.signal)
    }

    if (session.artifacts && session.artifacts.length > 0) {
      console.log('')
      console.log(chalk.gray('Artifacts:'))
      session.artifacts.forEach(a => console.log(chalk.gray('  -'), a))
    }

    if (session.error) {
      console.log('')
      console.log(chalk.red('Error:'))
      console.log(chalk.gray('  Type:   '), session.error.type)
      console.log(chalk.gray('  Message:'), session.error.message)
    }
    console.log('')
  })

// session delete
sessionCommand
  .command('delete <sessionId>')
  .description('Delete a session')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (sessionId, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSessionService(db)

    try {
      await service.delete(parseInt(sessionId))

      if (options.json) {
        console.log(JSON.stringify({ deleted: true, id: parseInt(sessionId) }))
      } else if (options.quiet) {
        console.log(sessionId)
      } else {
        console.log(chalk.green('✓ Deleted session'), chalk.cyan(`#${sessionId}`))
      }
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        console.error(chalk.red(`Session #${sessionId} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// session stats
sessionCommand
  .command('stats')
  .description('Show session statistics')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSessionService(db)

    const counts = await service.countByStatus()

    if (options.json) {
      console.log(JSON.stringify(counts, null, 2))
      return
    }

    console.log('')
    console.log(chalk.bold('Session Statistics'))
    console.log('')
    console.log(chalk.yellow('  Running:  '), counts.running)
    console.log(chalk.green('  Completed:'), counts.completed)
    console.log(chalk.red('  Failed:   '), counts.failed)
    console.log(chalk.gray('  Cancelled:'), counts.cancelled)
    console.log('')
    console.log(chalk.white('  Total:    '), Object.values(counts).reduce((a, b) => a + b, 0))
    console.log('')
  })

// session review
sessionCommand
  .command('review <sessionId>')
  .description('Record review result for a session')
  .requiredOption('-s, --status <status>', 'Review status (approved, rejected, needs_work)')
  .requiredOption('-b, --by <reviewer>', 'Reviewer name')
  .option('-c, --comment <comment>', 'Review comment')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (sessionId, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSessionService(db)

    // Validate review status
    const validStatuses: ReviewStatus[] = ['approved', 'rejected', 'needs_work']
    if (!validStatuses.includes(options.status)) {
      console.error(chalk.red(`Invalid review status: ${options.status}`))
      console.log(chalk.gray(`Valid statuses: ${validStatuses.join(', ')}`))
      process.exit(2)
    }

    try {
      const session = await service.review(parseInt(sessionId), {
        status: options.status as ReviewStatus,
        reviewedBy: options.by,
        comment: options.comment,
      })

      if (options.json) {
        console.log(JSON.stringify(session))
      } else if (options.quiet) {
        console.log(sessionId)
      } else {
        const statusColor = {
          approved: chalk.green,
          rejected: chalk.red,
          needs_work: chalk.yellow,
        }[options.status] ?? chalk.white

        console.log(chalk.green('✓ Reviewed session'), chalk.cyan(`#${sessionId}`))
        console.log(chalk.gray('  Status:  '), statusColor(options.status))
        console.log(chalk.gray('  Reviewer:'), options.by)
        if (options.comment) {
          console.log(chalk.gray('  Comment: '), options.comment)
        }
      }
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        console.error(chalk.red(`Session #${sessionId} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// session pending
sessionCommand
  .command('pending')
  .description('List sessions pending review')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (IDs only)')
  .action(async (options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSessionService(db)

    const sessions = await service.findPendingReview()

    if (options.json) {
      console.log(JSON.stringify(sessions, null, 2))
      return
    }

    if (options.quiet) {
      sessions.forEach(s => console.log(s.id))
      return
    }

    if (sessions.length === 0) {
      console.log(chalk.gray('No sessions pending review.'))
      return
    }

    console.log('')
    console.log(chalk.bold('Sessions Pending Review'))
    console.log('')

    const table = new Table({
      head: [
        chalk.white('ID'),
        chalk.white('Task'),
        chalk.white('Agent'),
        chalk.white('Completed'),
        chalk.white('Duration'),
      ],
      style: { head: [], border: [] },
    })

    for (const session of sessions) {
      table.push([
        chalk.cyan(`#${session.id}`),
        session.taskId ? `#${session.taskId}` : '-',
        session.agentName,
        session.completedAt?.toISOString() ?? '-',
        formatDuration(session.durationMs),
      ])
    }

    console.log(table.toString())
    console.log('')
  })
