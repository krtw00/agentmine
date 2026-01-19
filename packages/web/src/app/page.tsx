'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, CheckCircle2, XCircle, Clock, PlayCircle } from 'lucide-react';

interface Stats {
  activeTasks: number;
  runningSessions: number;
  registeredAgents: number;
  taskCounts: {
    open: number;
    in_progress: number;
    done: number;
    failed: number;
    cancelled: number;
  };
  sessionCounts: {
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

interface Task {
  id: number;
  title: string;
  status: string;
  priority: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Session {
  id: number;
  taskId: number | null;
  agentName: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  open: 'secondary',
  in_progress: 'warning',
  done: 'success',
  failed: 'destructive',
  cancelled: 'outline',
  running: 'warning',
  completed: 'success',
};

const priorityColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  low: 'secondary',
  medium: 'default',
  high: 'warning',
  critical: 'destructive',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, tasksRes, sessionsRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/tasks/recent'),
          fetch('/api/sessions/recent'),
        ]);

        const [statsData, tasksData, sessionsData] = await Promise.all([
          statsRes.json(),
          tasksRes.json(),
          sessionsRes.json(),
        ]);

        setStats(statsData);
        setRecentTasks(tasksData);
        setRecentSessions(sessionsData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your AI agent projects and activities
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your AI agent projects and activities
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeTasks ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.taskCounts.open ?? 0} open, {stats?.taskCounts.in_progress ?? 0} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running Sessions</CardTitle>
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.runningSessions ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.sessionCounts.completed ?? 0} completed, {stats?.sessionCounts.failed ?? 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Agents</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.registeredAgents ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Available for task execution
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Task Summary</CardTitle>
          <CardDescription>Overview of all tasks by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Open</p>
              <p className="text-2xl font-bold">{stats?.taskCounts.open ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold">{stats?.taskCounts.in_progress ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Done</p>
              <p className="text-2xl font-bold">{stats?.taskCounts.done ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold">{stats?.taskCounts.failed ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Cancelled</p>
              <p className="text-2xl font-bold">{stats?.taskCounts.cancelled ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
            <CardDescription>Latest updated tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet</p>
              ) : (
                recentTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between space-x-4">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{task.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusColors[task.status]}>{task.status}</Badge>
                        <Badge variant={priorityColors[task.priority]}>{task.priority}</Badge>
                        <span className="text-xs text-muted-foreground">{task.type}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(task.updatedAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest session executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions yet</p>
              ) : (
                recentSessions.slice(0, 5).map((session) => (
                  <div key={session.id} className="flex items-center justify-between space-x-4">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.agentName}
                        {session.taskId && ` (Task #${session.taskId})`}
                      </p>
                      <Badge variant={statusColors[session.status]}>{session.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session.status === 'running' ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Running
                        </span>
                      ) : (
                        formatDate(session.completedAt)
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
