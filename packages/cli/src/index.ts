import { Command } from 'commander'
import { VERSION } from '@agentmine/core'
import { initCommand } from './commands/init.js'
import { taskCommand } from './commands/task.js'
import { agentCommand } from './commands/agent.js'
import { skillCommand } from './commands/skill.js'
import { uiCommand } from './commands/ui.js'

const program = new Command()

program
  .name('agentmine')
  .description('AI Project Manager - Redmine for AI agents')
  .version(VERSION)

// Add commands
program.addCommand(initCommand)
program.addCommand(taskCommand)
program.addCommand(agentCommand)
program.addCommand(skillCommand)
program.addCommand(uiCommand)

program.parse()
