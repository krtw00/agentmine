import { NextRequest, NextResponse } from 'next/server';
import { sessions, tasks, agents } from '@agentmine/core';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';

/**
 * GET /api/workers - List active workers (running sessions)
 */
export async function GET() {
  try {
    const db = getDb();
    const activeWorkers = await db
      .select()
      .from(sessions)
      .where(eq(sessions.status, 'running'));

    return NextResponse.json(activeWorkers);
  } catch (error) {
    console.error('Failed to fetch workers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workers - Start a new worker
 *
 * This creates a session and triggers worker startup
 * In a real implementation, this would:
 * 1. Create a git worktree
 * 2. Export agent config to worktree
 * 3. Apply scope restrictions
 * 4. Start the AI client process
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, agentName } = body;

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

    // Verify task exists and is not already running
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (task.status === 'in_progress') {
      return NextResponse.json(
        { error: 'Task is already in progress' },
        { status: 400 }
      );
    }

    // Verify agent exists
    const [agent] = await db.select().from(agents).where(eq(agents.name, agentName));
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Generate worktree path
    const worktreePath = `.agentmine/worktrees/task-${taskId}`;
    const branchName = `task-${taskId}`;

    // Create session
    const [session] = await db.insert(sessions).values({
      taskId,
      agentName,
      worktreePath,
      status: 'running',
      startedAt: new Date(),
    }).returning();

    // Update task
    await db
      .update(tasks)
      .set({
        status: 'in_progress',
        branchName,
        assigneeName: agentName,
        assigneeType: 'ai',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // TODO: Actually start the worker process
    // This would involve:
    // 1. git worktree add <worktreePath> -b <branchName>
    // 2. Export agent.yaml, prompt.md, memory/ to worktree
    // 3. Apply sparse-checkout and chmod restrictions
    // 4. Spawn claude-code/codex/etc with appropriate flags

    return NextResponse.json({
      session,
      worktreePath,
      branchName,
      message: 'Worker started successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to start worker:', error);
    return NextResponse.json(
      { error: 'Failed to start worker' },
      { status: 500 }
    );
  }
}
