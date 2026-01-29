import { eq, and, desc, asc, isNull, sql, ne, notInArray, inArray } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import {
  tasks,
  taskDependencies,
  type Task,
  type NewTask,
  type TaskStatus,
  type TaskPriority,
  type TaskType,
  type AssigneeType,
  type TaskDependency,
} from '../db/schema.js'
import { TaskNotFoundError, CircularDependencyError, TaskDependencyError } from '../errors.js'

// Re-export errors for convenience
export { TaskNotFoundError, CircularDependencyError, TaskDependencyError } from '../errors.js'

// ============================================
// Types
// ============================================

export interface TaskFilters {
  status?: TaskStatus
  priority?: TaskPriority
  type?: TaskType
  assigneeType?: AssigneeType
  assigneeName?: string
  parentId?: number | null
  unassigned?: boolean
  limit?: number
  offset?: number
}

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: TaskPriority
  type?: TaskType
  assigneeType?: AssigneeType
  assigneeName?: string
  parentId?: number
  projectId?: number
  complexity?: number
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  type?: TaskType
  assigneeType?: AssigneeType | null
  assigneeName?: string | null
  parentId?: number | null
  selectedSessionId?: number | null
  labels?: string[]
  complexity?: number | null
}

// ============================================
// TaskService
// ============================================

export class TaskService {
  constructor(private db: Db) {}

  /**
   * Create a new task
   */
  async create(input: CreateTaskInput): Promise<Task> {
    // Validate parent exists if specified
    if (input.parentId) {
      const parent = await this.findById(input.parentId)
      if (!parent) {
        throw new TaskNotFoundError(input.parentId)
      }
    }

    const [task] = await this.db
      .insert(tasks)
      .values({
        title: input.title,
        description: input.description,
        priority: input.priority ?? 'medium',
        type: input.type ?? 'task',
        assigneeType: input.assigneeType,
        assigneeName: input.assigneeName,
        parentId: input.parentId,
        projectId: input.projectId,
        complexity: input.complexity,
      })
      .returning()

    return task
  }

  /**
   * Find a task by ID
   */
  async findById(id: number): Promise<Task | null> {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1)

    return task ?? null
  }

  /**
   * Find all tasks with optional filters
   */
  async findAll(filters: TaskFilters = {}): Promise<Task[]> {
    const conditions = []

    if (filters.status) {
      conditions.push(eq(tasks.status, filters.status))
    }

    if (filters.priority) {
      conditions.push(eq(tasks.priority, filters.priority))
    }

    if (filters.type) {
      conditions.push(eq(tasks.type, filters.type))
    }

    if (filters.assigneeType) {
      conditions.push(eq(tasks.assigneeType, filters.assigneeType))
    }

    if (filters.assigneeName) {
      conditions.push(eq(tasks.assigneeName, filters.assigneeName))
    }

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        conditions.push(isNull(tasks.parentId))
      } else {
        conditions.push(eq(tasks.parentId, filters.parentId))
      }
    }

    if (filters.unassigned) {
      conditions.push(isNull(tasks.assigneeType))
    }

    let query = this.db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.createdAt))

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
   * Update a task
   */
  async update(id: number, input: UpdateTaskInput): Promise<Task> {
    // Check task exists
    const existing = await this.findById(id)
    if (!existing) {
      throw new TaskNotFoundError(id)
    }

    // Validate parent if being changed
    if (input.parentId !== undefined && input.parentId !== null) {
      // Check parent exists
      const parent = await this.findById(input.parentId)
      if (!parent) {
        throw new TaskNotFoundError(input.parentId)
      }

      // Check for circular dependency
      if (await this.wouldCreateCycle(id, input.parentId)) {
        throw new CircularDependencyError(id, input.parentId)
      }
    }

    const [task] = await this.db
      .update(tasks)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning()

    // Propagate status changes upward
    if (input.status && input.status !== existing.status) {
      await this.propagateStatus(id, input.status)
    }

    return task
  }

  /**
   * Delete a task
   */
  async delete(id: number): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new TaskNotFoundError(id)
    }

    await this.db.delete(tasks).where(eq(tasks.id, id))
  }

  /**
   * Get subtasks of a task
   */
  async getSubtasks(parentId: number): Promise<Task[]> {
    return this.findAll({ parentId })
  }

  /**
   * Count tasks by status
   */
  async countByStatus(): Promise<Record<TaskStatus, number>> {
    const results = await this.db
      .select({
        status: tasks.status,
        count: sql<number>`count(*)`,
      })
      .from(tasks)
      .groupBy(tasks.status)

    const counts: Record<TaskStatus, number> = {
      open: 0,
      in_progress: 0,
      done: 0,
      failed: 0,
      dod_failed: 0,
      cancelled: 0,
    }

    for (const row of results) {
      counts[row.status as TaskStatus] = Number(row.count)
    }

    return counts
  }

  /**
   * Select a session as the winner for this task
   */
  async selectSession(taskId: number, sessionId: number): Promise<Task> {
    const existing = await this.findById(taskId)
    if (!existing) {
      throw new TaskNotFoundError(taskId)
    }

    return this.update(taskId, {
      selectedSessionId: sessionId,
      status: 'done',
    })
  }

  // ============================================
  // Dependency management
  // ============================================

  /**
   * Add a dependency (taskId is blocked by dependsOnTaskId)
   * Includes circular dependency detection via BFS
   */
  async addDependency(taskId: number, dependsOnTaskId: number): Promise<void> {
    if (taskId === dependsOnTaskId) {
      throw new TaskDependencyError(taskId, dependsOnTaskId, 'a task cannot depend on itself')
    }

    // Verify both tasks exist
    const task = await this.findById(taskId)
    if (!task) throw new TaskNotFoundError(taskId)
    const depTask = await this.findById(dependsOnTaskId)
    if (!depTask) throw new TaskNotFoundError(dependsOnTaskId)

    // BFS cycle detection: check if dependsOnTaskId is (transitively) blocked by taskId
    if (await this.wouldCreateDependencyCycle(taskId, dependsOnTaskId)) {
      throw new TaskDependencyError(taskId, dependsOnTaskId, 'would create a circular dependency')
    }

    await this.db
      .insert(taskDependencies)
      .values({ taskId, dependsOnTaskId })
  }

  /**
   * Remove a dependency
   */
  async removeDependency(taskId: number, dependsOnTaskId: number): Promise<void> {
    await this.db
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.taskId, taskId),
          eq(taskDependencies.dependsOnTaskId, dependsOnTaskId),
        ),
      )
  }

  /**
   * Get tasks that this task depends on (blockedBy)
   */
  async getDependencies(taskId: number): Promise<Task[]> {
    const deps = await this.db
      .select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, taskId))

    if (deps.length === 0) return []

    const ids = deps.map(d => d.dependsOnTaskId)
    return this.db
      .select()
      .from(tasks)
      .where(inArray(tasks.id, ids))
  }

  /**
   * Get tasks that depend on this task (blocks)
   */
  async getDependents(taskId: number): Promise<Task[]> {
    const deps = await this.db
      .select({ taskId: taskDependencies.taskId })
      .from(taskDependencies)
      .where(eq(taskDependencies.dependsOnTaskId, taskId))

    if (deps.length === 0) return []

    const ids = deps.map(d => d.taskId)
    return this.db
      .select()
      .from(tasks)
      .where(inArray(tasks.id, ids))
  }

  /**
   * Check if a task has unfinished dependencies (is blocked)
   */
  async isBlocked(taskId: number): Promise<boolean> {
    const deps = await this.getDependencies(taskId)
    return deps.some(d => d.status !== 'done')
  }

  // ============================================
  // Task selection (next)
  // ============================================

  /**
   * Find the next available task: open, not blocked, ordered by priority desc then createdAt asc
   */
  async findNext(options?: { agentName?: string }): Promise<Task | null> {
    // Get all open tasks
    const openTasks = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, 'open'))

    if (openTasks.length === 0) return null

    // Priority ordering
    const priorityOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    }

    // Filter out blocked tasks and sort
    const candidates: Task[] = []
    for (const task of openTasks) {
      const blocked = await this.isBlocked(task.id)
      if (!blocked) {
        candidates.push(task)
      }
    }

    if (candidates.length === 0) return null

    candidates.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 0
      const pb = priorityOrder[b.priority] ?? 0
      if (pb !== pa) return pb - pa
      // Earlier createdAt first
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return ta - tb
    })

    return candidates[0]
  }

  // ============================================
  // Status propagation
  // ============================================

  /**
   * Propagate status changes upward to parent tasks
   * - Child becomes in_progress → parent becomes in_progress (if open)
   * - All children done → parent becomes done (recursive upward)
   */
  private async propagateStatus(taskId: number, newStatus: TaskStatus): Promise<void> {
    const task = await this.findById(taskId)
    if (!task || !task.parentId) return

    const parent = await this.findById(task.parentId)
    if (!parent) return

    if (newStatus === 'in_progress' && parent.status === 'open') {
      await this.db
        .update(tasks)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(tasks.id, parent.id))
      // Continue propagation upward
      await this.propagateStatus(parent.id, 'in_progress')
    } else if (newStatus === 'done') {
      // Check if all siblings are done
      const siblings = await this.getSubtasks(parent.id)
      const allDone = siblings.every(s => s.id === taskId ? true : s.status === 'done')
      if (allDone) {
        await this.db
          .update(tasks)
          .set({ status: 'done', updatedAt: new Date() })
          .where(eq(tasks.id, parent.id))
        // Continue propagation upward
        await this.propagateStatus(parent.id, 'done')
      }
    }
  }

  // ============================================
  // Cycle detection
  // ============================================

  /**
   * Check if adding taskId→dependsOnTaskId would create a cycle
   * BFS from dependsOnTaskId: if we can reach taskId, it's a cycle
   */
  private async wouldCreateDependencyCycle(taskId: number, dependsOnTaskId: number): Promise<boolean> {
    const visited = new Set<number>()
    const queue = [dependsOnTaskId]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === taskId) return true
      if (visited.has(current)) continue
      visited.add(current)

      const deps = await this.db
        .select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
        .from(taskDependencies)
        .where(eq(taskDependencies.taskId, current))

      for (const dep of deps) {
        queue.push(dep.dependsOnTaskId)
      }
    }

    return false
  }

  /**
   * Check if setting a parent would create a circular dependency
   */
  private async wouldCreateCycle(taskId: number, parentId: number): Promise<boolean> {
    // If trying to set itself as parent
    if (taskId === parentId) {
      return true
    }

    // Traverse up the parent chain
    let currentId: number | null = parentId
    const visited = new Set<number>()

    while (currentId !== null) {
      if (currentId === taskId || visited.has(currentId)) {
        return true
      }

      visited.add(currentId)

      const [parent] = await this.db
        .select({ parentId: tasks.parentId })
        .from(tasks)
        .where(eq(tasks.id, currentId))
        .limit(1)

      currentId = parent?.parentId ?? null
    }

    return false
  }
}
