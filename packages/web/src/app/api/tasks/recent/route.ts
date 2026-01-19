import { NextResponse } from 'next/server';
import { getDb } from '@agentmine/core/db';
import { TaskService } from '@agentmine/core/services';

export async function GET() {
  try {
    const db = await getDb();
    const taskService = new TaskService(db);

    const tasks = await taskService.findAll({ limit: 10 });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch recent tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent tasks' },
      { status: 500 }
    );
  }
}
