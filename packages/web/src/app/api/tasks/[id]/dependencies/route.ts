import { NextRequest, NextResponse } from 'next/server';
import { eq, and, inArray } from 'drizzle-orm';
import { getDb, tasks, taskDependencies } from '@/lib/db';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/tasks/:id/dependencies - List dependencies for a task
 * Returns { blockedBy: Task[], blocks: Task[] }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);

    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const db = getDb();
    const deps = taskDependencies as any;
    const t = tasks as any;

    // Tasks that block this task (blockedBy)
    const blockedByDeps = await db
      .select({ dependsOnTaskId: deps.dependsOnTaskId })
      .from(deps)
      .where(eq(deps.taskId, taskId));

    let blockedBy: any[] = [];
    if (blockedByDeps.length > 0) {
      const ids = blockedByDeps.map((d: any) => d.dependsOnTaskId);
      blockedBy = await db.select().from(t).where(inArray(t.id, ids));
    }

    // Tasks that this task blocks
    const blocksDeps = await db
      .select({ taskId: deps.taskId })
      .from(deps)
      .where(eq(deps.dependsOnTaskId, taskId));

    let blocks: any[] = [];
    if (blocksDeps.length > 0) {
      const ids = blocksDeps.map((d: any) => d.taskId);
      blocks = await db.select().from(t).where(inArray(t.id, ids));
    }

    return NextResponse.json({ blockedBy, blocks });
  } catch (error) {
    console.error('Failed to fetch dependencies:', error);
    return NextResponse.json({ error: 'Failed to fetch dependencies' }, { status: 500 });
  }
}

/**
 * POST /api/tasks/:id/dependencies - Add a dependency
 * Body: { dependsOnTaskId: number }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);

    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const body = await request.json();
    const { dependsOnTaskId } = body;

    if (!dependsOnTaskId || typeof dependsOnTaskId !== 'number') {
      return NextResponse.json({ error: 'dependsOnTaskId is required and must be a number' }, { status: 400 });
    }

    if (taskId === dependsOnTaskId) {
      return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 });
    }

    const db = getDb();
    const deps = taskDependencies as any;
    const t = tasks as any;

    // Verify both tasks exist
    const [task] = await db.select().from(t).where(eq(t.id, taskId));
    if (!task) {
      return NextResponse.json({ error: `Task #${taskId} not found` }, { status: 404 });
    }
    const [depTask] = await db.select().from(t).where(eq(t.id, dependsOnTaskId));
    if (!depTask) {
      return NextResponse.json({ error: `Task #${dependsOnTaskId} not found` }, { status: 404 });
    }

    // Insert dependency (UNIQUE constraint will prevent duplicates)
    await db.insert(deps).values({ taskId, dependsOnTaskId });

    return NextResponse.json({ success: true, taskId, dependsOnTaskId }, { status: 201 });
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE') || error?.code === '23505') {
      return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
    }
    console.error('Failed to add dependency:', error);
    return NextResponse.json({ error: 'Failed to add dependency' }, { status: 500 });
  }
}

/**
 * DELETE /api/tasks/:id/dependencies - Remove a dependency
 * Query param: dependsOnTaskId
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);

    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const url = new URL(request.url);
    const dependsOnTaskId = parseInt(url.searchParams.get('dependsOnTaskId') ?? '', 10);

    if (isNaN(dependsOnTaskId)) {
      return NextResponse.json({ error: 'dependsOnTaskId query param is required' }, { status: 400 });
    }

    const db = getDb();
    const deps = taskDependencies as any;

    await db
      .delete(deps)
      .where(
        and(
          eq(deps.taskId, taskId),
          eq(deps.dependsOnTaskId, dependsOnTaskId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove dependency:', error);
    return NextResponse.json({ error: 'Failed to remove dependency' }, { status: 500 });
  }
}
