import { Command } from 'commander'
import chalk from 'chalk'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolve the web package directory
 * Try import.meta.url relative first, then CWD fallback
 */
function resolveWebDir(): string {
  // Try relative to this file (packages/cli/dist/ → packages/web/)
  try {
    const cliDir = dirname(fileURLToPath(import.meta.url))
    const candidate = resolve(cliDir, '..', '..', 'web')
    if (existsSync(resolve(candidate, 'package.json'))) {
      return candidate
    }
  } catch {
    // import.meta.url not available or path doesn't exist
  }

  // CWD-based fallback (monorepo root/packages/web)
  const cwdCandidate = resolve(process.cwd(), 'packages', 'web')
  if (existsSync(resolve(cwdCandidate, 'package.json'))) {
    return cwdCandidate
  }

  throw new Error(
    'Could not find @agentmine/web package. ' +
    'Run this command from the AgentMine monorepo root, or ensure packages/web exists.'
  )
}

export const uiCommand = new Command('ui')
  .description('Start the web UI')
  .option('-p, --port <port>', 'Port number', '3333')
  .option('--no-open', 'Do not open browser automatically')
  .option('--dev', 'Force development mode')
  .action(async (options) => {
    const port = options.port

    let webDir: string
    try {
      webDir = resolveWebDir()
    } catch (err) {
      console.error(chalk.red((err as Error).message))
      process.exit(1)
    }

    const hasNextBuild = existsSync(resolve(webDir, '.next'))
    const isDev = options.dev || !hasNextBuild

    const mode = isDev ? 'dev' : 'start'
    console.log(chalk.cyan(`Starting web UI (${mode} mode) on port ${port}...`))

    // Build Next.js command
    const args = ['next', mode, '--port', port]
    const child: ChildProcess = spawn('npx', args, {
      cwd: webDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: port,
      },
      shell: true,
    })

    let opened = false

    const openBrowser = async (url: string) => {
      if (opened || !options.open) return
      opened = true
      try {
        const open = (await import('open')).default
        await open(url)
      } catch {
        // open package not available, skip
        console.log(chalk.gray(`  Open in browser: ${url}`))
      }
    }

    child.stdout?.on('data', (data: Buffer) => {
      const line = data.toString()
      process.stdout.write(line)

      // Detect Next.js ready message and open browser
      if (!opened && (line.includes('Ready') || line.includes('ready') || line.includes(`localhost:${port}`))) {
        openBrowser(`http://localhost:${port}`)
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data.toString())
    })

    child.on('error', (err) => {
      console.error(chalk.red('Failed to start web UI:'), err.message)
      process.exit(1)
    })

    child.on('exit', (code, signal) => {
      if (signal) {
        console.log(chalk.gray(`\nWeb UI stopped (${signal})`))
      } else if (code !== 0) {
        console.error(chalk.red(`Web UI exited with code ${code}`))
        process.exit(code ?? 1)
      }
    })

    // Graceful shutdown
    const shutdown = () => {
      console.log(chalk.gray('\nShutting down web UI...'))
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL')
        }
        process.exit(0)
      }, 5000)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })
