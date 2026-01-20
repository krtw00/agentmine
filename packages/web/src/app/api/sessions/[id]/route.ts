import { NextRequest, NextResponse } from 'next/server';
import { sessions, tasks } from '@agentmine/core';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/sessions/:id - Get a specific session
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Failed to fetch session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sessions/:id - Update a session
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, exitCode, error: sessionError } = body;

    const db = getDb();

    // Check if session exists
    const [existing] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (!existing) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Partial<typeof sessions.$inferInsert> = {};

    if (status !== undefined) {
      updates.status = status;
      // Set completedAt if session is completed/failed
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        updates.completedAt = new Date();
      }
    }
    if (exitCode !== undefined) updates.exitCode = exitCode;
    if (sessionError !== undefined) updates.error = sessionError;

    const [updated] = await db
      .update(sessions)
      .set(updates)
      .where(eq(sessions.id, sessionId))
      .returning();

    // Update task status based on session status
    if (status === 'completed' && existing.taskId) {
      await db
        .update(tasks)
        .set({
          status: 'done',
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, existing.taskId));
    } else if (status === 'failed' && existing.taskId) {
      await db
        .update(tasks)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, existing.taskId));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
