import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, readdirSync, statSync, chmodSync, unlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
import { minimatch } from 'minimatch'
import { AGENTMINE_DIR } from '../db/index.js'
import type { AgentScope } from '../db/schema.js'

// Re-export AgentScope for convenience
export type { AgentScope } from '../db/schema.js'

// ============================================
// Types
// ============================================

export interface WorktreeInfo {
  /** Task ID */
  taskId: number
  /** Branch name */
  branchName: string
  /** Worktree path */
  path: string
  /** Whether the worktree exists */
  exists: boolean
}

export interface CreateWorktreeOptions {
  /** Task ID */
  taskId: number
  /** Base branch to create from (default: current branch) */
  baseBranch?: string
}

export interface ApplyScopeResult {
  /** Number of files deleted (excluded) */
  deletedCount: number
  /** Number of files made read-only */
  readOnlyCount: number
  /** List of deleted file paths */
  deletedFiles: string[]
  /** List of read-only file paths */
  readOnlyFiles: string[]
}

// ============================================
// Errors
// ============================================

export class WorktreeError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message)
    this.name = 'WorktreeError'
  }
}

export class WorktreeAlreadyExistsError extends WorktreeError {
  constructor(public readonly taskId: number, public readonly path: string) {
    super(`Worktree for task #${taskId} already exists at ${path}`)
    this.name = 'WorktreeAlreadyExistsError'
  }
}

export class WorktreeNotFoundError extends WorktreeError {
  constructor(public readonly taskId: number) {
    super(`Worktree for task #${taskId} not found`)
    this.name = 'WorktreeNotFoundError'
  }
}

// ============================================
// WorktreeService
// ============================================

export class WorktreeService {
  private projectRoot: string
  private worktreesDir: string

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.worktreesDir = join(projectRoot, AGENTMINE_DIR, 'worktrees')
  }

  /**
   * Get the worktrees directory path
   */
  getWorktreesDir(): string {
    return this.worktreesDir
  }

  /**
   * Get worktree path for a task
   */
  getWorktreePath(taskId: number): string {
    return join(this.worktreesDir, `task-${taskId}`)
  }

  /**
   * Get branch name for a task
   */
  getBranchName(taskId: number): string {
    return `task-${taskId}`
  }

  /**
   * Check if worktree exists for a task
   */
  exists(taskId: number): boolean {
    return existsSync(this.getWorktreePath(taskId))
  }

  /**
   * Get worktree info for a task
   */
  getInfo(taskId: number): WorktreeInfo {
    const path = this.getWorktreePath(taskId)
    const branchName = this.getBranchName(taskId)
    return {
      taskId,
      branchName,
      path,
      exists: existsSync(path),
    }
  }

  /**
   * List all worktrees
   */
  list(): WorktreeInfo[] {
    if (!existsSync(this.worktreesDir)) {
      return []
    }

    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      })

      const worktrees: WorktreeInfo[] = []
      const entries = output.split('\n\n').filter(Boolean)

      for (const entry of entries) {
        const lines = entry.split('\n')
        const worktreePath = lines.find(l => l.startsWith('worktree '))?.slice(9)
        const branch = lines.find(l => l.startsWith('branch '))?.slice(7)

        if (worktreePath && branch && worktreePath.includes('task-')) {
          const match = worktreePath.match(/task-(\d+)$/)
          if (match) {
            const taskId = parseInt(match[1])
            worktrees.push({
              taskId,
              branchName: branch.replace('refs/heads/', ''),
              path: worktreePath,
              exists: true,
            })
          }
        }
      }

      return worktrees
    } catch {
      return []
    }
  }

  /**
   * Create a worktree for a task
   */
  create(options: CreateWorktreeOptions): WorktreeInfo {
    const { taskId, baseBranch } = options
    const worktreePath = this.getWorktreePath(taskId)
    const branchName = this.getBranchName(taskId)

    // Check if already exists
    if (this.exists(taskId)) {
      throw new WorktreeAlreadyExistsError(taskId, worktreePath)
    }

    // Ensure worktrees directory exists
    if (!existsSync(this.worktreesDir)) {
      mkdirSync(this.worktreesDir, { recursive: true })
    }

    // Get base branch
    const base = baseBranch || this.getCurrentBranch()

    try {
      // Create worktree with new branch
      execSync(`git worktree add -b ${branchName} "${worktreePath}" ${base}`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      return {
        taskId,
        branchName,
        path: worktreePath,
        exists: true,
      }
    } catch (error) {
      // Check if branch already exists
      if (error instanceof Error && error.message.includes('already exists')) {
        // Try to create worktree using existing branch
        try {
          execSync(`git worktree add "${worktreePath}" ${branchName}`, {
            cwd: this.projectRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          })

          return {
            taskId,
            branchName,
            path: worktreePath,
            exists: true,
          }
        } catch (innerError) {
          throw new WorktreeError(
            `Failed to create worktree: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`,
            { taskId, path: worktreePath }
          )
        }
      }

      throw new WorktreeError(
        `Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { taskId, path: worktreePath }
      )
    }
  }

  /**
   * Remove a worktree for a task
   */
  remove(taskId: number, force: boolean = false): void {
    const worktreePath = this.getWorktreePath(taskId)

    if (!this.exists(taskId)) {
      throw new WorktreeNotFoundError(taskId)
    }

    try {
      const forceFlag = force ? '--force' : ''
      execSync(`git worktree remove ${forceFlag} "${worktreePath}"`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      })
    } catch (error) {
      throw new WorktreeError(
        `Failed to remove worktree: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { taskId, path: worktreePath }
      )
    }
  }

  /**
   * Clean up all worktrees (prune stale entries)
   */
  prune(): void {
    try {
      execSync('git worktree prune', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      })
    } catch {
      // Ignore errors
    }
  }

  /**
   * Get current branch name
   */
  private getCurrentBranch(): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      }).trim()
    } catch {
      return 'main'
    }
  }

  /**
   * Apply scope restrictions to a worktree
   * - exclude: Uses git sparse-checkout to hide files (git won't see them as deleted)
   * - write: Files outside write patterns become read-only
   */
  applyScope(taskId: number, scope: AgentScope): ApplyScopeResult {
    const worktreePath = this.getWorktreePath(taskId)

    if (!this.exists(taskId)) {
      throw new WorktreeNotFoundError(taskId)
    }

    const result: ApplyScopeResult = {
      deletedCount: 0,
      readOnlyCount: 0,
      deletedFiles: [],
      readOnlyFiles: [],
    }

    const excludePatterns = scope.exclude || []
    const writePatterns = scope.write || ['**/*']

    // Apply sparse-checkout to exclude files (git won't track them as deleted)
    if (excludePatterns.length > 0) {
      this.applySparseCheckout(worktreePath, excludePatterns, result)
    }

    // Get all remaining files in worktree
    const allFiles = this.getAllFiles(worktreePath)

    for (const filePath of allFiles) {
      const relativePath = relative(worktreePath, filePath)

      // Skip .git directory
      if (relativePath.startsWith('.git/') || relativePath === '.git') {
        continue
      }

      // Check if file is writable (matches write patterns)
      // Files NOT in write patterns become read-only
      const isWritable = writePatterns.some(pattern =>
        minimatch(relativePath, pattern, { dot: true })
      )

      if (!isWritable) {
        try {
          // Make file read-only (remove write permission)
          const stat = statSync(filePath)
          const newMode = stat.mode & ~0o222 // Remove write bits
          chmodSync(filePath, newMode)
          result.readOnlyCount++
          result.readOnlyFiles.push(relativePath)
        } catch {
          // Ignore chmod errors
        }
      }
    }

    return result
  }

  /**
   * Apply sparse-checkout to exclude files from worktree
   * This removes files physically but git doesn't see them as deleted
   *
   * Always includes: .agentmine/memory/** (for Worker access to Memory Bank)
   * Always excludes: .agentmine/agents/**, .agentmine/config.yaml, .agentmine/prompts/**
   */
  private applySparseCheckout(
    worktreePath: string,
    excludePatterns: string[],
    result: ApplyScopeResult
  ): void {
    try {
      // Initialize sparse-checkout in no-cone mode
      execSync('git sparse-checkout init --no-cone', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      // Build sparse-checkout patterns
      // Order matters: includes first, then excludes, then specific includes again
      const patterns = [
        '/*',                       // Include all top-level files
        '/**/*',                    // Include all nested files
      ]

      // Add user-defined exclude patterns
      for (const pattern of excludePatterns) {
        patterns.push(`!${pattern}`)
      }

      // Always exclude sensitive .agentmine subdirectories
      // (Worker should not access agent definitions, config, or prompts directly)
      patterns.push('!.agentmine/agents/**')
      patterns.push('!.agentmine/config.yaml')
      patterns.push('!.agentmine/prompts/**')
      patterns.push('!.agentmine/db/**')

      // Always include Memory Bank (Worker needs access to read project decisions)
      // This comes after excludes to override any .agentmine/** exclude
      patterns.push('.agentmine/memory/**')

      // Set sparse-checkout patterns
      execSync(`git sparse-checkout set ${patterns.map(p => `'${p}'`).join(' ')}`, {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      // Build combined exclude patterns for counting
      const allExcludePatterns = [
        ...excludePatterns,
        '.agentmine/agents/**',
        '.agentmine/config.yaml',
        '.agentmine/prompts/**',
        '.agentmine/db/**',
      ]

      // Count excluded files (files that no longer exist)
      const allFilesBeforeSparse = this.getAllTrackedFiles(worktreePath)
      for (const filePath of allFilesBeforeSparse) {
        const relativePath = relative(worktreePath, filePath)

        // Skip files in memory directory (always included)
        if (relativePath.startsWith('.agentmine/memory/')) {
          continue
        }

        const shouldExclude = allExcludePatterns.some(pattern =>
          minimatch(relativePath, pattern, { dot: true })
        )
        if (shouldExclude) {
          result.deletedCount++
          result.deletedFiles.push(relativePath)
        }
      }
    } catch (error) {
      // If sparse-checkout fails, fall back to manual deletion (with warning)
      console.warn(`Warning: sparse-checkout failed, excluded files may appear as deleted in git`)
      this.manualExclude(worktreePath, excludePatterns, result)
    }
  }

  /**
   * Fallback: manually delete excluded files (may show as deleted in git)
   * Also excludes .agentmine subdirectories except memory
   */
  private manualExclude(
    worktreePath: string,
    excludePatterns: string[],
    result: ApplyScopeResult
  ): void {
    const allFiles = this.getAllFiles(worktreePath)

    // Build combined exclude patterns
    const allExcludePatterns = [
      ...excludePatterns,
      '.agentmine/agents/**',
      '.agentmine/config.yaml',
      '.agentmine/prompts/**',
      '.agentmine/db/**',
    ]

    for (const filePath of allFiles) {
      const relativePath = relative(worktreePath, filePath)

      // Skip .git directory
      if (relativePath.startsWith('.git/') || relativePath === '.git') {
        continue
      }

      // Always preserve Memory Bank files
      if (relativePath.startsWith('.agentmine/memory/')) {
        continue
      }

      const shouldExclude = allExcludePatterns.some(pattern =>
        minimatch(relativePath, pattern, { dot: true })
      )

      if (shouldExclude) {
        try {
          unlinkSync(filePath)
          result.deletedCount++
          result.deletedFiles.push(relativePath)
        } catch {
          // Ignore deletion errors
        }
      }
    }

    this.removeEmptyDirectories(worktreePath)
  }

  /**
   * Get all tracked files in git
   */
  private getAllTrackedFiles(worktreePath: string): string[] {
    try {
      const output = execSync('git ls-files', {
        cwd: worktreePath,
        encoding: 'utf-8',
      })
      return output.trim().split('\n').filter(Boolean).map(f => join(worktreePath, f))
    } catch {
      return []
    }
  }

  /**
   * Get all files recursively in a directory
   */
  private getAllFiles(dir: string): string[] {
    const files: string[] = []

    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        // Skip .git directory
        if (entry.name === '.git') continue
        files.push(...this.getAllFiles(fullPath))
      } else if (entry.isFile()) {
        files.push(fullPath)
      }
    }

    return files
  }

  /**
   * Remove empty directories recursively
   */
  private removeEmptyDirectories(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.git') {
        const fullPath = join(dir, entry.name)
        this.removeEmptyDirectories(fullPath)

        // Check if directory is now empty
        try {
          const remaining = readdirSync(fullPath)
          if (remaining.length === 0) {
            rmSync(fullPath, { recursive: true })
          }
        } catch {
          // Ignore errors
        }
      }
    }
  }
}
