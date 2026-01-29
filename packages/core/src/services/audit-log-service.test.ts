import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AuditLogService } from './audit-log-service.js'
import { createTestDb, closeTestDb, getTestDb } from '../test-utils.js'

describe('AuditLogService', () => {
  let service: AuditLogService

  beforeEach(async () => {
    await createTestDb()
    service = new AuditLogService(getTestDb())
  })

  afterEach(() => {
    closeTestDb()
  })

  describe('log', () => {
    it('should log an audit event', async () => {
      const log = await service.log({
        userId: 'user-1',
        action: 'create',
        entityType: 'task',
        entityId: '123',
        changes: { after: { title: 'New Task' } },
      })

      expect(log.id).toBeDefined()
      expect(log.userId).toBe('user-1')
      expect(log.action).toBe('create')
      expect(log.entityType).toBe('task')
      expect(log.entityId).toBe('123')
      expect(log.changes).toEqual({ after: { title: 'New Task' } })
    })

    it('should log without project scope', async () => {
      // Note: projectId references projects(id) which requires FK to exist
      // Test without projectId to avoid FK constraint issues
      const log = await service.log({
        userId: 'user-1',
        action: 'update',
        entityType: 'agent',
        entityId: 'test-agent',
      })

      expect(log.userId).toBe('user-1')
      expect(log.projectId).toBeNull()
    })
  })

  describe('convenience methods', () => {
    it('should log create action', async () => {
      const log = await service.logCreate('user-1', 'task', 1, { title: 'Task' })

      expect(log.action).toBe('create')
      expect(log.changes).toEqual({ after: { title: 'Task' } })
    })

    it('should log update action', async () => {
      const log = await service.logUpdate(
        'user-1',
        'task',
        1,
        { status: 'open' },
        { status: 'in_progress' }
      )

      expect(log.action).toBe('update')
      expect(log.changes).toEqual({
        before: { status: 'open' },
        after: { status: 'in_progress' },
      })
    })

    it('should log delete action', async () => {
      const log = await service.logDelete('user-1', 'task', 1, { title: 'Deleted' })

      expect(log.action).toBe('delete')
      expect(log.changes).toEqual({ before: { title: 'Deleted' } })
    })

    it('should log start action', async () => {
      const log = await service.logStart('user-1', 'session', 1, { agentName: 'agent-1' })

      expect(log.action).toBe('start')
      expect(log.entityType).toBe('session')
    })

    it('should log stop action', async () => {
      const log = await service.logStop('user-1', 'session', 1, { exitCode: 0 })

      expect(log.action).toBe('stop')
    })
  })

  describe('findById', () => {
    it('should find log by ID', async () => {
      const created = await service.log({
        userId: 'user-1',
        action: 'create',
        entityType: 'task',
        entityId: '1',
      })

      const found = await service.findById(created.id)
      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
    })

    it('should return null for non-existent ID', async () => {
      const found = await service.findById(999)
      expect(found).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should return all logs', async () => {
      await service.logCreate('user-1', 'task', 1, {})
      await service.logUpdate('user-1', 'task', 1, {}, {})
      await service.logDelete('user-1', 'task', 1, {})

      const logs = await service.findAll()
      expect(logs).toHaveLength(3)
    })

    it('should filter by action', async () => {
      await service.logCreate('user-1', 'task', 1, {})
      await service.logUpdate('user-1', 'task', 1, {}, {})

      const createLogs = await service.findAll({ action: 'create' })
      expect(createLogs).toHaveLength(1)
    })

    it('should filter by entityType', async () => {
      await service.logCreate('user-1', 'task', 1, {})
      await service.logCreate('user-1', 'agent', 'agent-1', {})

      const taskLogs = await service.findAll({ entityType: 'task' })
      expect(taskLogs).toHaveLength(1)
    })

    it('should filter by userId', async () => {
      await service.logCreate('user-1', 'task', 1, {})
      await service.logCreate('user-2', 'task', 2, {})

      const user1Logs = await service.findAll({ userId: 'user-1' })
      expect(user1Logs).toHaveLength(1)
    })

    it('should respect limit', async () => {
      await service.logCreate('user-1', 'task', 1, {})
      await service.logCreate('user-1', 'task', 2, {})
      await service.logCreate('user-1', 'task', 3, {})

      const logs = await service.findAll({ limit: 2 })
      expect(logs).toHaveLength(2)
    })
  })

  describe('getEntityHistory', () => {
    it('should return all logs for an entity', async () => {
      await service.logCreate('user-1', 'task', 1, { title: 'Task 1' })
      await service.logUpdate('user-1', 'task', 1, { status: 'open' }, { status: 'done' })
      await service.logCreate('user-1', 'task', 2, { title: 'Task 2' })

      const history = await service.getEntityHistory('task', 1)
      expect(history).toHaveLength(2)
    })
  })

  describe('getUserActivity', () => {
    it('should return logs for a user', async () => {
      await service.logCreate('user-1', 'task', 1, {})
      await service.logCreate('user-1', 'task', 2, {})
      await service.logCreate('user-2', 'task', 3, {})

      const activity = await service.getUserActivity('user-1')
      expect(activity).toHaveLength(2)
    })
  })

  describe('getRecentActivity', () => {
    it('should return recent logs', async () => {
      await service.logCreate('user-1', 'task', 1, {})
      await service.logCreate('user-1', 'task', 2, {})

      const recent = await service.getRecentActivity(10)
      expect(recent).toHaveLength(2)
    })
  })

  describe('countByAction', () => {
    it('should count logs by action type', async () => {
      await service.logCreate('user-1', 'task', 1, {})
      await service.logCreate('user-1', 'task', 2, {})
      await service.logUpdate('user-1', 'task', 1, {}, {})
      await service.logDelete('user-1', 'task', 2, {})

      const counts = await service.countByAction()
      expect(counts.create).toBe(2)
      expect(counts.update).toBe(1)
      expect(counts.delete).toBe(1)
    })
  })
})
