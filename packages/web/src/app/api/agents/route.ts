import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { getDb, agents } from '@/lib/db';

/**
 * GET /api/agents - List all agents
 */
export async function GET() {
  try {
    const db = getDb();
    const result = await db.select().from(agents).orderBy(desc(agents.createdAt));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents - Create a new agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, client, model, scope, config, promptContent, dod } = body;

    if (!name || !client || !model) {
      return NextResponse.json(
        { error: 'Name, client, and model are required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [newAgent] = await db.insert(agents).values({
      name,
      description,
      client,
      model,
      scope: scope || { write: [], exclude: [] },
      config: config || {},
      promptContent,
      dod: dod || [],
    }).returning();

    return NextResponse.json(newAgent, { status: 201 });
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
