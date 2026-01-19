import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync, mkdirSync, statSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { AGENTMINE_DIR } from '../db/index.js'

// ============================================
// Types
// ============================================

export interface MemoryEntry {
  /** File path relative to memory directory */
  path: string
  /** Category derived from subdirectory or filename */
  category: string
  /** Title derived from filename */
  title: string
  /** File content */
  content: string
  /** Last modified timestamp */
  updatedAt: Date
}

export interface CreateMemoryInput {
  /** File path (e.g., "decisions/architecture.md") */
  path: string
  /** Content to write */
  content: string
}

export interface UpdateMemoryInput {
  /** New content */
  content: string
}

export interface MemoryFilters {
  category?: string
}

// ============================================
// Errors
// ============================================

export class MemoryNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`Memory file "${path}" not found`)
    this.name = 'MemoryNotFoundError'
  }
}

export class MemoryAlreadyExistsError extends Error {
  constructor(public readonly path: string) {
    super(`Memory file "${path}" already exists`)
    this.name = 'MemoryAlreadyExistsError'
  }
}

// ============================================
// MemoryService
// ============================================

export class MemoryService {
  private memoryDir: string

  constructor(projectRoot: string = process.cwd()) {
    this.memoryDir = join(projectRoot, AGENTMINE_DIR, 'memory')
  }

  /**
   * Get the memory directory path
   */
  getMemoryDir(): string {
    return this.memoryDir
  }

  /**
   * Check if memory directory exists
   */
  isInitialized(): boolean {
    return existsSync(this.memoryDir)
  }

  /**
   * Ensure memory directory exists
   */
  ensureDir(): void {
    if (!this.isInitialized()) {
      mkdirSync(this.memoryDir, { recursive: true })
    }
  }

  /**
   * List all memory entries
   */
  list(filters: MemoryFilters = {}): MemoryEntry[] {
    if (!this.isInitialized()) {
      return []
    }

    const entries: MemoryEntry[] = []
    this.scanDirectory(this.memoryDir, '', entries)

    if (filters.category) {
      return entries.filter(e => e.category === filters.category)
    }

    return entries
  }

  /**
   * Get a memory entry by path
   */
  get(path: string): MemoryEntry | null {
    const fullPath = join(this.memoryDir, path)

    if (!existsSync(fullPath)) {
      return null
    }

    return this.readEntry(path, fullPath)
  }

  /**
   * Create a new memory entry
   */
  create(input: CreateMemoryInput): MemoryEntry {
    this.ensureDir()

    const fullPath = join(this.memoryDir, input.path)

    if (existsSync(fullPath)) {
      throw new MemoryAlreadyExistsError(input.path)
    }

    // Ensure parent directory exists
    const parentDir = join(fullPath, '..')
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true })
    }

    writeFileSync(fullPath, input.content, 'utf-8')
    return this.readEntry(input.path, fullPath)
  }

  /**
   * Update a memory entry
   */
  update(path: string, input: UpdateMemoryInput): MemoryEntry {
    const fullPath = join(this.memoryDir, path)

    if (!existsSync(fullPath)) {
      throw new MemoryNotFoundError(path)
    }

    writeFileSync(fullPath, input.content, 'utf-8')
    return this.readEntry(path, fullPath)
  }

  /**
   * Delete a memory entry
   */
  delete(path: string): void {
    const fullPath = join(this.memoryDir, path)

    if (!existsSync(fullPath)) {
      throw new MemoryNotFoundError(path)
    }

    unlinkSync(fullPath)
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    if (!this.isInitialized()) {
      return []
    }

    const categories = new Set<string>()
    const entries = readdirSync(this.memoryDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        categories.add(entry.name)
      } else if (entry.isFile() && this.isMemoryFile(entry.name)) {
        categories.add('general')
      }
    }

    return Array.from(categories).sort()
  }

  /**
   * Generate preview for AI consumption
   * Returns formatted content of all memory entries
   */
  preview(): string {
    const entries = this.list()

    if (entries.length === 0) {
      return '# Memory Bank\n\nNo entries found.'
    }

    const parts: string[] = ['# Memory Bank', '']

    // Group by category
    const byCategory = new Map<string, MemoryEntry[]>()
    for (const entry of entries) {
      const cat = entry.category
      if (!byCategory.has(cat)) {
        byCategory.set(cat, [])
      }
      byCategory.get(cat)!.push(entry)
    }

    // Output each category
    for (const [category, categoryEntries] of byCategory) {
      parts.push(`## ${this.capitalizeFirst(category)}`)
      parts.push('')

      for (const entry of categoryEntries) {
        parts.push(`### ${entry.title}`)
        parts.push('')
        parts.push(entry.content.trim())
        parts.push('')
      }
    }

    return parts.join('\n')
  }

  /**
   * Generate compact preview (titles and first lines only)
   */
  previewCompact(): string {
    const entries = this.list()

    if (entries.length === 0) {
      return 'No memory entries.'
    }

    const lines: string[] = []

    for (const entry of entries) {
      const firstLine = entry.content.split('\n')[0]?.trim() || '(empty)'
      lines.push(`- **${entry.title}** (${entry.category}): ${firstLine}`)
    }

    return lines.join('\n')
  }

  // ============================================
  // Private methods
  // ============================================

  private scanDirectory(dir: string, relativePath: string, entries: MemoryEntry[]): void {
    const items = readdirSync(dir, { withFileTypes: true })

    for (const item of items) {
      const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name
      const itemFullPath = join(dir, item.name)

      if (item.isDirectory()) {
        this.scanDirectory(itemFullPath, itemRelativePath, entries)
      } else if (item.isFile() && this.isMemoryFile(item.name)) {
        entries.push(this.readEntry(itemRelativePath, itemFullPath))
      }
    }
  }

  private readEntry(path: string, fullPath: string): MemoryEntry {
    const content = readFileSync(fullPath, 'utf-8')
    const stats = statSync(fullPath)

    // Extract category from path
    const pathParts = path.split('/')
    const category = pathParts.length > 1 ? pathParts[0] : 'general'

    // Extract title from filename
    const filename = basename(path)
    const title = this.filenameToTitle(filename)

    return {
      path,
      category,
      title,
      content,
      updatedAt: stats.mtime,
    }
  }

  private isMemoryFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase()
    return ['.md', '.txt', '.yaml', '.yml', '.json'].includes(ext)
  }

  private filenameToTitle(filename: string): string {
    // Remove extension
    const name = basename(filename, extname(filename))
    // Convert kebab-case or snake_case to Title Case
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}
