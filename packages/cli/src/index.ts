import { Command } from 'commander'
import { VERSION } from '@agentmine/core'
import { initCommand } from './commands/init.js'
import { taskCommand } from './commands/task.js'
import { agentCommand } from './commands/agent.js'
import { sessionCommand } from './commands/session.js'
import { workerCommand } from './commands/worker.js'
import { memoryCommand } from './commands/memory.js'
import { mcpCommand } from './commands/mcp.js'
import { dbCommand } from './commands/db.js'

const program = new Command()

program
  .name('agentmine')
  .description('Safe Parallel AI Development Environment')
  .version(VERSION)

// Add commands
program.addCommand(initCommand)
program.addCommand(taskCommand)
program.addCommand(agentCommand)
program.addCommand(sessionCommand)
program.addCommand(workerCommand)
program.addCommand(memoryCommand)
program.addCommand(mcpCommand)
program.addCommand(dbCommand)

program.parse()
