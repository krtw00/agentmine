import { NextResponse } from 'next/server';
import { getDb } from '@agentmine/core/db';
import { SessionService } from '@agentmine/core/services';

export async function GET() {
  try {
    const db = await getDb();
    const sessionService = new SessionService(db);

    const sessions = await sessionService.findAll({ limit: 10 });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Failed to fetch recent sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent sessions' },
      { status: 500 }
    );
  }
}
