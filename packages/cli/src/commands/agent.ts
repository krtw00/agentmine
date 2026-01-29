import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { parse, stringify } from 'yaml'
import { isProjectInitialized, type AgentDefinition, AGENTMINE_DIR } from '@agentmine/core'

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

function getAgentsDir(): string {
  return join(process.cwd(), AGENTMINE_DIR, 'agents')
}

function loadAgent(name: string): AgentDefinition | null {
  const agentsDir = getAgentsDir()
  const filePath = join(agentsDir, `${name}.yaml`)

  if (!existsSync(filePath)) {
    return null
  }

  const content = readFileSync(filePath, 'utf-8')
  return parse(content) as AgentDefinition
}

function loadAllAgents(): AgentDefinition[] {
  const agentsDir = getAgentsDir()

  if (!existsSync(agentsDir)) {
    return []
  }

  const files = readdirSync(agentsDir).filter(f => f.endsWith('.yaml'))
  return files.map(f => {
    const content = readFileSync(join(agentsDir, f), 'utf-8')
    return parse(content) as AgentDefinition
  })
}

interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

// ============================================
// Commands
// ============================================

export const agentCommand = new Command('agent')
  .description('Manage agents')

// agent list
agentCommand
  .command('list')
  .description('List available agents')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (names only)')
  .action(async (options: OutputOptions) => {
    ensureInitialized()
    const agents = loadAllAgents()

    if (options.json) {
      console.log(JSON.stringify(agents, null, 2))
      return
    }

    if (options.quiet) {
      agents.forEach(a => console.log(a.name))
      return
    }

    if (agents.length === 0) {
      console.log(chalk.gray('No agents defined.'))
      console.log(chalk.gray('Create one in .agentmine/agents/'))
      return
    }

    const table = new Table({
      head: [
        chalk.white('Name'),
        chalk.white('Client'),
        chalk.white('Model'),
        chalk.white('Description'),
      ],
      style: { head: [], border: [] },
    })

    for (const agent of agents) {
      table.push([
        chalk.cyan(agent.name),
        agent.client,
        agent.model,
        agent.description ?? '',
      ])
    }

    console.log(table.toString())
  })

// agent show
agentCommand
  .command('show <name>')
  .description('Show agent details')
  .option('--json', 'JSON output')
  .action(async (name, options: OutputOptions) => {
    ensureInitialized()
    const agent = loadAgent(name)

    if (!agent) {
      console.error(chalk.red(`Agent "${name}" not found`))
      const agents = loadAllAgents()
      if (agents.length > 0) {
        console.log(chalk.gray('Available agents:'), agents.map(a => a.name).join(', '))
      }
      process.exit(5)
    }

    if (options.json) {
      console.log(JSON.stringify(agent, null, 2))
      return
    }

    console.log('')
    console.log(chalk.cyan(agent.name), chalk.gray('-'), agent.description ?? '(no description)')
    console.log('')
    console.log(chalk.gray('Client: '), agent.client)
    console.log(chalk.gray('Model:  '), agent.model)
    console.log('')
    console.log(chalk.gray('Scope:'))
    console.log(chalk.gray('  Read:   '), (agent.scope?.read ?? []).join(', ') || '-')
    console.log(chalk.gray('  Write:  '), (agent.scope?.write ?? []).join(', ') || '-')
    console.log(chalk.gray('  Exclude:'), (agent.scope?.exclude ?? []).join(', ') || '-')
    if (agent.config) {
      console.log('')
      console.log(chalk.gray('Config:'))
      if (agent.config.temperature !== undefined) {
        console.log(chalk.gray('  Temperature:'), agent.config.temperature)
      }
      if (agent.config.maxTokens !== undefined) {
        console.log(chalk.gray('  Max Tokens: '), agent.config.maxTokens)
      }
      if (agent.config.promptFile) {
        console.log(chalk.gray('  Prompt File:'), agent.config.promptFile)
      }
    }
    console.log('')
  })

// agent create
agentCommand
  .command('create <name>')
  .description('Create a new agent definition')
  .option('-d, --description <description>', 'Agent description')
  .option('-c, --client <client>', 'Client (claude-code, opencode, codex)', 'claude-code')
  .option('-m, --model <model>', 'Model (opus, sonnet, haiku)', 'sonnet')
  .option('--json', 'JSON output')
  .action(async (name, options) => {
    ensureInitialized()
    const agentsDir = getAgentsDir()
    const filePath = join(agentsDir, `${name}.yaml`)

    if (existsSync(filePath)) {
      console.error(chalk.red(`Agent "${name}" already exists`))
      process.exit(6) // state error
    }

    const agent: AgentDefinition = {
      name,
      description: options.description,
      client: options.client,
      model: options.model,
      scope: {
        read: ['**/*'],
        write: ['**/*'],
        exclude: ['node_modules/**', '.git/**'],
      },
    }

    writeFileSync(filePath, stringify(agent), 'utf-8')

    if (options.json) {
      console.log(JSON.stringify(agent, null, 2))
    } else {
      console.log(chalk.green('✓ Created agent'), chalk.cyan(name))
      console.log(chalk.gray(`  File: .agentmine/agents/${name}.yaml`))
    }
  })

// agent edit
agentCommand
  .command('edit <name>')
  .description('Edit agent definition (opens in $EDITOR or shows path)')
  .action(async (name) => {
    ensureInitialized()
    const agentsDir = getAgentsDir()
    const filePath = join(agentsDir, `${name}.yaml`)

    if (!existsSync(filePath)) {
      console.error(chalk.red(`Agent "${name}" not found`))
      process.exit(5)
    }

    // Show the file path for manual editing
    console.log(chalk.gray('Edit agent definition at:'))
    console.log(chalk.cyan(filePath))
  })

// agent delete
agentCommand
  .command('delete <name>')
  .description('Delete an agent definition')
  .option('--json', 'JSON output')
  .action(async (name, options) => {
    ensureInitialized()
    const agentsDir = getAgentsDir()
    const filePath = join(agentsDir, `${name}.yaml`)

    if (!existsSync(filePath)) {
      console.error(chalk.red(`Agent "${name}" not found`))
      process.exit(5)
    }

    const { unlinkSync } = await import('fs')
    unlinkSync(filePath)

    if (options.json) {
      console.log(JSON.stringify({ deleted: true, name }))
    } else {
      console.log(chalk.green('✓ Deleted agent'), chalk.cyan(name))
    }
  })
