import { eq, and } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import {
  agents,
  agentHistory,
  type Agent,
  type NewAgent,
  type AgentScope,
  type AgentConfig,
  type AgentSnapshot,
  type AgentDefinition,
} from '../db/schema.js'
import {
  AgentNotFoundError,
  AgentAlreadyExistsError,
  InvalidAgentDefinitionError,
} from '../errors.js'

// Re-export errors for convenience
export {
  AgentNotFoundError,
  AgentAlreadyExistsError,
  InvalidAgentDefinitionError,
} from '../errors.js'

// ============================================
// Types
// ============================================

export interface CreateAgentInput {
  name: string
  description?: string
  client: string
  model: string
  scope?: Partial<AgentScope>
  config?: AgentConfig
  promptContent?: string
  projectId?: number
  createdBy?: string
}

export interface UpdateAgentInput {
  description?: string
  client?: string
  model?: string
  scope?: Partial<AgentScope>
  config?: AgentConfig
  promptContent?: string
  changedBy?: string
  changeSummary?: string
}

export interface AgentFilters {
  projectId?: number
}

// ============================================
// AgentService (DB-based)
// ============================================

export class AgentService {
  constructor(private db: Db) {}

  /**
   * Find all agents
   */
  async findAll(filters: AgentFilters = {}): Promise<Agent[]> {
    if (filters.projectId !== undefined) {
      return this.db
        .select()
        .from(agents)
        .where(eq(agents.projectId, filters.projectId))
    }
    return this.db.select().from(agents)
  }

  /**
   * Find agent by ID
   */
  async findById(id: number): Promise<Agent | null> {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .limit(1)
    return results[0] ?? null
  }

  /**
   * Find agent by name
   */
  async findByName(name: string, projectId?: number): Promise<Agent | null> {
    const conditions = projectId !== undefined
      ? and(eq(agents.name, name), eq(agents.projectId, projectId))
      : eq(agents.name, name)

    const results = await this.db
      .select()
      .from(agents)
      .where(conditions)
      .limit(1)
    return results[0] ?? null
  }

  /**
   * Create a new agent
   */
  async create(input: CreateAgentInput): Promise<Agent> {
    // Check if agent with same name already exists
    const existing = await this.findByName(input.name, input.projectId)
    if (existing) {
      throw new AgentAlreadyExistsError(input.name)
    }

    // Validate input
    this.validateInput(input)

    const defaultScope: AgentScope = {
      write: [],
      exclude: [],
    }

    const scope: AgentScope = {
      read: input.scope?.read,
      write: input.scope?.write ?? defaultScope.write,
      exclude: input.scope?.exclude ?? defaultScope.exclude,
    }

    const newAgent: NewAgent = {
      name: input.name,
      description: input.description,
      client: input.client,
      model: input.model,
      scope,
      config: input.config ?? {},
      promptContent: input.promptContent,
      projectId: input.projectId,
      createdBy: input.createdBy,
      version: 1,
    }

    const results = await this.db
      .insert(agents)
      .values(newAgent)
      .returning()

    return results[0]
  }

  /**
   * Update an agent (creates history record)
   */
  async update(id: number, input: UpdateAgentInput): Promise<Agent> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new AgentNotFoundError(String(id))
    }

    // Create history record (snapshot of current state)
    const snapshot: AgentSnapshot = {
      name: existing.name,
      description: existing.description ?? undefined,
      client: existing.client,
      model: existing.model,
      scope: existing.scope as AgentScope,
      config: existing.config as AgentConfig | undefined,
      promptContent: existing.promptContent ?? undefined,
    }

    await this.db.insert(agentHistory).values({
      agentId: id,
      snapshot,
      version: existing.version,
      changedBy: input.changedBy,
      changeSummary: input.changeSummary,
    })

    // Build updated scope
    const existingScope = existing.scope as AgentScope
    const updatedScope: AgentScope = input.scope
      ? {
          read: input.scope.read ?? existingScope.read,
          write: input.scope.write ?? existingScope.write,
          exclude: input.scope.exclude ?? existingScope.exclude,
        }
      : existingScope

    // Update agent
    const results = await this.db
      .update(agents)
      .set({
        description: input.description ?? existing.description,
        client: input.client ?? existing.client,
        model: input.model ?? existing.model,
        scope: updatedScope,
        config: input.config ?? existing.config,
        promptContent: input.promptContent ?? existing.promptContent,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id))
      .returning()

    return results[0]
  }

  /**
   * Delete an agent
   */
  async delete(id: number): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new AgentNotFoundError(String(id))
    }

    // Delete history first (foreign key constraint)
    await this.db.delete(agentHistory).where(eq(agentHistory.agentId, id))

    // Delete agent
    await this.db.delete(agents).where(eq(agents.id, id))
  }

  /**
   * Get agent history
   */
  async getHistory(agentId: number): Promise<typeof agentHistory.$inferSelect[]> {
    return this.db
      .select()
      .from(agentHistory)
      .where(eq(agentHistory.agentId, agentId))
      .orderBy(agentHistory.version)
  }

  /**
   * Rollback to a specific version
   */
  async rollback(agentId: number, version: number): Promise<Agent> {
    const history = await this.db
      .select()
      .from(agentHistory)
      .where(and(eq(agentHistory.agentId, agentId), eq(agentHistory.version, version)))
      .limit(1)

    if (history.length === 0) {
      throw new Error(`Version ${version} not found for agent ${agentId}`)
    }

    const snapshot = history[0].snapshot as AgentSnapshot

    return this.update(agentId, {
      description: snapshot.description,
      client: snapshot.client,
      model: snapshot.model,
      scope: snapshot.scope,
      config: snapshot.config,
      promptContent: snapshot.promptContent,
      changeSummary: `Rollback to version ${version}`,
    })
  }

  /**
   * Convert Agent to AgentDefinition (for backward compatibility)
   */
  toDefinition(agent: Agent): AgentDefinition {
    return {
      name: agent.name,
      description: agent.description ?? undefined,
      client: agent.client,
      model: agent.model,
      scope: agent.scope as AgentScope,
      config: agent.config as AgentConfig | undefined,
      promptContent: agent.promptContent ?? undefined,
    }
  }

  /**
   * Build command for running an agent
   */
  buildCommand(agent: Agent | AgentDefinition, prompt: string): string {
    const client = agent.client.toLowerCase()

    switch (client) {
      case 'claude-code':
        return this.buildClaudeCodeCommand(agent, prompt)
      case 'codex':
        return this.buildCodexCommand(agent, prompt)
      case 'gemini':
      case 'gemini-cli':
        return this.buildGeminiCommand(agent, prompt)
      default:
        // Generic command - assume CLI tool with same name
        return `${client} "${prompt.replace(/"/g, '\\"')}"`
    }
  }

  private buildClaudeCodeCommand(agent: Agent | AgentDefinition, prompt: string): string {
    const parts = ['claude']

    if (agent.model) {
      parts.push(`--model ${agent.model}`)
    }

    parts.push(`"${prompt.replace(/"/g, '\\"')}"`)

    return parts.join(' ')
  }

  private buildCodexCommand(agent: Agent | AgentDefinition, prompt: string): string {
    const parts = ['codex']

    if (agent.model) {
      parts.push(`-m ${agent.model}`)
    }

    parts.push(`"${prompt.replace(/"/g, '\\"')}"`)

    return parts.join(' ')
  }

  private buildGeminiCommand(agent: Agent | AgentDefinition, prompt: string): string {
    const parts = ['gemini']

    if (agent.model) {
      parts.push(`-m ${agent.model}`)
    }

    parts.push(`"${prompt.replace(/"/g, '\\"')}"`)

    return parts.join(' ')
  }

  /**
   * Validate agent input
   */
  private validateInput(input: CreateAgentInput): void {
    if (!input.name || typeof input.name !== 'string') {
      throw new InvalidAgentDefinitionError(input.name ?? 'unknown', 'name is required')
    }

    if (!input.client || typeof input.client !== 'string') {
      throw new InvalidAgentDefinitionError(input.name, 'client is required')
    }

    if (!input.model || typeof input.model !== 'string') {
      throw new InvalidAgentDefinitionError(input.name, 'model is required')
    }

    if (input.scope) {
      if (input.scope.read && !Array.isArray(input.scope.read)) {
        throw new InvalidAgentDefinitionError(input.name, 'scope.read must be an array')
      }
      if (input.scope.write && !Array.isArray(input.scope.write)) {
        throw new InvalidAgentDefinitionError(input.name, 'scope.write must be an array')
      }
      if (input.scope.exclude && !Array.isArray(input.scope.exclude)) {
        throw new InvalidAgentDefinitionError(input.name, 'scope.exclude must be an array')
      }
    }
  }
}
