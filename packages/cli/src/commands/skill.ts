import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'

interface SkillConfig {
  source: 'builtin' | 'local' | 'remote'
  path?: string
  url?: string
  prompt?: string
}

interface Config {
  skills: Record<string, SkillConfig>
}

function loadConfig(): Config | null {
  const configPath = join(process.cwd(), '.agentmine', 'config.yaml')
  if (!existsSync(configPath)) {
    return null
  }
  const content = readFileSync(configPath, 'utf-8')
  return parse(content) as Config
}

const builtinSkills: Record<string, { description: string; prompt: string }> = {
  commit: {
    description: 'Gitコミットを作成',
    prompt: 'Run /commit to create a conventional commit for the current changes.',
  },
  test: {
    description: 'テストを実行',
    prompt: 'Run the test suite and fix any failing tests.',
  },
  review: {
    description: 'コードレビュー',
    prompt: 'Review the recent changes and provide feedback on code quality, potential bugs, and improvements.',
  },
  debug: {
    description: 'デバッグ支援',
    prompt: 'Analyze the error and help debug the issue.',
  },
}

export const skillCommand = new Command('skill')
  .description('Manage skills')

// skill list
skillCommand
  .command('list')
  .description('List available skills')
  .action(async () => {
    const config = loadConfig()

    const table = new Table({
      head: [
        chalk.white('Name'),
        chalk.white('Source'),
        chalk.white('Description'),
      ],
      style: { head: [], border: [] },
    })

    // Add builtin skills
    for (const [name, skill] of Object.entries(builtinSkills)) {
      table.push([
        chalk.cyan(name),
        chalk.gray('builtin'),
        skill.description,
      ])
    }

    // Add project skills
    if (config?.skills) {
      for (const [name, skill] of Object.entries(config.skills)) {
        if (skill.source !== 'builtin') {
          table.push([
            chalk.cyan(name),
            skill.source,
            skill.path ?? skill.url ?? '-',
          ])
        }
      }
    }

    console.log(table.toString())
  })

// skill show
skillCommand
  .command('show <name>')
  .description('Show skill details')
  .action(async (name) => {
    const builtin = builtinSkills[name]
    if (builtin) {
      console.log('')
      console.log(chalk.cyan(name), chalk.gray('(builtin)'))
      console.log('')
      console.log(chalk.gray('Description:'))
      console.log(builtin.description)
      console.log('')
      console.log(chalk.gray('Prompt:'))
      console.log(builtin.prompt)
      console.log('')
      return
    }

    const config = loadConfig()
    const skill = config?.skills?.[name]

    if (!skill) {
      console.log(chalk.red(`Skill "${name}" not found`))
      return
    }

    console.log('')
    console.log(chalk.cyan(name))
    console.log('')
    console.log(chalk.gray('Source:'), skill.source)
    if (skill.path) console.log(chalk.gray('Path:  '), skill.path)
    if (skill.url) console.log(chalk.gray('URL:   '), skill.url)
    if (skill.prompt) {
      console.log(chalk.gray('Prompt:'))
      console.log(skill.prompt)
    }
    console.log('')
  })

// skill run
skillCommand
  .command('run <name>')
  .description('Run a skill')
  .action(async (name) => {
    const builtin = builtinSkills[name]

    console.log(chalk.cyan('⚡ Running skill:'), name)

    if (builtin) {
      console.log(chalk.gray('Prompt:'), builtin.prompt)
      console.log('')
      // TODO: Implement actual skill execution
      console.log(chalk.yellow('⚠ Skill execution not yet implemented'))
      return
    }

    const config = loadConfig()
    const skill = config?.skills?.[name]

    if (!skill) {
      console.log(chalk.red(`Skill "${name}" not found`))
      return
    }

    // TODO: Load and execute skill from path/url/prompt
    console.log(chalk.yellow('⚠ Skill execution not yet implemented'))
  })
