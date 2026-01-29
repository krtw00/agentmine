import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import {
  createDb,
  initializeDb,
  isProjectInitialized,
  SettingsService,
  SettingNotFoundError,
  type Db,
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

function getSettingsService(db: Db): SettingsService {
  return new SettingsService(db)
}

interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

// ============================================
// Commands
// ============================================

export const settingsCommand = new Command('settings')
  .description('Manage project settings (DB-based)')

// settings list
settingsCommand
  .command('list')
  .description('List all settings')
  .option('--json', 'JSON output')
  .action(async (options: OutputOptions) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSettingsService(db)

    const settings = await service.list()

    if (options.json) {
      console.log(JSON.stringify(settings, null, 2))
      return
    }

    if (settings.length === 0) {
      console.log(chalk.gray('No settings found.'))
      console.log(chalk.gray('Initialize defaults with:'))
      console.log(chalk.cyan('  agentmine settings init'))
      return
    }

    const table = new Table({
      head: [
        chalk.white('Key'),
        chalk.white('Value'),
        chalk.white('Updated'),
      ],
      style: { head: [], border: [] },
    })

    for (const setting of settings) {
      let value: string
      try {
        value = JSON.parse(setting.value as string)
        if (typeof value === 'object') {
          value = JSON.stringify(value)
        }
      } catch {
        value = String(setting.value)
      }

      table.push([
        chalk.cyan(setting.key),
        value.length > 40 ? value.slice(0, 37) + '...' : value,
        setting.updatedAt?.toLocaleDateString() ?? '-',
      ])
    }

    console.log(table.toString())
  })

// settings get
settingsCommand
  .command('get <key>')
  .description('Get a setting value')
  .option('--json', 'JSON output')
  .action(async (key, options: OutputOptions) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSettingsService(db)

    const value = await service.get(key)

    if (value === undefined) {
      console.error(chalk.red(`Setting "${key}" not found`))
      process.exit(5)
    }

    if (options.json) {
      console.log(JSON.stringify({ key, value }))
    } else {
      console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : value)
    }
  })

// settings set
settingsCommand
  .command('set <key> <value>')
  .description('Set a setting value')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (key, value, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSettingsService(db)

    // Try to parse value as JSON, otherwise use as string
    let parsedValue: unknown
    try {
      parsedValue = JSON.parse(value)
    } catch {
      // Check for special values
      if (value === 'true') parsedValue = true
      else if (value === 'false') parsedValue = false
      else if (/^\d+$/.test(value)) parsedValue = parseInt(value)
      else if (/^\d+\.\d+$/.test(value)) parsedValue = parseFloat(value)
      else parsedValue = value
    }

    const setting = await service.set(key, parsedValue, {
      updatedBy: 'cli',
    })

    if (options.json) {
      console.log(JSON.stringify(setting))
    } else if (options.quiet) {
      console.log(key)
    } else {
      console.log(chalk.green('✓ Set'), chalk.cyan(key), '=', JSON.stringify(parsedValue))
    }
  })

// settings delete
settingsCommand
  .command('delete <key>')
  .description('Delete a setting')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (key, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSettingsService(db)

    try {
      await service.delete(key)

      if (options.json) {
        console.log(JSON.stringify({ deleted: true, key }))
      } else if (options.quiet) {
        console.log(key)
      } else {
        console.log(chalk.green('✓ Deleted setting'), chalk.cyan(key))
      }
    } catch (error) {
      if (error instanceof SettingNotFoundError) {
        console.error(chalk.red(`Setting "${key}" not found`))
        process.exit(5)
      }
      throw error
    }
  })

// settings init
settingsCommand
  .command('init')
  .description('Initialize default settings')
  .option('--json', 'JSON output')
  .action(async (options: OutputOptions) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSettingsService(db)

    await service.initializeDefaults(undefined, 'cli')

    const allSettings = await service.getAll()

    if (options.json) {
      console.log(JSON.stringify(allSettings, null, 2))
    } else {
      console.log(chalk.green('✓ Initialized default settings'))
      console.log('')
      for (const [group, values] of Object.entries(allSettings)) {
        console.log(chalk.cyan(`${group}:`))
        if (typeof values === 'object' && values !== null) {
          for (const [key, value] of Object.entries(values)) {
            console.log(chalk.gray(`  ${key}:`), value)
          }
        }
      }
    }
  })

// settings show
settingsCommand
  .command('show')
  .description('Show all settings as structured object')
  .option('--json', 'JSON output')
  .action(async (options: OutputOptions) => {
    ensureInitialized()
    const db = await getDb()
    const service = getSettingsService(db)

    const allSettings = await service.getAll()

    if (options.json) {
      console.log(JSON.stringify(allSettings, null, 2))
      return
    }

    console.log('')
    for (const [group, values] of Object.entries(allSettings)) {
      console.log(chalk.cyan(`${group}:`))
      if (typeof values === 'object' && values !== null) {
        for (const [key, value] of Object.entries(values)) {
          console.log(chalk.gray(`  ${key}:`), value)
        }
      }
    }
    console.log('')
  })
