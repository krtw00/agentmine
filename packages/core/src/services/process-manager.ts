import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'

export type Role = 'orchestrator' | 'planner' | 'supervisor' | 'worker' | 'reviewer'

export type ProcessStatus = 'running' | 'exited' | 'killed' | 'error'

export interface OutputEvent {
  processId: string
  stream: 'stdout' | 'stderr'
  data: string
  timestamp: Date
}

export interface ProcessSessionConfig {
  id?: string
  name?: string
  cwd?: string
  env?: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface ProcessSession {
  id: string
  name?: string
  cwd?: string
  env?: Record<string, string>
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface Process {
  id: string
  sessionId: string
  role: Role
  command: string[]
  pid?: number
  status: ProcessStatus
  startedAt: Date
  endedAt?: Date
  exitCode?: number | null
  signal?: NodeJS.Signals | null
}

export interface ProcessManager {
  // セッション管理
  createSession(config: ProcessSessionConfig): Promise<ProcessSession>
  destroySession(sessionId: string): Promise<void>

  // プロセス管理
  spawnProcess(sessionId: string, role: Role, command: string[]): Process
  killProcess(processId: string): Promise<void>

  // 入出力
  sendInput(processId: string, text: string): void
  onOutput(processId: string, callback: (data: OutputEvent) => void): void

  // 状態
  getProcessStatus(processId: string): ProcessStatus
  listProcesses(sessionId: string): Process[]
}

interface SessionRecord extends ProcessSession {
  processIds: Set<string>
}

interface ManagedProcess {
  info: Process
  child: ChildProcess
  outputHandlers: Set<(data: OutputEvent) => void>
}

export class ProcessManagerService implements ProcessManager {
  private sessions = new Map<string, SessionRecord>()
  private processes = new Map<string, ManagedProcess>()

  async createSession(config: ProcessSessionConfig): Promise<ProcessSession> {
    const id = config.id ?? randomUUID()
    if (this.sessions.has(id)) {
      throw new Error(`Session "${id}" already exists`)
    }

    const session: SessionRecord = {
      id,
      name: config.name,
      cwd: config.cwd,
      env: config.env,
      metadata: config.metadata,
      createdAt: new Date(),
      processIds: new Set(),
    }

    this.sessions.set(id, session)
    return session
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`)
    }

    const killTargets = Array.from(session.processIds).map(id => this.killProcess(id))
    await Promise.allSettled(killTargets)

    for (const id of session.processIds) {
      this.processes.delete(id)
    }
    this.sessions.delete(sessionId)
  }

  spawnProcess(sessionId: string, role: Role, command: string[]): Process {
    if (command.length === 0) {
      throw new Error('Command must include at least one entry')
    }

    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`)
    }

    const processId = randomUUID()
    const [commandName, ...args] = command
    const child = spawn(commandName, args, {
      cwd: session.cwd,
      env: { ...process.env, ...session.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    })

    const info: Process = {
      id: processId,
      sessionId,
      role,
      command,
      pid: child.pid,
      status: 'running',
      startedAt: new Date(),
    }

    const managed: ManagedProcess = {
      info,
      child,
      outputHandlers: new Set(),
    }

    session.processIds.add(processId)
    this.processes.set(processId, managed)

    child.stdout?.on('data', chunk => {
      this.emitOutput(managed, 'stdout', chunk)
    })

    child.stderr?.on('data', chunk => {
      this.emitOutput(managed, 'stderr', chunk)
    })

    child.on('error', () => {
      managed.info.status = 'error'
      managed.info.endedAt = new Date()
    })

    child.on('exit', (code, signal) => {
      managed.info.exitCode = code
      managed.info.signal = signal
      managed.info.endedAt = new Date()
      if (signal) {
        managed.info.status = 'killed'
      } else if (managed.info.status !== 'error') {
        managed.info.status = 'exited'
      }
    })

    return managed.info
  }

  async killProcess(processId: string): Promise<void> {
    const managed = this.processes.get(processId)
    if (!managed) {
      throw new Error(`Process "${processId}" not found`)
    }

    if (managed.info.status !== 'running') {
      return
    }

    const child = managed.child
    if (child.killed) {
      return
    }

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        if (managed.info.status === 'running') {
          child.kill('SIGKILL')
        }
      }, 5000)

      child.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })

      child.kill('SIGTERM')
    })
  }

  sendInput(processId: string, text: string): void {
    const managed = this.processes.get(processId)
    if (!managed) {
      throw new Error(`Process "${processId}" not found`)
    }

    if (!managed.child.stdin || managed.child.stdin.destroyed) {
      throw new Error(`Process "${processId}" does not accept input`)
    }

    managed.child.stdin.write(text)
  }

  onOutput(processId: string, callback: (data: OutputEvent) => void): void {
    const managed = this.processes.get(processId)
    if (!managed) {
      throw new Error(`Process "${processId}" not found`)
    }

    managed.outputHandlers.add(callback)
  }

  getProcessStatus(processId: string): ProcessStatus {
    const managed = this.processes.get(processId)
    if (!managed) {
      throw new Error(`Process "${processId}" not found`)
    }

    return managed.info.status
  }

  listProcesses(sessionId: string): Process[] {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`)
    }

    return Array.from(session.processIds)
      .map(id => this.processes.get(id))
      .filter((process): process is ManagedProcess => Boolean(process))
      .map(process => process.info)
  }

  private emitOutput(
    managed: ManagedProcess,
    stream: 'stdout' | 'stderr',
    chunk: Buffer | string
  ): void {
    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    const event: OutputEvent = {
      processId: managed.info.id,
      stream,
      data,
      timestamp: new Date(),
    }

    for (const handler of managed.outputHandlers) {
      handler(event)
    }
  }
}
