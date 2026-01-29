import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, and } from 'drizzle-orm';
import { getDb, sessions, tasks } from '@/lib/db';

/**
 * GET /api/sessions - List all sessions
 * Query params:
 *   - taskId: Filter by task ID
 *   - status: Filter by status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const status = searchParams.get('status');

    const db = getDb();

    // Build where conditions
    const conditions = [];
    if (taskId) {
      conditions.push(eq(sessions.taskId, parseInt(taskId)));
    }
    if (status) {
      conditions.push(eq(sessions.status, status as 'running' | 'completed' | 'failed' | 'cancelled'));
    }

    // Execute query with or without conditions
    let result;
    if (conditions.length === 0) {
      result = await db.select().from(sessions).orderBy(desc(sessions.startedAt));
    } else if (conditions.length === 1) {
      result = await db.select().from(sessions).where(conditions[0]).orderBy(desc(sessions.startedAt));
    } else {
      result = await db.select().from(sessions).where(and(...conditions)).orderBy(desc(sessions.startedAt));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions - Create a new session (start worker)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, agentName, worktreePath, branchName, sessionGroupId, idempotencyKey } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    if (!agentName) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Verify task exists
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Create session
    const [newSession] = await db.insert(sessions).values({
      taskId,
      agentName,
      worktreePath,
      branchName,
      sessionGroupId,
      idempotencyKey,
      status: 'running',
      startedAt: new Date(),
    }).returning();

    // Update task status to in_progress
    await db
      .update(tasks)
      .set({
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
