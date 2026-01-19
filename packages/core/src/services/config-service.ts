import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { AGENTMINE_DIR } from '../db/index.js'
import type { AgentmineConfig } from '../db/schema.js'

// ============================================
// Errors
// ============================================

export class ConfigNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`Config file not found: ${path}`)
    this.name = 'ConfigNotFoundError'
  }
}

export class InvalidConfigError extends Error {
  constructor(public readonly reason: string) {
    super(`Invalid configuration: ${reason}`)
    this.name = 'InvalidConfigError'
  }
}

// ============================================
// Default Config
// ============================================

export const defaultConfig: AgentmineConfig = {
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

// ============================================
// ConfigService
// ============================================

export class ConfigService {
  private configPath: string
  private cachedConfig: AgentmineConfig | null = null

  constructor(projectRoot: string = process.cwd()) {
    this.configPath = join(projectRoot, AGENTMINE_DIR, 'config.yaml')
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath
  }

  /**
   * Check if config file exists
   */
  exists(): boolean {
    return existsSync(this.configPath)
  }

  /**
   * Load configuration from file
   */
  load(): AgentmineConfig {
    if (this.cachedConfig) {
      return this.cachedConfig
    }

    if (!this.exists()) {
      throw new ConfigNotFoundError(this.configPath)
    }

    const content = readFileSync(this.configPath, 'utf-8')
    const parsed = parse(content)

    this.cachedConfig = this.validate(parsed)
    return this.cachedConfig
  }

  /**
   * Load configuration with defaults if file doesn't exist
   */
  loadWithDefaults(): AgentmineConfig {
    if (!this.exists()) {
      return { ...defaultConfig }
    }
    return this.load()
  }

  /**
   * Save configuration to file
   */
  save(config: AgentmineConfig): void {
    const validated = this.validate(config)
    writeFileSync(this.configPath, stringify(validated), 'utf-8')
    this.cachedConfig = validated
  }

  /**
   * Update specific config values
   */
  update(updates: Partial<AgentmineConfig>): AgentmineConfig {
    const current = this.loadWithDefaults()
    const merged = this.mergeConfig(current, updates)
    this.save(merged)
    return merged
  }

  /**
   * Clear cached config
   */
  clearCache(): void {
    this.cachedConfig = null
  }

  /**
   * Validate configuration object
   */
  validate(config: unknown): AgentmineConfig {
    if (!config || typeof config !== 'object') {
      throw new InvalidConfigError('Config must be an object')
    }

    const c = config as Record<string, unknown>

    // Validate git (required)
    if (!c.git || typeof c.git !== 'object') {
      throw new InvalidConfigError('git configuration is required')
    }

    const git = c.git as Record<string, unknown>
    if (!git.baseBranch || typeof git.baseBranch !== 'string') {
      throw new InvalidConfigError('git.baseBranch is required and must be a string')
    }

    // Build validated config with defaults
    const validated: AgentmineConfig = {
      project: this.validateProject(c.project),
      git: this.validateGit(c.git),
      database: this.validateDatabase(c.database),
      execution: this.validateExecution(c.execution),
      sessionLog: this.validateSessionLog(c.sessionLog),
    }

    return validated
  }

  // ============================================
  // Convenience getters
  // ============================================

  getBaseBranch(): string {
    return this.loadWithDefaults().git.baseBranch
  }

  getBranchPrefix(): string {
    return this.loadWithDefaults().git.branchPrefix ?? 'task-'
  }

  getProjectName(): string {
    return this.loadWithDefaults().project?.name ?? ''
  }

  isParallelExecutionEnabled(): boolean {
    return this.loadWithDefaults().execution?.parallel?.enabled ?? false
  }

  getMaxWorkers(): number {
    return this.loadWithDefaults().execution?.parallel?.maxWorkers ?? 2
  }

  // ============================================
  // Private validation methods
  // ============================================

  private validateProject(project: unknown): AgentmineConfig['project'] {
    if (!project || typeof project !== 'object') {
      return defaultConfig.project
    }

    const p = project as Record<string, unknown>
    return {
      name: typeof p.name === 'string' ? p.name : '',
      description: typeof p.description === 'string' ? p.description : '',
    }
  }

  private validateGit(git: unknown): AgentmineConfig['git'] {
    const g = git as Record<string, unknown>

    return {
      baseBranch: g.baseBranch as string,
      branchPrefix: typeof g.branchPrefix === 'string' ? g.branchPrefix : 'task-',
      commitConvention: this.validateCommitConvention(g.commitConvention),
    }
  }

  private validateCommitConvention(convention: unknown): NonNullable<AgentmineConfig['git']['commitConvention']> {
    if (!convention || typeof convention !== 'object') {
      return { enabled: true, format: 'conventional' }
    }

    const c = convention as Record<string, unknown>
    return {
      enabled: typeof c.enabled === 'boolean' ? c.enabled : true,
      format: this.isValidFormat(c.format) ? c.format : 'conventional',
    }
  }

  private validateDatabase(database: unknown): AgentmineConfig['database'] {
    if (!database || typeof database !== 'object') {
      return undefined
    }

    const d = database as Record<string, unknown>
    return {
      url: typeof d.url === 'string' ? d.url : undefined,
    }
  }

  private validateExecution(execution: unknown): AgentmineConfig['execution'] {
    if (!execution || typeof execution !== 'object') {
      return defaultConfig.execution
    }

    const e = execution as Record<string, unknown>
    return {
      parallel: this.validateParallel(e.parallel),
    }
  }

  private validateParallel(parallel: unknown): NonNullable<AgentmineConfig['execution']>['parallel'] {
    if (!parallel || typeof parallel !== 'object') {
      return defaultConfig.execution?.parallel
    }

    const p = parallel as Record<string, unknown>
    return {
      enabled: typeof p.enabled === 'boolean' ? p.enabled : false,
      maxWorkers: typeof p.maxWorkers === 'number' ? p.maxWorkers : 2,
      worktree: this.validateWorktree(p.worktree),
    }
  }

  private validateWorktree(worktree: unknown): { path?: string; cleanup?: boolean } | undefined {
    if (!worktree || typeof worktree !== 'object') {
      return undefined
    }

    const w = worktree as Record<string, unknown>
    return {
      path: typeof w.path === 'string' ? w.path : undefined,
      cleanup: typeof w.cleanup === 'boolean' ? w.cleanup : undefined,
    }
  }

  private validateSessionLog(sessionLog: unknown): AgentmineConfig['sessionLog'] {
    if (!sessionLog || typeof sessionLog !== 'object') {
      return defaultConfig.sessionLog
    }

    const s = sessionLog as Record<string, unknown>
    return {
      retention: this.validateRetention(s.retention),
    }
  }

  private validateRetention(retention: unknown): { enabled?: boolean; days?: number } | undefined {
    if (!retention || typeof retention !== 'object') {
      return defaultConfig.sessionLog?.retention
    }

    const r = retention as Record<string, unknown>
    return {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
      days: typeof r.days === 'number' ? r.days : 30,
    }
  }

  private isValidFormat(format: unknown): format is 'conventional' | 'simple' | 'custom' {
    return format === 'conventional' || format === 'simple' || format === 'custom'
  }

  private mergeConfig(base: AgentmineConfig, updates: Partial<AgentmineConfig>): AgentmineConfig {
    return {
      project: updates.project ?? base.project,
      git: updates.git ? { ...base.git, ...updates.git } : base.git,
      database: updates.database ?? base.database,
      execution: updates.execution ? {
        parallel: { ...base.execution?.parallel, ...updates.execution.parallel },
      } : base.execution,
      sessionLog: updates.sessionLog ?? base.sessionLog,
    }
  }
}
