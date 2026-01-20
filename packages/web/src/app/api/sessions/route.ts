import { NextRequest, NextResponse } from 'next/server';
import { sessions, tasks } from '@agentmine/core';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';

/**
 * GET /api/sessions - List all sessions
 */
export async function GET() {
  try {
    const db = getDb();
    const allSessions = await db.select().from(sessions).orderBy(desc(sessions.startedAt));
    return NextResponse.json(allSessions);
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
    const { taskId, agentName, worktreePath } = body;

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
