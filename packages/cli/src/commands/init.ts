import { Command } from 'commander'
import chalk from 'chalk'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { stringify } from 'yaml'
import { createDb, initializeDb, type AgentmineConfig } from '@agentmine/core'

const defaultConfig: AgentmineConfig = {
  project: {
    name: '',
    description: '',
  },
  git: {
    baseBranch: 'main',
    branchPrefix: 'task-',
    commitConvention: {
      enabled: true,
      format: 'conventional',
    },
  },
  execution: {
    parallel: {
      enabled: false,
      maxWorkers: 2,
    },
  },
  sessionLog: {
    retention: {
      enabled: true,
      days: 30,
    },
  },
}

export const initCommand = new Command('init')
  .description('Initialize agentmine in current directory')
  .option('-n, --name <name>', 'Project name')
  .option('--base-branch <branch>', 'Git base branch', 'main')
  .action(async (options) => {
    const cwd = process.cwd()
    const agentmineDir = join(cwd, '.agentmine')
    const configPath = join(agentmineDir, 'config.yaml')
    const agentsDir = join(agentmineDir, 'agents')
    const memoryDir = join(agentmineDir, 'memory')

    // Check if already initialized
    if (existsSync(agentmineDir)) {
      console.log(chalk.yellow('⚠ agentmine is already initialized in this directory'))
      return
    }

    // Create directories
    mkdirSync(agentmineDir, { recursive: true })
    mkdirSync(agentsDir, { recursive: true })
    mkdirSync(memoryDir, { recursive: true })

    // Get project name
    const projectName = options.name ?? cwd.split('/').pop() ?? 'my-project'

    // Create config
    const config: AgentmineConfig = {
      ...defaultConfig,
      project: {
        ...defaultConfig.project,
        name: projectName,
      },
      git: {
        ...defaultConfig.git,
        baseBranch: options.baseBranch,
      },
    }

    // Write config
    writeFileSync(configPath, stringify(config), 'utf-8')

    // Create default agent definition
    const defaultAgent = {
      name: 'coder',
      description: 'General coding agent',
      client: 'claude-code',
      model: 'sonnet',
      scope: {
        read: ['**/*'],
        write: ['**/*'],
        exclude: ['node_modules/**', '.git/**'],
      },
    }
    writeFileSync(join(agentsDir, 'coder.yaml'), stringify(defaultAgent), 'utf-8')

    // Initialize database
    try {
      const db = createDb({ projectRoot: cwd })
      await initializeDb(db)
      console.log(chalk.green('✓ Database initialized'))
    } catch (error) {
      console.log(chalk.red('✗ Failed to initialize database:'), error)
      return
    }

    console.log(chalk.green('✓ Initialized agentmine in'), chalk.cyan(agentmineDir))
    console.log('')
    console.log('Created:')
    console.log(chalk.gray('  .agentmine/'))
    console.log(chalk.gray('  ├── config.yaml'))
    console.log(chalk.gray('  ├── data.db'))
    console.log(chalk.gray('  ├── agents/'))
    console.log(chalk.gray('  │   └── coder.yaml'))
    console.log(chalk.gray('  └── memory/'))
    console.log('')
    console.log('Next steps:')
    console.log(chalk.cyan('  agentmine task add "Your first task"'))
  })
