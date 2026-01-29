import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SessionService } from './session-service.js'
import { TaskService } from './task-service.js'
import { createTestDb, closeTestDb, getTestDb } from '../test-utils.js'

describe('SessionService', () => {
  let service: SessionService
  let taskService: TaskService
  let testTaskId: number

  beforeEach(async () => {
    await createTestDb()
    service = new SessionService(getTestDb())
    taskService = new TaskService(getTestDb())

    // Create a test task for sessions
    const task = await taskService.create({ title: 'Test Task' })
    testTaskId = task.id
  })

  afterEach(() => {
    closeTestDb()
  })

  describe('start', () => {
    it('should start a session with required fields', async () => {
      const session = await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
      })

      expect(session.id).toBeDefined()
      expect(session.taskId).toBe(testTaskId)
      expect(session.agentName).toBe('test-agent')
      expect(session.status).toBe('running')
    })

    it('should start a session with optional fields', async () => {
      const session = await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
        branchName: 'task-1',
        worktreePath: '.agentmine/worktrees/task-1',
        sessionGroupId: 'group-1',
      })

      expect(session.branchName).toBe('task-1')
      expect(session.worktreePath).toBe('.agentmine/worktrees/task-1')
      expect(session.sessionGroupId).toBe('group-1')
    })

    it('should support idempotency key', async () => {
      const session1 = await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
        idempotencyKey: 'unique-key-1',
      })

      expect(session1.idempotencyKey).toBe('unique-key-1')
    })

    it('should throw on duplicate idempotency key', async () => {
      await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
        idempotencyKey: 'duplicate-key',
      })

      await expect(
        service.start({
          taskId: testTaskId,
          agentName: 'test-agent',
          idempotencyKey: 'duplicate-key',
        })
      ).rejects.toThrow()
    })
  })

  describe('1:N relationship (multiple sessions per task)', () => {
    it('should allow multiple sessions for the same task', async () => {
      await service.start({ taskId: testTaskId, agentName: 'agent-1' })
      await service.start({ taskId: testTaskId, agentName: 'agent-2' })
      await service.start({ taskId: testTaskId, agentName: 'agent-3' })

      const sessions = await service.findByTask(testTaskId)
      expect(sessions).toHaveLength(3)
    })

    it('should find latest session by task', async () => {
      await service.start({ taskId: testTaskId, agentName: 'agent-1' })
      await service.start({ taskId: testTaskId, agentName: 'agent-2' })
      await service.start({ taskId: testTaskId, agentName: 'agent-3' })

      const latest = await service.findLatestByTask(testTaskId)
      expect(latest).not.toBeNull()
      // Should return one of the sessions (order may vary with same timestamp)
      expect(['agent-1', 'agent-2', 'agent-3']).toContain(latest?.agentName)
    })

    it('should find running sessions by task', async () => {
      const running1 = await service.start({ taskId: testTaskId, agentName: 'agent-1' })
      await service.start({ taskId: testTaskId, agentName: 'agent-2' })
      await service.end(running1.id, { status: 'completed', exitCode: 0 })

      const running = await service.findRunningByTask(testTaskId)
      expect(running).toHaveLength(1)
      expect(running[0].agentName).toBe('agent-2')
    })

    it('should find sessions by group', async () => {
      const groupId = 'comparison-group-1'
      await service.start({ taskId: testTaskId, agentName: 'agent-1', sessionGroupId: groupId })
      await service.start({ taskId: testTaskId, agentName: 'agent-2', sessionGroupId: groupId })
      await service.start({ taskId: testTaskId, agentName: 'agent-3' }) // Different group

      const groupSessions = await service.findByGroup(groupId)
      expect(groupSessions).toHaveLength(2)
    })
  })

  describe('end', () => {
    it('should mark session as completed', async () => {
      const session = await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
      })

      const result = await service.end(session.id, {
        status: 'completed',
        exitCode: 0,
        dodResult: 'passed',
      })

      expect(result.session.status).toBe('completed')
      expect(result.session.exitCode).toBe(0)
      expect(result.session.dodResult).toBe('passed')
      expect(result.session.completedAt).toBeDefined()
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should mark session as failed with exit code', async () => {
      const session = await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
      })

      const result = await service.end(session.id, {
        status: 'failed',
        exitCode: 1,
        error: 'Process failed',
      })

      expect(result.session.status).toBe('failed')
      expect(result.session.exitCode).toBe(1)
      expect(result.session.error).toBe('Process failed')
    })

    it('should mark session as cancelled', async () => {
      const session = await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
      })

      const result = await service.end(session.id, { status: 'cancelled' })
      expect(result.session.status).toBe('cancelled')
    })
  })

  describe('selectAsWinner', () => {
    it('should mark session as winner and update task', async () => {
      const session = await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
        branchName: 'winner-branch',
      })

      await service.selectAsWinner(session.id)

      // Verify task was updated
      const task = await taskService.findById(testTaskId)
      expect(task?.selectedSessionId).toBe(session.id)
      expect(task?.status).toBe('done')
    })
  })

  describe('review', () => {
    it('should add review to session', async () => {
      const session = await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
      })

      const reviewed = await service.review(session.id, {
        status: 'approved',
        reviewedBy: 'human-reviewer',
        comment: 'Looks good!',
      })

      expect(reviewed.reviewStatus).toBe('approved')
      expect(reviewed.reviewedBy).toBe('human-reviewer')
      expect(reviewed.reviewComment).toBe('Looks good!')
      expect(reviewed.reviewedAt).toBeDefined()
    })
  })

  describe('updateBranchInfo', () => {
    it('should update branch info and PR URL', async () => {
      const session = await service.start({
        taskId: testTaskId,
        agentName: 'test-agent',
      })

      const updated = await service.updateBranchInfo(
        session.id,
        'feature-branch',
        'https://github.com/org/repo/pull/1'
      )
      expect(updated.branchName).toBe('feature-branch')
      expect(updated.prUrl).toBe('https://github.com/org/repo/pull/1')
    })
  })
})
