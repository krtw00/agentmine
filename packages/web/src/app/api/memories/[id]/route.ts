import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, memories } from '@/lib/db';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/memories/:id - Get a specific memory
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const memoryId = parseInt(id, 10);

    if (isNaN(memoryId)) {
      return NextResponse.json(
        { error: 'Invalid memory ID' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [memory] = await db.select().from(memories).where(eq(memories.id, memoryId));

    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(memory);
  } catch (error) {
    console.error('Failed to fetch memory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memory' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/memories/:id - Update a memory
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const memoryId = parseInt(id, 10);

    if (isNaN(memoryId)) {
      return NextResponse.json(
        { error: 'Invalid memory ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { category, title, summary, content, status, tags, relatedTaskId } = body;

    const db = getDb();

    // Check if memory exists
    const [existing] = await db.select().from(memories).where(eq(memories.id, memoryId));
    if (!existing) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Partial<typeof memories.$inferInsert> = {
      updatedAt: new Date(),
      version: (existing.version || 1) + 1,
    };

    if (category !== undefined) updates.category = category;
    if (title !== undefined) updates.title = title;
    if (summary !== undefined) updates.summary = summary;
    if (content !== undefined) updates.content = content;
    if (status !== undefined) updates.status = status;
    if (tags !== undefined) updates.tags = tags;
    if (relatedTaskId !== undefined) updates.relatedTaskId = relatedTaskId;

    const [updated] = await db
      .update(memories)
      .set(updates)
      .where(eq(memories.id, memoryId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update memory:', error);
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memories/:id - Delete a memory
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const memoryId = parseInt(id, 10);

    if (isNaN(memoryId)) {
      return NextResponse.json(
        { error: 'Invalid memory ID' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if memory exists
    const [existing] = await db.select().from(memories).where(eq(memories.id, memoryId));
    if (!existing) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    await db.delete(memories).where(eq(memories.id, memoryId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete memory:', error);
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
