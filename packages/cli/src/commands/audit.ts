import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import {
  createDb,
  initializeDb,
  isProjectInitialized,
  AuditLogService,
  type Db,
  type AuditLog,
  type AuditAction,
  type EntityType,
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

function getAuditLogService(db: Db): AuditLogService {
  return new AuditLogService(db)
}

interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

function formatAuditList(logs: AuditLog[], options: OutputOptions): void {
  if (options.json) {
    console.log(JSON.stringify(logs, null, 2))
    return
  }

  if (options.quiet) {
    logs.forEach(l => console.log(l.id))
    return
  }

  if (logs.length === 0) {
    console.log(chalk.gray('No audit logs found.'))
    return
  }

  const table = new Table({
    head: [
      chalk.white('ID'),
      chalk.white('Action'),
      chalk.white('Entity'),
      chalk.white('User'),
      chalk.white('Time'),
    ],
    style: { head: [], border: [] },
  })

  for (const log of logs) {
    const actionColor = {
      create: chalk.green,
      update: chalk.yellow,
      delete: chalk.red,
      start: chalk.blue,
      stop: chalk.gray,
      export: chalk.cyan,
    }[log.action] ?? chalk.white

    table.push([
      chalk.gray(`#${log.id}`),
      actionColor(log.action),
      `${log.entityType}#${log.entityId}`,
      log.userId,
      log.createdAt?.toLocaleString() ?? '-',
    ])
  }

  console.log(table.toString())
}

// ============================================
// Commands
// ============================================

export const auditCommand = new Command('audit')
  .description('View audit logs')

// audit list
auditCommand
  .command('list')
  .description('List audit logs')
  .option('-a, --action <action>', 'Filter by action (create, update, delete, start, stop, export)')
  .option('-e, --entity <type>', 'Filter by entity type (task, session, agent, memory, setting)')
  .option('-u, --user <user>', 'Filter by user ID')
  .option('-l, --limit <n>', 'Limit results', '50')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (IDs only)')
  .action(async (options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getAuditLogService(db)

    const logs = await service.findAll({
      action: options.action as AuditAction | undefined,
      entityType: options.entity as EntityType | undefined,
      userId: options.user,
      limit: parseInt(options.limit),
    })

    formatAuditList(logs, options)
  })

// audit show
auditCommand
  .command('show <id>')
  .description('Show audit log details')
  .option('--json', 'JSON output')
  .action(async (id, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getAuditLogService(db)

    const log = await service.findById(parseInt(id))

    if (!log) {
      console.error(chalk.red(`Audit log #${id} not found`))
      process.exit(5)
    }

    if (options.json) {
      console.log(JSON.stringify(log, null, 2))
      return
    }

    console.log('')
    console.log(chalk.cyan(`Audit Log #${log.id}`))
    console.log('')
    console.log(chalk.gray('Action:  '), log.action)
    console.log(chalk.gray('Entity:  '), `${log.entityType}#${log.entityId}`)
    console.log(chalk.gray('User:    '), log.userId)
    console.log(chalk.gray('Time:    '), log.createdAt?.toISOString() ?? '-')

    if (log.changes && Object.keys(log.changes).length > 0) {
      console.log('')
      console.log(chalk.gray('Changes:'))
      console.log(JSON.stringify(log.changes, null, 2))
    }
    console.log('')
  })

// audit history
auditCommand
  .command('history <entityType> <entityId>')
  .description('Show audit history for an entity')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (IDs only)')
  .action(async (entityType, entityId, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getAuditLogService(db)

    const logs = await service.getEntityHistory(entityType as EntityType, entityId)

    formatAuditList(logs, options)
  })

// audit stats
auditCommand
  .command('stats')
  .description('Show audit log statistics')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getAuditLogService(db)

    const counts = await service.countByAction()

    if (options.json) {
      console.log(JSON.stringify(counts, null, 2))
      return
    }

    console.log('')
    console.log(chalk.bold('Audit Log Statistics'))
    console.log('')
    console.log(chalk.green('  Create: '), counts.create)
    console.log(chalk.yellow('  Update: '), counts.update)
    console.log(chalk.red('  Delete: '), counts.delete)
    console.log(chalk.blue('  Start:  '), counts.start)
    console.log(chalk.gray('  Stop:   '), counts.stop)
    console.log(chalk.cyan('  Export: '), counts.export)
    console.log('')
    console.log(chalk.white('  Total:  '), Object.values(counts).reduce((a, b) => a + b, 0))
    console.log('')
  })

// audit cleanup
auditCommand
  .command('cleanup')
  .description('Delete old audit logs')
  .option('-d, --days <days>', 'Delete logs older than N days', '90')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getAuditLogService(db)

    const days = parseInt(options.days)
    const deleted = await service.deleteOlderThan(days)

    if (options.json) {
      console.log(JSON.stringify({ deleted, days }))
    } else {
      console.log(chalk.green(`✓ Deleted ${deleted} audit logs older than ${days} days`))
    }
  })
