'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSSE, SSEEvent } from '@/hooks/use-sse'
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Plus,
  ArrowRight,
  Wifi,
  WifiOff,
} from 'lucide-react'

interface TaskStats {
  open: number
  in_progress: number
  done: number
  failed: number
  dod_failed: number
  cancelled: number
  total: number
}

interface SessionStats {
  running: number
  completed: number
  failed: number
  cancelled: number
  total: number
}

interface Task {
  id: number
  title: string
  status: string
  priority: string
  updatedAt: string | null
}

interface Session {
  id: number
  agentName: string
  status: string
  startedAt: string | null
  taskId: number | null
}

interface DashboardData {
  taskStats: TaskStats
  sessionStats: SessionStats
  activeSessions: Session[]
  recentTasks: Task[]
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
}: {
  title: string
  value: number
  description?: string
  icon: React.ElementType
  variant?: 'default' | 'success' | 'warning' | 'destructive'
}) {
  const variantClasses = {
    default: 'text-muted-foreground',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    destructive: 'text-red-500',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${variantClasses[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

function formatTime(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getElapsedTime(startedAt: string | null): string {
  if (!startedAt) return '-'
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - start) / 1000)

  if (elapsed < 60) return `${elapsed}s`
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
  return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [elapsedKey, setElapsedKey] = useState(0)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  // SSE event handler
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    // Refresh dashboard data on relevant events
    if (
      event.type.startsWith('task:') ||
      event.type.startsWith('session:') ||
      event.type.startsWith('worker:')
    ) {
      fetchDashboard()
    }
  }, [fetchDashboard])

  // Connect to SSE
  const { connected } = useSSE({
    enabled: true,
    onEvent: handleSSEEvent,
  })

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Update elapsed time every second for running sessions
  useEffect(() => {
    if (!data?.activeSessions.length) return

    const interval = setInterval(() => {
      setElapsedKey((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [data?.activeSessions.length])

  // Fallback polling when SSE is not connected
  useEffect(() => {
    if (connected) return

    const interval = setInterval(fetchDashboard, 10000)
    return () => clearInterval(interval)
  }, [connected, fetchDashboard])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{error || 'No data available'}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const { taskStats, sessionStats, activeSessions, recentTasks } = data

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <Button asChild>
          <Link href="/tasks/new">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {connected ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              <span>Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Polling</span>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open Tasks"
          value={taskStats.open}
          description={`${taskStats.in_progress} in progress`}
          icon={ListTodo}
        />
        <StatCard
          title="Completed"
          value={taskStats.done}
          description="Tasks done"
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Running Sessions"
          value={sessionStats.running}
          description={`${sessionStats.total} total sessions`}
          icon={Play}
          variant={sessionStats.running > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Failed"
          value={taskStats.failed + taskStats.dod_failed}
          description={`${taskStats.failed} failed, ${taskStats.dod_failed} DoD failed`}
          icon={AlertCircle}
          variant={taskStats.failed + taskStats.dod_failed > 0 ? 'destructive' : 'default'}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Currently running workers</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sessions?status=running">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activeSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active sessions
              </p>
            ) : (
              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <div>
                        <p className="font-medium text-sm">{session.agentName}</p>
                        <p className="text-xs text-muted-foreground">
                          Task #{session.taskId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span key={elapsedKey} className="text-xs text-muted-foreground font-mono">
                        {getElapsedTime(session.startedAt)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Completed Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recently Completed</CardTitle>
              <CardDescription>Tasks finished recently</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks?status=done">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No completed tasks yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(task.updatedAt)}
                      </p>
                    </div>
                    <Badge variant="success">Done</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
