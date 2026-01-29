import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import {
  auditLogs,
  type AuditLog,
  type NewAuditLog,
  type AuditAction,
  type EntityType,
  type AuditLogChanges,
} from '../db/schema.js'

// ============================================
// Types
// ============================================

export interface AuditLogFilters {
  projectId?: number
  userId?: string
  action?: AuditAction
  entityType?: EntityType
  entityId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export interface LogAuditInput {
  projectId?: number
  userId: string
  action: AuditAction
  entityType: EntityType
  entityId: string | number
  changes?: AuditLogChanges
}

// ============================================
// AuditLogService
// ============================================

/**
 * Audit log service - records all significant operations
 * Used for tracking changes to tasks, agents, memories, sessions, and settings
 */
export class AuditLogService {
  constructor(private db: Db) {}

  /**
   * Log an audit event
   */
  async log(input: LogAuditInput): Promise<AuditLog> {
    const [log] = await this.db
      .insert(auditLogs)
      .values({
        projectId: input.projectId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: String(input.entityId),
        changes: input.changes ?? {},
      })
      .returning()

    return log
  }

  /**
   * Convenience method: log a create action
   */
  async logCreate(
    userId: string,
    entityType: EntityType,
    entityId: string | number,
    data: Record<string, unknown>,
    projectId?: number
  ): Promise<AuditLog> {
    return this.log({
      projectId,
      userId,
      action: 'create',
      entityType,
      entityId,
      changes: { after: data },
    })
  }

  /**
   * Convenience method: log an update action
   */
  async logUpdate(
    userId: string,
    entityType: EntityType,
    entityId: string | number,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    projectId?: number
  ): Promise<AuditLog> {
    return this.log({
      projectId,
      userId,
      action: 'update',
      entityType,
      entityId,
      changes: { before, after },
    })
  }

  /**
   * Convenience method: log a delete action
   */
  async logDelete(
    userId: string,
    entityType: EntityType,
    entityId: string | number,
    data: Record<string, unknown>,
    projectId?: number
  ): Promise<AuditLog> {
    return this.log({
      projectId,
      userId,
      action: 'delete',
      entityType,
      entityId,
      changes: { before: data },
    })
  }

  /**
   * Convenience method: log a start action (for sessions)
   */
  async logStart(
    userId: string,
    entityType: EntityType,
    entityId: string | number,
    data: Record<string, unknown>,
    projectId?: number
  ): Promise<AuditLog> {
    return this.log({
      projectId,
      userId,
      action: 'start',
      entityType,
      entityId,
      changes: { after: data },
    })
  }

  /**
   * Convenience method: log a stop action (for sessions)
   */
  async logStop(
    userId: string,
    entityType: EntityType,
    entityId: string | number,
    data: Record<string, unknown>,
    projectId?: number
  ): Promise<AuditLog> {
    return this.log({
      projectId,
      userId,
      action: 'stop',
      entityType,
      entityId,
      changes: { after: data },
    })
  }

  /**
   * Find audit logs by ID
   */
  async findById(id: number): Promise<AuditLog | null> {
    const [log] = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
      .limit(1)

    return log ?? null
  }

  /**
   * Find all audit logs with optional filters
   */
  async findAll(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
    const conditions = []

    if (filters.projectId !== undefined) {
      conditions.push(eq(auditLogs.projectId, filters.projectId))
    }

    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId))
    }

    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action))
    }

    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType))
    }

    if (filters.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId))
    }

    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate))
    }

    if (filters.endDate) {
      conditions.push(lte(auditLogs.createdAt, filters.endDate))
    }

    let query = this.db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query
    }

    if (filters.limit) {
      query = query.limit(filters.limit) as typeof query
    }

    if (filters.offset) {
      query = query.offset(filters.offset) as typeof query
    }

    return query
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityHistory(entityType: EntityType, entityId: string | number): Promise<AuditLog[]> {
    return this.findAll({
      entityType,
      entityId: String(entityId),
    })
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserActivity(userId: string, limit: number = 50): Promise<AuditLog[]> {
    return this.findAll({
      userId,
      limit,
    })
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 50, projectId?: number): Promise<AuditLog[]> {
    return this.findAll({
      projectId,
      limit,
    })
  }

  /**
   * Count logs by action type
   */
  async countByAction(projectId?: number): Promise<Record<AuditAction, number>> {
    const conditions = projectId !== undefined
      ? [eq(auditLogs.projectId, projectId)]
      : []

    let query = this.db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .groupBy(auditLogs.action)

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query
    }

    const results = await query

    const counts: Record<AuditAction, number> = {
      create: 0,
      update: 0,
      delete: 0,
      start: 0,
      stop: 0,
      export: 0,
    }

    for (const row of results) {
      counts[row.action as AuditAction] = Number(row.count)
    }

    return counts
  }

  /**
   * Delete old audit logs (for retention)
   */
  async deleteOlderThan(days: number, projectId?: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const conditions = [lte(auditLogs.createdAt, cutoffDate)]
    if (projectId !== undefined) {
      conditions.push(eq(auditLogs.projectId, projectId))
    }

    const result = await this.db
      .delete(auditLogs)
      .where(and(...conditions))

    return result.rowsAffected ?? 0
  }
}
