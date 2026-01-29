import { eq, and, desc, sql } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import {
  sessions,
  tasks,
  type Session,
  type NewSession,
  type SessionStatus,
  type DodResult,
  type ReviewStatus,
  type SessionError,
} from '../db/schema.js'
import {
  TaskNotFoundError,
  SessionNotFoundError,
  SessionAlreadyEndedError,
  IdempotencyKeyConflictError,
} from '../errors.js'

// Re-export errors for convenience
export {
  SessionNotFoundError,
  SessionAlreadyEndedError,
  IdempotencyKeyConflictError,
} from '../errors.js'

// ============================================
// Types
// ============================================

export interface SessionFilters {
  taskId?: number
  agentName?: string
  status?: SessionStatus
  dodResult?: DodResult
  sessionGroupId?: string
  limit?: number
  offset?: number
}

export interface StartSessionInput {
  taskId: number
  agentName: string
  /** Optional session group ID for parallel execution */
  sessionGroupId?: string
  /** Optional idempotency key to prevent duplicate sessions */
  idempotencyKey?: string
  /** Branch name for this session */
  branchName?: string
  /** Worktree path for this session */
  worktreePath?: string
}

export interface EndSessionInput {
  status: 'completed' | 'failed' | 'cancelled'
  exitCode?: number
  signal?: string
  dodResult?: DodResult
  artifacts?: string[]
  error?: SessionError
  prUrl?: string
}

export interface SessionResult {
  session: Session
  durationMs: number
}

export interface ReviewSessionInput {
  status: ReviewStatus
  reviewedBy: string
  comment?: string
}

// ============================================
// SessionService
// ============================================

/**
 * Session service - manages Worker execution sessions
 * Supports 1:N relationship (one task can have multiple sessions for parallel comparison)
 */
export class SessionService {
  constructor(private db: Db) {}

  /**
   * Start a new session for a task
   * Allows multiple sessions per task for parallel execution/comparison
   */
  async start(input: StartSessionInput): Promise<Session> {
    // Check task exists
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
      .limit(1)

    if (!task) {
      throw new TaskNotFoundError(input.taskId)
    }

    // Check idempotency key if provided
    if (input.idempotencyKey) {
      const [existing] = await this.db
        .select()
        .from(sessions)
        .where(eq(sessions.idempotencyKey, input.idempotencyKey))
        .limit(1)

      if (existing) {
        throw new IdempotencyKeyConflictError(input.idempotencyKey)
      }
    }

    // Create session
    const [session] = await this.db
      .insert(sessions)
      .values({
        taskId: input.taskId,
        agentName: input.agentName,
        status: 'running',
        sessionGroupId: input.sessionGroupId,
        idempotencyKey: input.idempotencyKey,
        branchName: input.branchName,
        worktreePath: input.worktreePath,
      })
      .returning()

    // Update task status to in_progress (if not already)
    if (task.status === 'open') {
      await this.db
        .update(tasks)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(tasks.id, input.taskId))
    }

    return session
  }

  /**
   * End a running session
   */
  async end(sessionId: number, input: EndSessionInput): Promise<SessionResult> {
    const existing = await this.findById(sessionId)
    if (!existing) {
      throw new SessionNotFoundError(sessionId)
    }

    if (existing.status !== 'running') {
      throw new SessionAlreadyEndedError(sessionId)
    }

    const completedAt = new Date()
    const startedAt = existing.startedAt ?? new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()

    const [session] = await this.db
      .update(sessions)
      .set({
        status: input.status,
        completedAt,
        durationMs,
        exitCode: input.exitCode,
        signal: input.signal,
        dodResult: input.dodResult,
        artifacts: input.artifacts ?? [],
        error: input.error ?? null,
        prUrl: input.prUrl,
      })
      .where(eq(sessions.id, sessionId))
      .returning()

    return { session, durationMs }
  }

  /**
   * Find a session by ID
   */
  async findById(id: number): Promise<Session | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1)

    return session ?? null
  }

  /**
   * Find all sessions for a task (supports multiple sessions per task)
   */
  async findByTask(taskId: number): Promise<Session[]> {
    return this.db
      .select()
      .from(sessions)
      .where(eq(sessions.taskId, taskId))
      .orderBy(desc(sessions.startedAt))
  }

  /**
   * Find the latest session for a task
   */
  async findLatestByTask(taskId: number): Promise<Session | null> {
    const results = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.taskId, taskId))
      .orderBy(desc(sessions.startedAt))
      .limit(1)

    return results[0] ?? null
  }

  /**
   * Find running sessions for a task
   */
  async findRunningByTask(taskId: number): Promise<Session[]> {
    return this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.taskId, taskId),
          eq(sessions.status, 'running')
        )
      )
  }

  /**
   * Find all sessions with optional filters
   */
  async findAll(filters: SessionFilters = {}): Promise<Session[]> {
    const conditions = []

    if (filters.taskId !== undefined) {
      conditions.push(eq(sessions.taskId, filters.taskId))
    }

    if (filters.agentName) {
      conditions.push(eq(sessions.agentName, filters.agentName))
    }

    if (filters.status) {
      conditions.push(eq(sessions.status, filters.status))
    }

    if (filters.dodResult) {
      conditions.push(eq(sessions.dodResult, filters.dodResult))
    }

    if (filters.sessionGroupId) {
      conditions.push(eq(sessions.sessionGroupId, filters.sessionGroupId))
    }

    let query = this.db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.startedAt))

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
   * Get running sessions
   */
  async findRunning(): Promise<Session[]> {
    return this.findAll({ status: 'running' })
  }

  /**
   * Find sessions in a session group (for parallel comparison)
   */
  async findByGroup(sessionGroupId: string): Promise<Session[]> {
    return this.findAll({ sessionGroupId })
  }

  /**
   * Update DoD result
   */
  async updateDodResult(sessionId: number, dodResult: DodResult): Promise<Session> {
    const existing = await this.findById(sessionId)
    if (!existing) {
      throw new SessionNotFoundError(sessionId)
    }

    const [session] = await this.db
      .update(sessions)
      .set({ dodResult })
      .where(eq(sessions.id, sessionId))
      .returning()

    // Update task status if DoD failed
    if (dodResult === 'failed' && existing.taskId) {
      await this.db
        .update(tasks)
        .set({ status: 'dod_failed', updatedAt: new Date() })
        .where(eq(tasks.id, existing.taskId))
    }

    return session
  }

  /**
   * Add artifacts to a session
   */
  async addArtifacts(sessionId: number, newArtifacts: string[]): Promise<Session> {
    const existing = await this.findById(sessionId)
    if (!existing) {
      throw new SessionNotFoundError(sessionId)
    }

    const artifacts = [...(existing.artifacts ?? []), ...newArtifacts]

    const [session] = await this.db
      .update(sessions)
      .set({ artifacts })
      .where(eq(sessions.id, sessionId))
      .returning()

    return session
  }

  /**
   * Update branch info
   */
  async updateBranchInfo(sessionId: number, branchName: string, prUrl?: string): Promise<Session> {
    const existing = await this.findById(sessionId)
    if (!existing) {
      throw new SessionNotFoundError(sessionId)
    }

    const [session] = await this.db
      .update(sessions)
      .set({
        branchName,
        ...(prUrl && { prUrl }),
      })
      .where(eq(sessions.id, sessionId))
      .returning()

    return session
  }

  /**
   * Count sessions by status
   */
  async countByStatus(): Promise<Record<SessionStatus, number>> {
    const results = await this.db
      .select({
        status: sessions.status,
        count: sql<number>`count(*)`,
      })
      .from(sessions)
      .groupBy(sessions.status)

    const counts: Record<SessionStatus, number> = {
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    }

    for (const row of results) {
      counts[row.status as SessionStatus] = Number(row.count)
    }

    return counts
  }

  /**
   * Delete a session
   */
  async delete(sessionId: number): Promise<void> {
    const existing = await this.findById(sessionId)
    if (!existing) {
      throw new SessionNotFoundError(sessionId)
    }

    await this.db.delete(sessions).where(eq(sessions.id, sessionId))
  }

  /**
   * Get session with task information
   */
  async findByIdWithTask(id: number): Promise<{ session: Session; task: typeof tasks.$inferSelect | null } | null> {
    const session = await this.findById(id)
    if (!session) {
      return null
    }

    let task = null
    if (session.taskId) {
      const [t] = await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, session.taskId))
        .limit(1)
      task = t ?? null
    }

    return { session, task }
  }

  /**
   * Update process information for detached mode
   */
  async updateProcessInfo(sessionId: number, info: { pid?: number; worktreePath?: string }): Promise<Session> {
    const existing = await this.findById(sessionId)
    if (!existing) {
      throw new SessionNotFoundError(sessionId)
    }

    const [session] = await this.db
      .update(sessions)
      .set({
        pid: info.pid,
        worktreePath: info.worktreePath,
      })
      .where(eq(sessions.id, sessionId))
      .returning()

    return session
  }

  /**
   * Find sessions by PID (for process management)
   */
  async findByPid(pid: number): Promise<Session | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.pid, pid))
      .limit(1)

    return session ?? null
  }

  /**
   * Clear process info (when process ends)
   */
  async clearProcessInfo(sessionId: number): Promise<Session> {
    const existing = await this.findById(sessionId)
    if (!existing) {
      throw new SessionNotFoundError(sessionId)
    }

    const [session] = await this.db
      .update(sessions)
      .set({
        pid: null,
      })
      .where(eq(sessions.id, sessionId))
      .returning()

    return session
  }

  /**
   * Record review result for a session
   */
  async review(sessionId: number, input: ReviewSessionInput): Promise<Session> {
    const existing = await this.findById(sessionId)
    if (!existing) {
      throw new SessionNotFoundError(sessionId)
    }

    const [session] = await this.db
      .update(sessions)
      .set({
        reviewStatus: input.status,
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date(),
        reviewComment: input.comment ?? null,
      })
      .where(eq(sessions.id, sessionId))
      .returning()

    return session
  }

  /**
   * Find sessions pending review
   */
  async findPendingReview(): Promise<Session[]> {
    return this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.status, 'completed'),
          eq(sessions.reviewStatus, 'pending')
        )
      )
      .orderBy(desc(sessions.completedAt))
  }

  /**
   * Select a session as the winner for a task (for parallel comparison)
   */
  async selectAsWinner(sessionId: number): Promise<Session> {
    const existing = await this.findById(sessionId)
    if (!existing) {
      throw new SessionNotFoundError(sessionId)
    }

    if (!existing.taskId) {
      throw new Error('Session has no associated task')
    }

    // Update task to reference this session
    await this.db
      .update(tasks)
      .set({
        selectedSessionId: sessionId,
        status: 'done',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, existing.taskId))

    return existing
  }
}
