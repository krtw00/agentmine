import { Command } from 'commander'
import chalk from 'chalk'
import {
  isProjectInitialized,
  createDb,
  initializeDb,
  closeDb,
  getDefaultDbPath,
  getAgentmineDir,
} from '@agentmine/core'
import { existsSync, unlinkSync, statSync } from 'node:fs'

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================
// Commands
// ============================================

export const dbCommand = new Command('db')
  .description('Database management commands')

// db migrate
dbCommand
  .command('migrate')
  .description('Run database migrations')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()

    const dbPath = getDefaultDbPath()

    try {
      const db = createDb()
      await initializeDb(db)
      closeDb()

      if (options.json) {
        console.log(JSON.stringify({ success: true, path: dbPath }))
      } else {
        console.log(chalk.green('✓ Database migrations completed'))
        console.log(chalk.gray(`  Path: ${dbPath}`))
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      } else {
        console.error(chalk.red('Error running migrations:'))
        console.error(error instanceof Error ? error.message : error)
      }
      process.exit(4)
    }
  })

// db reset
dbCommand
  .command('reset')
  .description('Reset database (deletes all data)')
  .option('--force', 'Skip confirmation')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()

    const dbPath = getDefaultDbPath()

    if (!existsSync(dbPath)) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: 'Database not found' }))
      } else {
        console.error(chalk.red('Database not found'))
      }
      process.exit(5)
    }

    if (!options.force && !options.json) {
      console.log(chalk.yellow('Warning: This will delete all data in the database.'))
      console.log(chalk.gray(`  Path: ${dbPath}`))
      console.log('')
      console.log(chalk.gray('Use --force to skip this confirmation'))
      process.exit(0)
    }

    try {
      // Delete database file
      unlinkSync(dbPath)

      // Recreate with fresh schema
      const db = createDb()
      await initializeDb(db)
      closeDb()

      if (options.json) {
        console.log(JSON.stringify({ success: true, path: dbPath }))
      } else {
        console.log(chalk.green('✓ Database reset completed'))
        console.log(chalk.gray(`  Path: ${dbPath}`))
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      } else {
        console.error(chalk.red('Error resetting database:'))
        console.error(error instanceof Error ? error.message : error)
      }
      process.exit(4)
    }
  })

// db info
dbCommand
  .command('info')
  .description('Show database information')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()

    const dbPath = getDefaultDbPath()
    const agentmineDir = getAgentmineDir()

    if (!existsSync(dbPath)) {
      if (options.json) {
        console.log(JSON.stringify({ exists: false, path: dbPath }))
      } else {
        console.log(chalk.yellow('Database not found'))
        console.log(chalk.gray(`  Expected path: ${dbPath}`))
        console.log(chalk.gray('  Run `agentmine db migrate` to create'))
      }
      return
    }

    const stats = statSync(dbPath)
    const info = {
      exists: true,
      path: dbPath,
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      modified: stats.mtime.toISOString(),
    }

    if (options.json) {
      console.log(JSON.stringify(info))
    } else {
      console.log(chalk.bold('Database Information'))
      console.log('')
      console.log(chalk.gray('Path:    '), chalk.cyan(dbPath))
      console.log(chalk.gray('Size:    '), info.sizeFormatted)
      console.log(chalk.gray('Modified:'), info.modified)
    }
  })
