import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, sessions, tasks } from '@/lib/db';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/workers/:id - Get worker status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid worker ID' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

    if (!session) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Failed to fetch worker:', error);
    return NextResponse.json(
      { error: 'Failed to fetch worker' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workers/:id - Stop a worker
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid worker ID' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Get session
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (!session) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      );
    }

    // Check if already stopped
    if (session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Worker is not running' },
        { status: 400 }
      );
    }

    // TODO: Actually stop the worker process
    // This would involve:
    // 1. Kill the AI client process
    // 2. Optionally cleanup worktree

    // Update session status
    await db
      .update(sessions)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    // Update task status back to open
    if (session.taskId) {
      await db
        .update(tasks)
        .set({
          status: 'open',
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, session.taskId));
    }

    return NextResponse.json({
      success: true,
      message: 'Worker stopped successfully',
    });
  } catch (error) {
    console.error('Failed to stop worker:', error);
    return NextResponse.json(
      { error: 'Failed to stop worker' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workers/:id/done - Mark worker as completed
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid worker ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action } = body;

    const db = getDb();

    // Get session
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (!session) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      );
    }

    if (action === 'complete') {
      // Mark as completed
      await db
        .update(sessions)
        .set({
          status: 'completed',
          exitCode: 0,
          completedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Update task status
      if (session.taskId) {
        await db
          .update(tasks)
          .set({
            status: 'done',
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, session.taskId));
      }

      // TODO: Cleanup worktree if configured

      return NextResponse.json({
        success: true,
        message: 'Worker completed successfully',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to complete worker:', error);
    return NextResponse.json(
      { error: 'Failed to complete worker' },
      { status: 500 }
    );
  }
}
