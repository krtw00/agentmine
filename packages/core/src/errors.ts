// ============================================
// Base Error
// ============================================

export class AgentmineError extends Error {
  constructor(
    message: string,
    public code: number,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AgentmineError'
  }
}

// ============================================
// Task Errors
// ============================================

export class TaskNotFoundError extends AgentmineError {
  constructor(public readonly taskId: number) {
    super(`Task #${taskId} not found`, 5, { taskId })
    this.name = 'TaskNotFoundError'
  }
}

export class CircularDependencyError extends AgentmineError {
  constructor(taskId: number, parentId: number) {
    super(
      `Setting task #${parentId} as parent of task #${taskId} would create a circular dependency`,
      6,
      { taskId, parentId }
    )
    this.name = 'CircularDependencyError'
  }
}

export class TaskDependencyError extends AgentmineError {
  constructor(taskId: number, dependsOnTaskId: number, reason: string) {
    super(
      `Cannot add dependency: task #${taskId} depends on #${dependsOnTaskId} - ${reason}`,
      6,
      { taskId, dependsOnTaskId }
    )
    this.name = 'TaskDependencyError'
  }
}

// ============================================
// Session Errors
// ============================================

export class SessionNotFoundError extends AgentmineError {
  constructor(public readonly sessionId: number) {
    super(`Session #${sessionId} not found`, 5, { sessionId })
    this.name = 'SessionNotFoundError'
  }
}

export class SessionAlreadyExistsError extends AgentmineError {
  constructor(public readonly taskId: number) {
    super(`Task #${taskId} already has a session (1 task = 1 session constraint)`, 6, { taskId })
    this.name = 'SessionAlreadyExistsError'
  }
}

export class SessionAlreadyEndedError extends AgentmineError {
  constructor(public readonly sessionId: number) {
    super(`Session #${sessionId} has already ended`, 6, { sessionId })
    this.name = 'SessionAlreadyEndedError'
  }
}

export class IdempotencyKeyConflictError extends AgentmineError {
  constructor(public readonly idempotencyKey: string) {
    super(`Session with idempotency key "${idempotencyKey}" already exists`, 6, { idempotencyKey })
    this.name = 'IdempotencyKeyConflictError'
  }
}

// ============================================
// Agent Errors
// ============================================

export class AgentNotFoundError extends AgentmineError {
  constructor(public readonly agentName: string) {
    super(`Agent "${agentName}" not found`, 5, { agentName })
    this.name = 'AgentNotFoundError'
  }
}

export class AgentAlreadyExistsError extends AgentmineError {
  constructor(public readonly agentName: string) {
    super(`Agent "${agentName}" already exists`, 6, { agentName })
    this.name = 'AgentAlreadyExistsError'
  }
}

export class InvalidAgentDefinitionError extends AgentmineError {
  constructor(public readonly agentName: string, public readonly reason: string) {
    super(`Invalid agent definition for "${agentName}": ${reason}`, 2, { agentName, reason })
    this.name = 'InvalidAgentDefinitionError'
  }
}
