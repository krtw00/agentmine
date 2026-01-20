import { eq, and, like, inArray } from 'drizzle-orm'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from '../db/index.js'
import {
  memories,
  type Memory,
  type NewMemory,
  type MemoryStatus,
} from '../db/schema.js'

// ============================================
// Types
// ============================================

export interface CreateMemoryInput {
  category: string
  title: string
  content: string
  summary?: string
  status?: MemoryStatus
  tags?: string[]
  relatedTaskId?: number
  projectId?: number
  createdBy?: string
}

export interface UpdateMemoryInput {
  category?: string
  title?: string
  content?: string
  summary?: string
  status?: MemoryStatus
  tags?: string[]
  relatedTaskId?: number
}

export interface MemoryFilters {
  projectId?: number
  category?: string
  status?: MemoryStatus
  tags?: string[]
}

export interface MemoryFileInfo {
  id: number
  category: string
  title: string
  summary?: string
}

// ============================================
// Errors
// ============================================

export class MemoryNotFoundError extends Error {
  constructor(public readonly id: number) {
    super(`Memory "${id}" not found`)
    this.name = 'MemoryNotFoundError'
  }
}

export class MemoryAlreadyExistsError extends Error {
  constructor(public readonly title: string, public readonly category: string) {
    super(`Memory "${title}" in category "${category}" already exists`)
    this.name = 'MemoryAlreadyExistsError'
  }
}

// ============================================
// MemoryService (DB-based)
// ============================================

export class MemoryService {
  constructor(private db: Db) {}

  /**
   * List all memories with optional filters
   */
  async list(filters: MemoryFilters = {}): Promise<Memory[]> {
    let query = this.db.select().from(memories)

    const conditions = []

    if (filters.projectId !== undefined) {
      conditions.push(eq(memories.projectId, filters.projectId))
    }
    if (filters.category) {
      conditions.push(eq(memories.category, filters.category))
    }
    if (filters.status) {
      conditions.push(eq(memories.status, filters.status))
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query
    }

    const results = await query

    // Filter by tags if specified (post-query filter since JSON)
    if (filters.tags && filters.tags.length > 0) {
      return results.filter(memory => {
        const memoryTags = memory.tags as string[] | null
        if (!memoryTags) return false
        return filters.tags!.some(tag => memoryTags.includes(tag))
      })
    }

    return results
  }

  /**
   * Get a memory by ID
   */
  async get(id: number): Promise<Memory | null> {
    const results = await this.db
      .select()
      .from(memories)
      .where(eq(memories.id, id))
      .limit(1)
    return results[0] ?? null
  }

  /**
   * Find memory by title and category
   */
  async findByTitleAndCategory(title: string, category: string, projectId?: number): Promise<Memory | null> {
    const conditions = projectId !== undefined
      ? and(eq(memories.title, title), eq(memories.category, category), eq(memories.projectId, projectId))
      : and(eq(memories.title, title), eq(memories.category, category))

    const results = await this.db
      .select()
      .from(memories)
      .where(conditions)
      .limit(1)
    return results[0] ?? null
  }

  /**
   * Create a new memory
   */
  async create(input: CreateMemoryInput): Promise<Memory> {
    const newMemory: NewMemory = {
      category: input.category,
      title: input.title,
      content: input.content,
      summary: input.summary,
      status: input.status ?? 'active',
      tags: input.tags ?? [],
      relatedTaskId: input.relatedTaskId,
      projectId: input.projectId,
      createdBy: input.createdBy,
    }

    const results = await this.db
      .insert(memories)
      .values(newMemory)
      .returning()

    return results[0]
  }

  /**
   * Update a memory
   */
  async update(id: number, input: UpdateMemoryInput): Promise<Memory> {
    const existing = await this.get(id)
    if (!existing) {
      throw new MemoryNotFoundError(id)
    }

    const results = await this.db
      .update(memories)
      .set({
        category: input.category ?? existing.category,
        title: input.title ?? existing.title,
        content: input.content ?? existing.content,
        summary: input.summary ?? existing.summary,
        status: input.status ?? existing.status,
        tags: input.tags ?? existing.tags,
        relatedTaskId: input.relatedTaskId ?? existing.relatedTaskId,
        updatedAt: new Date(),
      })
      .where(eq(memories.id, id))
      .returning()

    return results[0]
  }

  /**
   * Delete a memory
   */
  async delete(id: number): Promise<void> {
    const existing = await this.get(id)
    if (!existing) {
      throw new MemoryNotFoundError(id)
    }

    await this.db.delete(memories).where(eq(memories.id, id))
  }

  /**
   * Archive a memory
   */
  async archive(id: number): Promise<Memory> {
    return this.update(id, { status: 'archived' })
  }

  /**
   * Get all categories
   */
  async getCategories(projectId?: number): Promise<string[]> {
    const allMemories = await this.list({ projectId })
    const categories = new Set<string>()
    for (const memory of allMemories) {
      categories.add(memory.category)
    }
    return Array.from(categories).sort()
  }

  /**
   * Generate preview for AI consumption
   * Returns formatted content of all active memories
   */
  async preview(filters: MemoryFilters = {}): Promise<string> {
    const activeFilters = { ...filters, status: 'active' as MemoryStatus }
    const memoryList = await this.list(activeFilters)

    if (memoryList.length === 0) {
      return '# Memory Bank\n\nNo entries found.'
    }

    const parts: string[] = ['# Memory Bank', '']

    // Group by category
    const byCategory = new Map<string, Memory[]>()
    for (const memory of memoryList) {
      const cat = memory.category
      if (!byCategory.has(cat)) {
        byCategory.set(cat, [])
      }
      byCategory.get(cat)!.push(memory)
    }

    // Output each category
    for (const [category, categoryMemories] of byCategory) {
      parts.push(`## ${this.capitalizeFirst(category)}`)
      parts.push('')

      for (const memory of categoryMemories) {
        parts.push(`### ${memory.title}`)
        parts.push('')
        parts.push(memory.content.trim())
        parts.push('')
      }
    }

    return parts.join('\n')
  }

  /**
   * Generate compact preview (titles and summaries only)
   */
  async previewCompact(filters: MemoryFilters = {}): Promise<string> {
    const activeFilters = { ...filters, status: 'active' as MemoryStatus }
    const memoryList = await this.list(activeFilters)

    if (memoryList.length === 0) {
      return 'No memory entries.'
    }

    const lines: string[] = []

    for (const memory of memoryList) {
      const summary = memory.summary || memory.content.split('\n')[0]?.trim() || '(empty)'
      lines.push(`- **${memory.title}** (${memory.category}): ${summary}`)
    }

    return lines.join('\n')
  }

  /**
   * List memory file info (for reference-based prompt generation)
   */
  async listFiles(filters: MemoryFilters = {}): Promise<MemoryFileInfo[]> {
    const activeFilters = { ...filters, status: 'active' as MemoryStatus }
    const memoryList = await this.list(activeFilters)

    return memoryList.map(memory => ({
      id: memory.id,
      category: memory.category,
      title: memory.title,
      summary: memory.summary ?? undefined,
    }))
  }

  /**
   * Export memories to file system (for Worker worktree)
   * Used when starting a Worker to provide Memory Bank access
   */
  async exportToFileSystem(outputDir: string, filters: MemoryFilters = {}): Promise<string[]> {
    const activeFilters = { ...filters, status: 'active' as MemoryStatus }
    const memoryList = await this.list(activeFilters)

    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    const exportedFiles: string[] = []

    // Group by category and write files
    const byCategory = new Map<string, Memory[]>()
    for (const memory of memoryList) {
      const cat = memory.category
      if (!byCategory.has(cat)) {
        byCategory.set(cat, [])
      }
      byCategory.get(cat)!.push(memory)
    }

    for (const [category, categoryMemories] of byCategory) {
      const categoryDir = join(outputDir, category)
      if (!existsSync(categoryDir)) {
        mkdirSync(categoryDir, { recursive: true })
      }

      for (const memory of categoryMemories) {
        // Convert title to filename (kebab-case)
        const filename = this.titleToFilename(memory.title) + '.md'
        const filePath = join(categoryDir, filename)

        // Build file content with frontmatter
        const content = this.buildFileContent(memory)
        writeFileSync(filePath, content, 'utf-8')
        exportedFiles.push(join(category, filename))
      }
    }

    return exportedFiles
  }

  // ============================================
  // Private methods
  // ============================================

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  private titleToFilename(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  private buildFileContent(memory: Memory): string {
    const lines: string[] = []

    // Frontmatter
    lines.push('---')
    lines.push(`id: ${memory.id}`)
    lines.push(`title: "${memory.title}"`)
    lines.push(`category: ${memory.category}`)
    if (memory.summary) {
      lines.push(`summary: "${memory.summary}"`)
    }
    if (memory.tags && (memory.tags as string[]).length > 0) {
      lines.push(`tags: [${(memory.tags as string[]).map(t => `"${t}"`).join(', ')}]`)
    }
    lines.push('---')
    lines.push('')

    // Content
    lines.push(memory.content)

    return lines.join('\n')
  }
}
