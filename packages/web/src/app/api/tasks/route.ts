import { NextRequest, NextResponse } from 'next/server';
import { tasks } from '@agentmine/core';
import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';

/**
 * GET /api/tasks - List all tasks
 */
export async function GET() {
  try {
    const db = getDb();
    const allTasks = await db.select().from(tasks).orderBy(desc(tasks.updatedAt));
    return NextResponse.json(allTasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks - Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, type, priority, parentId, assigneeId, assigneeName, assigneeType, labels } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [newTask] = await db.insert(tasks).values({
      title,
      description,
      type: type ?? 'task',
      priority: priority ?? 'medium',
      status: 'open',
      parentId,
      assigneeName,
      assigneeType,
      labels: labels ?? [],
    }).returning();

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
