import { NextResponse } from 'next/server';
import { getDb } from '@agentmine/core/db';
import { TaskService, SessionService, AgentService } from '@agentmine/core/services';

export async function GET() {
  try {
    const db = await getDb();
    const taskService = new TaskService(db);
    const sessionService = new SessionService(db);
    const agentService = new AgentService();

    const [taskCounts, sessionCounts, agents] = await Promise.all([
      taskService.countByStatus(),
      sessionService.countByStatus(),
      Promise.resolve(agentService.findAll()),
    ]);

    const activeTasks = taskCounts.open + taskCounts.in_progress;
    const runningSessions = sessionCounts.running;
    const registeredAgents = agents.length;

    return NextResponse.json({
      activeTasks,
      runningSessions,
      registeredAgents,
      taskCounts,
      sessionCounts,
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
