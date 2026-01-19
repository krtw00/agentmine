import { Command } from 'commander'
import chalk from 'chalk'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { stringify } from 'yaml'

const defaultConfig = {
  project: {
    name: '',
    description: '',
  },
  agents: {
    coder: {
      description: 'コード実装担当',
      model: 'claude-sonnet',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
      skills: ['commit', 'test', 'debug'],
    },
    reviewer: {
      description: 'コードレビュー担当',
      model: 'claude-haiku',
      tools: ['Read', 'Grep', 'Glob'],
      skills: ['review'],
    },
  },
  skills: {
    commit: { source: 'builtin' },
    test: { source: 'builtin' },
    review: { source: 'builtin' },
    debug: { source: 'builtin' },
  },
  git: {
    branch_prefix: 'task-',
    auto_pr: true,
  },
}

export const initCommand = new Command('init')
  .description('Initialize agentmine in current directory')
  .option('-n, --name <name>', 'Project name')
  .action(async (options) => {
    const cwd = process.cwd()
    const agentmineDir = join(cwd, '.agentmine')
    const configPath = join(agentmineDir, 'config.yaml')

    // Check if already initialized
    if (existsSync(agentmineDir)) {
      console.log(chalk.yellow('⚠ agentmine is already initialized in this directory'))
      return
    }

    // Create directory
    mkdirSync(agentmineDir, { recursive: true })
    mkdirSync(join(agentmineDir, 'skills'), { recursive: true })

    // Get project name
    const projectName = options.name ?? cwd.split('/').pop() ?? 'my-project'

    // Create config
    const config = {
      ...defaultConfig,
      project: {
        ...defaultConfig.project,
        name: projectName,
      },
    }

    // Write config
    writeFileSync(configPath, stringify(config), 'utf-8')

    console.log(chalk.green('✓ Initialized agentmine in'), chalk.cyan(agentmineDir))
    console.log('')
    console.log('Created:')
    console.log(chalk.gray('  .agentmine/'))
    console.log(chalk.gray('  ├── config.yaml'))
    console.log(chalk.gray('  └── skills/'))
    console.log('')
    console.log('Next steps:')
    console.log(chalk.cyan('  agentmine task add "Your first task"'))
  })
