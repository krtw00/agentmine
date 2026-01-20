import { createDb, initializeDb, TaskService, type Task } from '@agentmine/core';
import TasksClient from './tasks-client';

async function getTasks(): Promise<Task[]> {
  const db = createDb();
  await initializeDb(db);
  const taskService = new TaskService(db);
  return taskService.findAll();
}

export default async function TasksPage() {
  const tasks = await getTasks();

  return <TasksClient tasks={tasks} />;
}
