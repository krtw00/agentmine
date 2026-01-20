import { createDb, initializeDb, TaskService, SessionService, AgentService } from '@agentmine/core';

async function getDashboardData() {
  const db = createDb();
  await initializeDb(db);

  const taskService = new TaskService(db);
  const sessionService = new SessionService(db);
  const agentService = new AgentService(db);

  const taskCounts = await taskService.countByStatus();
  const sessionCounts = await sessionService.countByStatus();
  const agents = await agentService.findAll();

  return {
    inProgressTasks: taskCounts.in_progress,
    runningSessions: sessionCounts.running,
    totalAgents: agents.length,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground">
          AIエージェントのプロジェクトと活動の概要
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">進行中のタスク</h3>
          <p className="text-2xl font-bold">{data.inProgressTasks}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">実行中のセッション</h3>
          <p className="text-2xl font-bold">{data.runningSessions}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">登録済みエージェント</h3>
          <p className="text-2xl font-bold">{data.totalAgents}</p>
        </div>
      </div>
    </div>
  );
}
