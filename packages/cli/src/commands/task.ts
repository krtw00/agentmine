import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import { createDb, sqliteTasks, sqliteProjects, type Task, type TaskStatus, type TaskPriority, type TaskType } from '@agentmine/core'
import { eq, desc } from 'drizzle-orm'

export const taskCommand = new Command('task')
  .description('Manage tasks')

// task add
taskCommand
  .command('add <title>')
  .description('Add a new task')
  .option('-d, --description <description>', 'Task description')
  .option('-p, --priority <priority>', 'Priority (low, medium, high, critical)', 'medium')
  .option('-t, --type <type>', 'Type (task, feature, bug, refactor)', 'task')
  .action(async (title, options) => {
    const { db, type } = createDb()

    // For now, use a default project or create one
    // TODO: Implement proper project detection
    let projectId = 1

    if (type === 'sqlite') {
      const sqliteDb = db as ReturnType<typeof import('@agentmine/core').createSqliteDb>

      // Check if default project exists
      const projects = sqliteDb.select().from(sqliteProjects).all()
      if (projects.length === 0) {
        // Create default project
        sqliteDb.insert(sqliteProjects).values({
          name: 'default',
          path: process.cwd(),
        }).run()
      }

      // Insert task
      const result = sqliteDb.insert(sqliteTasks).values({
        projectId,
        title,
        description: options.description,
        priority: options.priority as TaskPriority,
        type: options.type as TaskType,
      }).run()

      console.log(chalk.green('✓ Created task'), chalk.cyan(`#${result.lastInsertRowid}`), chalk.white(title))
    } else {
      // PostgreSQL implementation
      console.log(chalk.yellow('PostgreSQL support coming soon'))
    }
  })

// task list
taskCommand
  .command('list')
  .description('List tasks')
  .option('-s, --status <status>', 'Filter by status')
  .option('-a, --all', 'Show all tasks including done/cancelled')
  .action(async (options) => {
    const { db, type } = createDb()

    if (type === 'sqlite') {
      const sqliteDb = db as ReturnType<typeof import('@agentmine/core').createSqliteDb>

      let query = sqliteDb.select().from(sqliteTasks)

      const tasks = query.orderBy(desc(sqliteTasks.id)).all()

      if (tasks.length === 0) {
        console.log(chalk.gray('No tasks found. Create one with:'))
        console.log(chalk.cyan('  agentmine task add "Your task"'))
        return
      }

      // Filter tasks
      let filteredTasks = tasks
      if (options.status) {
        filteredTasks = tasks.filter(t => t.status === options.status)
      } else if (!options.all) {
        filteredTasks = tasks.filter(t => !['done', 'cancelled'].includes(t.status))
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

      for (const task of filteredTasks) {
        const statusColor = {
          open: chalk.blue,
          in_progress: chalk.yellow,
          review: chalk.magenta,
          done: chalk.green,
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
    } else {
      console.log(chalk.yellow('PostgreSQL support coming soon'))
    }
  })

// task show
taskCommand
  .command('show <id>')
  .description('Show task details')
  .action(async (id) => {
    const { db, type } = createDb()

    if (type === 'sqlite') {
      const sqliteDb = db as ReturnType<typeof import('@agentmine/core').createSqliteDb>
      const task = sqliteDb.select().from(sqliteTasks).where(eq(sqliteTasks.id, parseInt(id))).get()

      if (!task) {
        console.log(chalk.red(`Task #${id} not found`))
        return
      }

      console.log('')
      console.log(chalk.cyan(`#${task.id}`), chalk.bold(task.title))
      console.log('')
      console.log(chalk.gray('Status:    '), task.status)
      console.log(chalk.gray('Priority:  '), task.priority)
      console.log(chalk.gray('Type:      '), task.type)
      console.log(chalk.gray('Assignee:  '), task.assigneeName ?? '-')
      console.log(chalk.gray('Branch:    '), task.branchName ?? '-')
      console.log(chalk.gray('PR:        '), task.prUrl ?? '-')
      console.log(chalk.gray('Created:   '), task.createdAt)
      if (task.description) {
        console.log('')
        console.log(chalk.gray('Description:'))
        console.log(task.description)
      }
      console.log('')
    } else {
      console.log(chalk.yellow('PostgreSQL support coming soon'))
    }
  })

// task start
taskCommand
  .command('start <id>')
  .description('Start working on a task')
  .action(async (id) => {
    const { db, type } = createDb()

    if (type === 'sqlite') {
      const sqliteDb = db as ReturnType<typeof import('@agentmine/core').createSqliteDb>
      const task = sqliteDb.select().from(sqliteTasks).where(eq(sqliteTasks.id, parseInt(id))).get()

      if (!task) {
        console.log(chalk.red(`Task #${id} not found`))
        return
      }

      sqliteDb.update(sqliteTasks)
        .set({
          status: 'in_progress',
          startedAt: new Date().toISOString(),
        })
        .where(eq(sqliteTasks.id, parseInt(id)))
        .run()

      console.log(chalk.green('✓ Started task'), chalk.cyan(`#${id}`))
      console.log(chalk.gray('  Status: in_progress'))

      // TODO: Create git branch
    } else {
      console.log(chalk.yellow('PostgreSQL support coming soon'))
    }
  })

// task done
taskCommand
  .command('done <id>')
  .description('Mark task as done')
  .action(async (id) => {
    const { db, type } = createDb()

    if (type === 'sqlite') {
      const sqliteDb = db as ReturnType<typeof import('@agentmine/core').createSqliteDb>

      sqliteDb.update(sqliteTasks)
        .set({
          status: 'done',
          completedAt: new Date().toISOString(),
        })
        .where(eq(sqliteTasks.id, parseInt(id)))
        .run()

      console.log(chalk.green('✓ Completed task'), chalk.cyan(`#${id}`))
    } else {
      console.log(chalk.yellow('PostgreSQL support coming soon'))
    }
  })

// task assign
taskCommand
  .command('assign <id> <assignee>')
  .description('Assign task to agent or human')
  .option('--ai', 'Assign to AI agent')
  .option('--human', 'Assign to human')
  .action(async (id, assignee, options) => {
    const { db, type } = createDb()

    const assigneeType = options.ai ? 'ai' : options.human ? 'human' : 'ai'

    if (type === 'sqlite') {
      const sqliteDb = db as ReturnType<typeof import('@agentmine/core').createSqliteDb>

      sqliteDb.update(sqliteTasks)
        .set({
          assigneeType,
          assigneeName: assignee,
        })
        .where(eq(sqliteTasks.id, parseInt(id)))
        .run()

      const icon = assigneeType === 'ai' ? '🤖' : '👤'
      console.log(chalk.green('✓ Assigned task'), chalk.cyan(`#${id}`), 'to', icon, assignee)
    } else {
      console.log(chalk.yellow('PostgreSQL support coming soon'))
    }
  })
