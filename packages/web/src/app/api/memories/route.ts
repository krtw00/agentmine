import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb, memories } from '@/lib/db';

/**
 * GET /api/memories - List all memories
 * Query params:
 *   - category: Filter by category
 *   - status: Filter by status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    const db = getDb();

    // Build query with filters
    let result;
    if (category && status) {
      result = await db.select().from(memories)
        .where(eq(memories.category, category))
        .orderBy(desc(memories.updatedAt));
      result = result.filter(m => m.status === status);
    } else if (category) {
      result = await db.select().from(memories)
        .where(eq(memories.category, category))
        .orderBy(desc(memories.updatedAt));
    } else if (status) {
      result = await db.select().from(memories)
        .where(eq(memories.status, status as 'draft' | 'active' | 'archived'))
        .orderBy(desc(memories.updatedAt));
    } else {
      result = await db.select().from(memories).orderBy(desc(memories.updatedAt));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch memories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memories - Create a new memory
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, title, summary, content, status, tags, relatedTaskId } = body;

    if (!category || !title || !content) {
      return NextResponse.json(
        { error: 'Category, title, and content are required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [newMemory] = await db.insert(memories).values({
      category,
      title,
      summary: summary || null,
      content,
      status: status || 'active',
      tags: tags || [],
      relatedTaskId: relatedTaskId || null,
    }).returning();

    return NextResponse.json(newMemory, { status: 201 });
  } catch (error) {
    console.error('Failed to create memory:', error);
    return NextResponse.json(
      { error: 'Failed to create memory' },
      { status: 500 }
    );
  }
}
