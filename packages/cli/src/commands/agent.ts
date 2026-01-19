import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'

interface AgentConfig {
  description: string
  model: string
  tools: string[]
  skills: string[]
}

interface Config {
  agents: Record<string, AgentConfig>
}

function loadConfig(): Config | null {
  const configPath = join(process.cwd(), '.agentmine', 'config.yaml')
  if (!existsSync(configPath)) {
    return null
  }
  const content = readFileSync(configPath, 'utf-8')
  return parse(content) as Config
}

export const agentCommand = new Command('agent')
  .description('Manage agents')

// agent list
agentCommand
  .command('list')
  .description('List available agents')
  .action(async () => {
    const config = loadConfig()

    if (!config) {
      console.log(chalk.yellow('⚠ No .agentmine/config.yaml found'))
      console.log(chalk.gray('  Run `agentmine init` to initialize'))
      return
    }

    const table = new Table({
      head: [
        chalk.white('Name'),
        chalk.white('Model'),
        chalk.white('Description'),
        chalk.white('Skills'),
      ],
      style: { head: [], border: [] },
    })

    for (const [name, agent] of Object.entries(config.agents)) {
      table.push([
        chalk.cyan(name),
        agent.model,
        agent.description,
        agent.skills.join(', '),
      ])
    }

    console.log(table.toString())
  })

// agent show
agentCommand
  .command('show <name>')
  .description('Show agent details')
  .action(async (name) => {
    const config = loadConfig()

    if (!config) {
      console.log(chalk.yellow('⚠ No .agentmine/config.yaml found'))
      return
    }

    const agent = config.agents[name]
    if (!agent) {
      console.log(chalk.red(`Agent "${name}" not found`))
      console.log(chalk.gray('Available agents:'), Object.keys(config.agents).join(', '))
      return
    }

    console.log('')
    console.log(chalk.cyan(name), chalk.gray('-'), agent.description)
    console.log('')
    console.log(chalk.gray('Model:  '), agent.model)
    console.log(chalk.gray('Tools:  '), agent.tools.join(', '))
    console.log(chalk.gray('Skills: '), agent.skills.join(', '))
    console.log('')
  })

// agent run
agentCommand
  .command('run <name> <prompt...>')
  .description('Run an agent with a prompt')
  .action(async (name, promptParts) => {
    const config = loadConfig()

    if (!config) {
      console.log(chalk.yellow('⚠ No .agentmine/config.yaml found'))
      return
    }

    const agent = config.agents[name]
    if (!agent) {
      console.log(chalk.red(`Agent "${name}" not found`))
      return
    }

    const prompt = promptParts.join(' ')

    console.log(chalk.cyan('🤖 Running agent:'), name)
    console.log(chalk.gray('Model:'), agent.model)
    console.log(chalk.gray('Prompt:'), prompt)
    console.log('')

    // TODO: Implement actual agent execution with Claude Code or similar
    console.log(chalk.yellow('⚠ Agent execution not yet implemented'))
    console.log(chalk.gray('  This will integrate with Claude Code or similar AI tools'))
  })
