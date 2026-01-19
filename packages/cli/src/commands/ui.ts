import { Command } from 'commander'
import chalk from 'chalk'

export const uiCommand = new Command('ui')
  .description('Start the web UI')
  .option('-p, --port <port>', 'Port number', '3333')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options) => {
    console.log(chalk.cyan('🌐 Starting web UI...'))
    console.log(chalk.gray('Port:'), options.port)
    console.log('')

    // TODO: Start the Next.js web UI server
    console.log(chalk.yellow('⚠ Web UI not yet implemented'))
    console.log(chalk.gray('  The web UI will provide:'))
    console.log(chalk.gray('  - Kanban board for task management'))
    console.log(chalk.gray('  - Timeline view of activities'))
    console.log(chalk.gray('  - Agent and skill configuration'))
    console.log('')
    console.log(chalk.gray('  Coming soon at:'), chalk.cyan(`http://localhost:${options.port}`))
  })
