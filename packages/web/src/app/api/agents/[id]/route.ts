import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, agents } from '@/lib/db';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/agents/:id - Get a specific agent
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const agentId = parseInt(id, 10);

    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Failed to fetch agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/:id - Update an agent
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const agentId = parseInt(id, 10);

    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, client, model, scope, config, promptContent, dod } = body;

    const db = getDb();

    // Check if agent exists
    const [existing] = await db.select().from(agents).where(eq(agents.id, agentId));
    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: Math.floor(Date.now() / 1000),
      version: ((existing as { version?: number }).version || 1) + 1,
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (client !== undefined) updates.client = client;
    if (model !== undefined) updates.model = model;
    if (scope !== undefined) updates.scope = scope;
    if (config !== undefined) updates.config = config;
    if (promptContent !== undefined) updates.promptContent = promptContent;
    if (dod !== undefined) updates.dod = dod;

    const [updated] = await db
      .update(agents)
      .set(updates)
      .where(eq(agents.id, agentId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/:id - Delete an agent
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const agentId = parseInt(id, 10);

    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if agent exists
    const [existing] = await db.select().from(agents).where(eq(agents.id, agentId));
    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    await db.delete(agents).where(eq(agents.id, agentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
