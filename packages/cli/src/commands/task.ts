import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import {
  createDb,
  initializeDb,
  isProjectInitialized,
  TaskService,
  TaskNotFoundError,
  TaskDependencyError,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskType,
} from '@agentmine/core'

// ============================================
// Helpers
// ============================================

function ensureInitialized(): boolean {
  if (!isProjectInitialized()) {
    console.error(chalk.red('Error: agentmine not initialized'))
    console.log(chalk.gray('Run `agentmine init` first'))
    process.exit(3) // Exit code 3: config error
  }
  return true
}

function getTaskService(): TaskService {
  const db = createDb()
  return new TaskService(db)
}

interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

function formatTask(task: Task, options: OutputOptions): string {
  if (options.json) {
    return JSON.stringify(task)
  }
  if (options.quiet) {
    return String(task.id)
  }
  return `#${task.id} ${task.title}`
}

function formatTaskList(tasks: Task[], options: OutputOptions): void {
  if (options.json) {
    console.log(JSON.stringify(tasks, null, 2))
    return
  }

  if (options.quiet) {
    tasks.forEach(t => console.log(t.id))
    return
  }

  if (tasks.length === 0) {
    console.log(chalk.gray('No tasks found. Create one with:'))
    console.log(chalk.cyan('  agentmine task add "Your task"'))
    return
  }

  const table = new Table({
    head: [
      chalk.white('ID'),
      chalk.white('Status'),
      chalk.white('Priority'),
      chalk.white('Type'),
      chalk.white('Assignee'),
      chalk.white('Title'),
    ],
    style: { head: [], border: [] },
  })

  for (const task of tasks) {
    const statusColor = {
      open: chalk.blue,
      in_progress: chalk.yellow,
      done: chalk.green,
      failed: chalk.red,
      cancelled: chalk.gray,
    }[task.status] ?? chalk.white

    const priorityColor = {
      low: chalk.gray,
      medium: chalk.white,
      high: chalk.yellow,
      critical: chalk.red,
    }[task.priority] ?? chalk.white

    const assignee = task.assigneeType
      ? `${task.assigneeType === 'ai' ? '🤖' : '👤'} ${task.assigneeName}`
      : chalk.gray('-')

    table.push([
      chalk.cyan(`#${task.id}`),
      statusColor(task.status),
      priorityColor(task.priority),
      task.type,
      assignee,
      task.title.length > 40 ? task.title.slice(0, 37) + '...' : task.title,
    ])
  }

  console.log(table.toString())
}

// ============================================
// Commands
// ============================================

export const taskCommand = new Command('task')
  .description('Manage tasks')

// task add
taskCommand
  .command('add <title>')
  .description('Add a new task')
  .option('-d, --description <description>', 'Task description')
  .option('-p, --priority <priority>', 'Priority (low, medium, high, critical)', 'medium')
  .option('-t, --type <type>', 'Type (task, feature, bug, refactor)', 'task')
  .option('--parent <id>', 'Parent task ID')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (ID only)')
  .action(async (title, options) => {
    ensureInitialized()
    const service = getTaskService()

    try {
      const task = await service.create({
        title,
        description: options.description,
        priority: options.priority as TaskPriority,
        type: options.type as TaskType,
        parentId: options.parent ? parseInt(options.parent) : undefined,
      })

      if (options.json) {
        console.log(JSON.stringify(task))
      } else if (options.quiet) {
        console.log(task.id)
      } else {
        console.log(chalk.green('✓ Created task'), chalk.cyan(`#${task.id}`), chalk.white(title))
      }
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        console.error(chalk.red(`Error: Parent task #${options.parent} not found`))
        process.exit(5) // Exit code 5: resource not found
      }
      throw error
    }
  })

// task list
taskCommand
  .command('list')
  .description('List tasks')
  .option('-s, --status <status>', 'Filter by status')
  .option('-p, --priority <priority>', 'Filter by priority')
  .option('-t, --type <type>', 'Filter by type')
  .option('-a, --all', 'Show all tasks including done/cancelled')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (IDs only)')
  .action(async (options) => {
    ensureInitialized()
    const service = getTaskService()

    let tasks = await service.findAll({
      status: options.status as TaskStatus | undefined,
      priority: options.priority as TaskPriority | undefined,
      type: options.type as TaskType | undefined,
    })

    // Filter out done/cancelled unless --all
    if (!options.all && !options.status) {
      tasks = tasks.filter(t => !['done', 'cancelled'].includes(t.status))
    }

    formatTaskList(tasks, options)
  })

// task show
taskCommand
  .command('show <id>')
  .description('Show task details')
  .option('--json', 'JSON output')
  .action(async (id, options) => {
    ensureInitialized()
    const service = getTaskService()

    const task = await service.findById(parseInt(id))

    if (!task) {
      console.error(chalk.red(`Task #${id} not found`))
      process.exit(5)
    }

    // Fetch dependency info
    const blockedBy = await service.getDependencies(task.id)
    const blocks = await service.getDependents(task.id)

    if (options.json) {
      console.log(JSON.stringify({
        ...task,
        blockedBy: blockedBy.map(t => ({ id: t.id, title: t.title, status: t.status })),
        blocks: blocks.map(t => ({ id: t.id, title: t.title, status: t.status })),
      }, null, 2))
      return
    }

    console.log('')
    console.log(chalk.cyan(`#${task.id}`), chalk.bold(task.title))
    console.log('')
    console.log(chalk.gray('Status:    '), task.status)
    console.log(chalk.gray('Priority:  '), task.priority)
    console.log(chalk.gray('Type:      '), task.type)
    console.log(chalk.gray('Assignee:  '), task.assigneeName ?? '-')
    console.log(chalk.gray('Session:   '), task.selectedSessionId ? `#${task.selectedSessionId}` : '-')
    console.log(chalk.gray('Labels:    '), task.labels?.length ? task.labels.join(', ') : '-')

    if (blockedBy.length > 0) {
      const depList = blockedBy.map(t => {
        const done = t.status === 'done' ? chalk.green('done') : chalk.yellow(t.status)
        return `#${t.id} (${done})`
      }).join(', ')
      console.log(chalk.gray('Blocked by:'), depList)
    }
    if (blocks.length > 0) {
      console.log(chalk.gray('Blocks:    '), blocks.map(t => `#${t.id}`).join(', '))
    }

    console.log(chalk.gray('Created:   '), task.createdAt?.toISOString() ?? '-')
    if (task.description) {
      console.log('')
      console.log(chalk.gray('Description:'))
      console.log(task.description)
    }
    console.log('')
  })

// task update
taskCommand
  .command('update <id>')
  .description('Update a task')
  .option('-t, --title <title>', 'New title')
  .option('-d, --description <description>', 'New description')
  .option('-s, --status <status>', 'New status')
  .option('-p, --priority <priority>', 'New priority')
  .option('--type <type>', 'New type')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, options) => {
    ensureInitialized()
    const service = getTaskService()

    try {
      const task = await service.update(parseInt(id), {
        title: options.title,
        description: options.description,
        status: options.status as TaskStatus | undefined,
        priority: options.priority as TaskPriority | undefined,
        type: options.type as TaskType | undefined,
      })

      console.log(formatTask(task, options))
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        console.error(chalk.red(`Task #${id} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// task start
taskCommand
  .command('start <id>')
  .description('Start working on a task (set status to in_progress)')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, options) => {
    ensureInitialized()
    const service = getTaskService()

    try {
      const task = await service.update(parseInt(id), {
        status: 'in_progress',
      })

      if (!options.json && !options.quiet) {
        console.log(chalk.green('✓ Started task'), chalk.cyan(`#${id}`))
        console.log(chalk.gray('  Status: in_progress'))
      } else {
        console.log(formatTask(task, options))
      }
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        console.error(chalk.red(`Task #${id} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// task done
taskCommand
  .command('done <id>')
  .description('Mark task as done')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, options) => {
    ensureInitialized()
    const service = getTaskService()

    try {
      const task = await service.update(parseInt(id), {
        status: 'done',
      })

      if (!options.json && !options.quiet) {
        console.log(chalk.green('✓ Completed task'), chalk.cyan(`#${id}`))
      } else {
        console.log(formatTask(task, options))
      }
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        console.error(chalk.red(`Task #${id} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// task assign
taskCommand
  .command('assign <id> <assignee>')
  .description('Assign task to agent or human')
  .option('--ai', 'Assign to AI agent')
  .option('--human', 'Assign to human')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, assignee, options) => {
    ensureInitialized()
    const service = getTaskService()

    const assigneeType = options.ai ? 'ai' : options.human ? 'human' : 'ai'

    try {
      const task = await service.update(parseInt(id), {
        assigneeType,
        assigneeName: assignee,
      })

      if (!options.json && !options.quiet) {
        const icon = assigneeType === 'ai' ? '🤖' : '👤'
        console.log(chalk.green('✓ Assigned task'), chalk.cyan(`#${id}`), 'to', icon, assignee)
      } else {
        console.log(formatTask(task, options))
      }
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        console.error(chalk.red(`Task #${id} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// task delete
taskCommand
  .command('delete <id>')
  .description('Delete a task')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, options) => {
    ensureInitialized()
    const service = getTaskService()

    try {
      await service.delete(parseInt(id))

      if (!options.json && !options.quiet) {
        console.log(chalk.green('✓ Deleted task'), chalk.cyan(`#${id}`))
      } else if (options.json) {
        console.log(JSON.stringify({ deleted: true, id: parseInt(id) }))
      } else {
        console.log(id)
      }
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        console.error(chalk.red(`Task #${id} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// task stats
taskCommand
  .command('stats')
  .description('Show task statistics')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()
    const service = getTaskService()

    const counts = await service.countByStatus()

    if (options.json) {
      console.log(JSON.stringify(counts, null, 2))
      return
    }

    console.log('')
    console.log(chalk.bold('Task Statistics'))
    console.log('')
    console.log(chalk.blue('  Open:       '), counts.open)
    console.log(chalk.yellow('  In Progress:'), counts.in_progress)
    console.log(chalk.green('  Done:       '), counts.done)
    console.log(chalk.red('  Failed:     '), counts.failed)
    console.log(chalk.gray('  Cancelled:  '), counts.cancelled)
    console.log('')
    console.log(chalk.white('  Total:      '), Object.values(counts).reduce((a, b) => a + b, 0))
    console.log('')
  })

// task block
taskCommand
  .command('block <id>')
  .description('Block a task by another task (add dependency)')
  .requiredOption('--by <depId>', 'Task ID that blocks this task')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, options) => {
    ensureInitialized()
    const service = getTaskService()

    try {
      await service.addDependency(parseInt(id), parseInt(options.by))

      if (options.json) {
        console.log(JSON.stringify({ taskId: parseInt(id), blockedBy: parseInt(options.by) }))
      } else if (options.quiet) {
        console.log(id)
      } else {
        console.log(chalk.green('✓ Task'), chalk.cyan(`#${id}`), chalk.green('blocked by'), chalk.cyan(`#${options.by}`))
      }
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        console.error(chalk.red(`Task not found: ${error.message}`))
        process.exit(5)
      }
      if (error instanceof TaskDependencyError) {
        console.error(chalk.red(`Dependency error: ${error.message}`))
        process.exit(6)
      }
      throw error
    }
  })

// task unblock
taskCommand
  .command('unblock <id>')
  .description('Remove a dependency from a task')
  .requiredOption('--from <depId>', 'Task ID to remove from blockers')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, options) => {
    ensureInitialized()
    const service = getTaskService()

    await service.removeDependency(parseInt(id), parseInt(options.from))

    if (options.json) {
      console.log(JSON.stringify({ taskId: parseInt(id), unblockedFrom: parseInt(options.from) }))
    } else if (options.quiet) {
      console.log(id)
    } else {
      console.log(chalk.green('✓ Task'), chalk.cyan(`#${id}`), chalk.green('unblocked from'), chalk.cyan(`#${options.from}`))
    }
  })

// task next
taskCommand
  .command('next')
  .description('Find the next available task (open, not blocked, highest priority)')
  .option('--agent <name>', 'Agent name (for future use)')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (ID only)')
  .action(async (options) => {
    ensureInitialized()
    const service = getTaskService()

    const task = await service.findNext({ agentName: options.agent })

    if (!task) {
      if (options.json) {
        console.log(JSON.stringify(null))
      } else if (!options.quiet) {
        console.log(chalk.gray('No available tasks found'))
      }
      return
    }

    if (options.json) {
      console.log(JSON.stringify(task))
    } else if (options.quiet) {
      console.log(task.id)
    } else {
      console.log(chalk.green('Next task:'), chalk.cyan(`#${task.id}`), chalk.white(task.title))
      console.log(chalk.gray(`  Priority: ${task.priority} | Type: ${task.type} | Status: ${task.status}`))
    }
  })

// task decompose (stub)
taskCommand
  .command('decompose <id>')
  .description('Decompose a task into subtasks (future AI feature)')
  .option('-n, --count <count>', 'Number of subtasks to create', '3')
  .action(async (id, options) => {
    ensureInitialized()
    const service = getTaskService()

    const task = await service.findById(parseInt(id))
    if (!task) {
      console.error(chalk.red(`Task #${id} not found`))
      process.exit(5)
    }

    console.log('')
    console.log(chalk.yellow('Task decomposition is a planned feature.'))
    console.log('')
    console.log(chalk.gray('When implemented, this command will:'))
    console.log(chalk.gray(`  1. Analyze task #${id}: "${task.title}"`))
    console.log(chalk.gray(`  2. Use AI to break it into ~${options.count} subtasks`))
    console.log(chalk.gray('  3. Create child tasks with appropriate dependencies'))
    console.log(chalk.gray('  4. Set priority and type based on analysis'))
    console.log('')
    console.log(chalk.gray('For now, create subtasks manually:'))
    console.log(chalk.cyan(`  agentmine task add "Subtask title" --parent ${id}`))
    console.log('')
  })
