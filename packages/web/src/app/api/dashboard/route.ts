import { NextResponse } from 'next/server';
import { eq, desc, sql, count } from 'drizzle-orm';
import { getDb, tasks, sessions } from '@/lib/db';

// Type assertion helpers for dual-database support
const tasksTable = tasks as any;
const sessionsTable = sessions as any;

/**
 * GET /api/dashboard - Get dashboard statistics
 */
export async function GET() {
  try {
    const db = getDb();

    // Get task counts by status
    const taskCounts = await db
      .select({
        status: tasksTable.status,
        count: count(),
      })
      .from(tasksTable)
      .groupBy(tasksTable.status);

    const taskStats = {
      open: 0,
      in_progress: 0,
      done: 0,
      failed: 0,
      dod_failed: 0,
      cancelled: 0,
      total: 0,
    };

    for (const row of taskCounts) {
      if (row.status && row.status in taskStats) {
        taskStats[row.status as keyof typeof taskStats] = row.count;
      }
      taskStats.total += row.count;
    }

    // Get active sessions (running)
    const activeSessions = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.status, 'running'))
      .orderBy(desc(sessionsTable.startedAt))
      .limit(5);

    // Get recent completed tasks
    const recentTasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.status, 'done'))
      .orderBy(desc(tasksTable.updatedAt))
      .limit(5);

    // Get session counts by status
    const sessionCounts = await db
      .select({
        status: sessionsTable.status,
        count: count(),
      })
      .from(sessionsTable)
      .groupBy(sessionsTable.status);

    const sessionStats = {
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    };

    for (const row of sessionCounts) {
      if (row.status && row.status in sessionStats) {
        sessionStats[row.status as keyof typeof sessionStats] = row.count;
      }
      sessionStats.total += row.count;
    }

    return NextResponse.json({
      taskStats,
      sessionStats,
      activeSessions,
      recentTasks,
    });
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
