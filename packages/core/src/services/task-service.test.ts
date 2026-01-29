import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TaskService } from './task-service.js'
import { createTestDb, closeTestDb, getTestDb } from '../test-utils.js'

describe('TaskService', () => {
  let service: TaskService

  beforeEach(async () => {
    await createTestDb()
    service = new TaskService(getTestDb())
  })

  afterEach(() => {
    closeTestDb()
  })

  describe('create', () => {
    it('should create a task with required fields', async () => {
      const task = await service.create({
        title: 'Test Task',
      })

      expect(task.id).toBeDefined()
      expect(task.title).toBe('Test Task')
      expect(task.status).toBe('open')
      expect(task.priority).toBe('medium')
      expect(task.type).toBe('task')
    })

    it('should create a task with optional fields', async () => {
      const task = await service.create({
        title: 'Full Task',
        description: 'A description',
        type: 'feature',
        priority: 'high',
        assigneeName: 'test-agent',
        assigneeType: 'ai',
        complexity: 5,
      })

      expect(task.title).toBe('Full Task')
      expect(task.description).toBe('A description')
      expect(task.type).toBe('feature')
      expect(task.priority).toBe('high')
      expect(task.assigneeName).toBe('test-agent')
      expect(task.assigneeType).toBe('ai')
      expect(task.complexity).toBe(5)
    })
  })

  describe('findById', () => {
    it('should find a task by ID', async () => {
      const created = await service.create({ title: 'Find Me' })
      const found = await service.findById(created.id)

      expect(found).not.toBeNull()
      expect(found?.title).toBe('Find Me')
    })

    it('should return null for non-existent ID', async () => {
      const found = await service.findById(999)
      expect(found).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should return all tasks', async () => {
      await service.create({ title: 'Task 1' })
      await service.create({ title: 'Task 2' })
      await service.create({ title: 'Task 3' })

      const tasks = await service.findAll()
      expect(tasks).toHaveLength(3)
    })

    it('should filter by status', async () => {
      await service.create({ title: 'Open Task' })
      const inProgressTask = await service.create({ title: 'In Progress Task' })
      await service.update(inProgressTask.id, { status: 'in_progress' })

      const openTasks = await service.findAll({ status: 'open' })
      expect(openTasks).toHaveLength(1)
      expect(openTasks[0].title).toBe('Open Task')
    })

    it('should filter by assignee', async () => {
      await service.create({ title: 'Unassigned Task' })
      await service.create({
        title: 'AI Task',
        assigneeName: 'test-agent',
        assigneeType: 'ai',
      })

      const aiTasks = await service.findAll({ assigneeType: 'ai' })
      expect(aiTasks).toHaveLength(1)
      expect(aiTasks[0].title).toBe('AI Task')
    })
  })

  describe('update', () => {
    it('should update task fields', async () => {
      const task = await service.create({ title: 'Original' })
      const updated = await service.update(task.id, {
        title: 'Updated',
        status: 'in_progress',
      })

      expect(updated.title).toBe('Updated')
      expect(updated.status).toBe('in_progress')
    })

    it('should update labels', async () => {
      const task = await service.create({ title: 'Task with Labels' })
      const updated = await service.update(task.id, {
        labels: ['frontend', 'urgent'],
      })

      expect(updated.labels).toEqual(['frontend', 'urgent'])
    })

    it('should throw for non-existent task', async () => {
      await expect(service.update(999, { title: 'New' })).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('should delete a task', async () => {
      const task = await service.create({ title: 'Delete Me' })
      await service.delete(task.id)

      const found = await service.findById(task.id)
      expect(found).toBeNull()
    })
  })

  describe('selectSession', () => {
    it('should set selectedSessionId and mark as done', async () => {
      const task = await service.create({ title: 'Session Task' })
      const updated = await service.selectSession(task.id, 42)

      expect(updated.selectedSessionId).toBe(42)
      expect(updated.status).toBe('done')
    })
  })

  describe('subtasks', () => {
    it('should support parent-child relationships', async () => {
      const parent = await service.create({ title: 'Parent Task' })
      await service.create({ title: 'Child 1', parentId: parent.id })
      await service.create({ title: 'Child 2', parentId: parent.id })

      const subtasks = await service.getSubtasks(parent.id)
      expect(subtasks).toHaveLength(2)
    })

    it('should prevent circular dependencies', async () => {
      const task1 = await service.create({ title: 'Task 1' })
      const task2 = await service.create({ title: 'Task 2', parentId: task1.id })

      // Try to make task1 a child of task2 (would create a cycle)
      await expect(
        service.update(task1.id, { parentId: task2.id })
      ).rejects.toThrow()
    })
  })

  describe('countByStatus', () => {
    it('should count tasks by status', async () => {
      await service.create({ title: 'Open 1' })
      await service.create({ title: 'Open 2' })
      const task3 = await service.create({ title: 'In Progress' })
      await service.update(task3.id, { status: 'in_progress' })

      const counts = await service.countByStatus()
      expect(counts.open).toBe(2)
      expect(counts.in_progress).toBe(1)
      expect(counts.done).toBe(0)
    })
  })
})
