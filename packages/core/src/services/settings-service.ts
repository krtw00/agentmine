import { eq, and } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import {
  settings,
  type Setting,
  type NewSetting,
} from '../db/schema.js'

// ============================================
// Types
// ============================================

export interface SettingsGroup {
  git: {
    baseBranch: string
    branchPrefix: string
  }
  execution: {
    maxWorkers: number
    worktreeCleanup: boolean
  }
  session: {
    retentionDays: number
  }
}

export type SettingKey = keyof SettingsGroup | string

// Default settings values
const DEFAULT_SETTINGS: Partial<SettingsGroup> = {
  git: {
    baseBranch: 'main',
    branchPrefix: 'task-',
  },
  execution: {
    maxWorkers: 3,
    worktreeCleanup: true,
  },
  session: {
    retentionDays: 30,
  },
}

// ============================================
// Errors
// ============================================

export class SettingNotFoundError extends Error {
  constructor(public readonly key: string) {
    super(`Setting "${key}" not found`)
    this.name = 'SettingNotFoundError'
  }
}

// ============================================
// SettingsService
// ============================================

/**
 * Settings service - manages project configuration in DB
 * Replaces YAML-based config with DB-first approach
 */
export class SettingsService {
  constructor(private db: Db) {}

  /**
   * Get a setting value by key
   * Returns default value if not set
   */
  async get<T = unknown>(key: string, projectId?: number): Promise<T | undefined> {
    const [setting] = await this.db
      .select()
      .from(settings)
      .where(
        projectId !== undefined
          ? and(eq(settings.key, key), eq(settings.projectId, projectId))
          : eq(settings.key, key)
      )
      .limit(1)

    if (setting) {
      try {
        return JSON.parse(setting.value as string) as T
      } catch {
        // If JSON parse fails, return raw value (shouldn't happen with proper set())
        return setting.value as T
      }
    }

    // Return default value if available
    return this.getDefault<T>(key)
  }

  /**
   * Get a setting value, throwing if not found and no default
   */
  async getRequired<T = unknown>(key: string, projectId?: number): Promise<T> {
    const value = await this.get<T>(key, projectId)
    if (value === undefined) {
      throw new SettingNotFoundError(key)
    }
    return value
  }

  /**
   * Set a setting value
   */
  async set<T = unknown>(
    key: string,
    value: T,
    options?: { projectId?: number; updatedBy?: string }
  ): Promise<Setting> {
    const existing = await this.findByKey(key, options?.projectId)

    if (existing) {
      const [updated] = await this.db
        .update(settings)
        .set({
          value: JSON.stringify(value),
          updatedBy: options?.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(settings.id, existing.id))
        .returning()

      return updated
    }

    const [setting] = await this.db
      .insert(settings)
      .values({
        key,
        value: JSON.stringify(value),
        projectId: options?.projectId,
        updatedBy: options?.updatedBy,
      })
      .returning()

    return setting
  }

  /**
   * Delete a setting
   */
  async delete(key: string, projectId?: number): Promise<void> {
    const existing = await this.findByKey(key, projectId)
    if (!existing) {
      throw new SettingNotFoundError(key)
    }

    await this.db.delete(settings).where(eq(settings.id, existing.id))
  }

  /**
   * Get all settings for a project
   */
  async getAllForProject(projectId?: number): Promise<Record<string, unknown>> {
    const allSettings = await this.db
      .select()
      .from(settings)
      .where(
        projectId !== undefined
          ? eq(settings.projectId, projectId)
          : eq(settings.projectId, null as unknown as number)
      )

    const result: Record<string, unknown> = {}
    for (const setting of allSettings) {
      try {
        result[setting.key] = JSON.parse(setting.value as string)
      } catch {
        result[setting.key] = setting.value
      }
    }

    return result
  }

  /**
   * Get all settings as a flat list
   */
  async list(projectId?: number): Promise<Setting[]> {
    if (projectId !== undefined) {
      return this.db
        .select()
        .from(settings)
        .where(eq(settings.projectId, projectId))
    }

    return this.db.select().from(settings)
  }

  /**
   * Initialize default settings for a project
   */
  async initializeDefaults(projectId?: number, updatedBy?: string): Promise<void> {
    for (const [group, values] of Object.entries(DEFAULT_SETTINGS)) {
      if (typeof values === 'object' && values !== null) {
        for (const [key, value] of Object.entries(values)) {
          const fullKey = `${group}.${key}`
          const existing = await this.findByKey(fullKey, projectId)
          if (!existing) {
            await this.set(fullKey, value, { projectId, updatedBy })
          }
        }
      }
    }
  }

  /**
   * Get settings as a structured object (SettingsGroup)
   */
  async getAll(projectId?: number): Promise<Partial<SettingsGroup>> {
    const allSettings = await this.getAllForProject(projectId)
    const result: Partial<SettingsGroup> = {}

    for (const [key, value] of Object.entries(allSettings)) {
      const [group, subKey] = key.split('.')
      if (group && subKey) {
        if (!result[group as keyof SettingsGroup]) {
          (result as Record<string, Record<string, unknown>>)[group] = {}
        }
        (result as Record<string, Record<string, unknown>>)[group][subKey] = value
      }
    }

    // Merge with defaults
    return this.mergeWithDefaults(result)
  }

  // ============================================
  // Private methods
  // ============================================

  private async findByKey(key: string, projectId?: number): Promise<Setting | null> {
    const [setting] = await this.db
      .select()
      .from(settings)
      .where(
        projectId !== undefined
          ? and(eq(settings.key, key), eq(settings.projectId, projectId))
          : eq(settings.key, key)
      )
      .limit(1)

    return setting ?? null
  }

  private getDefault<T>(key: string): T | undefined {
    const [group, subKey] = key.split('.')
    if (group && subKey) {
      const groupDefaults = DEFAULT_SETTINGS[group as keyof typeof DEFAULT_SETTINGS]
      if (groupDefaults && typeof groupDefaults === 'object') {
        return (groupDefaults as Record<string, unknown>)[subKey] as T | undefined
      }
    }
    return undefined
  }

  private mergeWithDefaults(current: Partial<SettingsGroup>): Partial<SettingsGroup> {
    const result = { ...DEFAULT_SETTINGS } as Partial<SettingsGroup>

    for (const [group, values] of Object.entries(current)) {
      if (typeof values === 'object' && values !== null) {
        (result as Record<string, Record<string, unknown>>)[group] = {
          ...(result as Record<string, Record<string, unknown>>)[group],
          ...values,
        }
      }
    }

    return result
  }
}
