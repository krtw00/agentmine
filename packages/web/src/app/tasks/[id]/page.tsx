'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Circle,
  Ban,
  Play,
  Edit,
  Trash2,
} from 'lucide-react'

interface Task {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  type: string
  assigneeType: string | null
  assigneeName: string | null
  labels: string[]
  complexity: number | null
  parentId: number | null
  selectedSessionId: number | null
  createdAt: string | null
  updatedAt: string | null
}

interface Session {
  id: number
  agentName: string
  status: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  exitCode: number | null
  dodResult: string | null
  branchName: string | null
  prUrl: string | null
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline' }> = {
  open: { label: 'Open', icon: Circle, variant: 'secondary' },
  in_progress: { label: 'In Progress', icon: Clock, variant: 'warning' },
  done: { label: 'Done', icon: CheckCircle2, variant: 'success' },
  failed: { label: 'Failed', icon: XCircle, variant: 'destructive' },
  dod_failed: { label: 'DoD Failed', icon: AlertCircle, variant: 'destructive' },
  cancelled: { label: 'Cancelled', icon: Ban, variant: 'outline' },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
  high: { label: 'High', className: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
  medium: { label: 'Medium', className: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
  low: { label: 'Low', className: 'text-gray-600 bg-gray-100 dark:bg-gray-900/30' },
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [task, setTask] = useState<Task | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch task
        const taskRes = await fetch(`/api/tasks/${taskId}`)
        if (!taskRes.ok) {
          if (taskRes.status === 404) throw new Error('Task not found')
          throw new Error('Failed to fetch task')
        }
        const taskData = await taskRes.json()
        setTask(taskData)

        // Fetch sessions for this task
        const sessionsRes = await fetch(`/api/sessions?taskId=${taskId}`)
        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json()
          setSessions(sessionsData)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [taskId])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{error || 'Task not found'}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/tasks">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tasks
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const statusConf = statusConfig[task.status] || statusConfig.open
  const StatusIcon = statusConf.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" asChild>
            <Link href="/tasks">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">#{task.id}</span>
            <Badge variant={statusConf.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusConf.label}
            </Badge>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${priorityConfig[task.priority]?.className || ''}`}>
              {priorityConfig[task.priority]?.label || task.priority}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/tasks/${task.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          {(task.status === 'open' || task.status === 'failed' || task.status === 'dod_failed') && (
            <Button size="sm">
              <Play className="h-4 w-4 mr-2" />
              Start Worker
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{task.description}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided.</p>
              )}
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>Execution history for this task</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No sessions yet. Start a worker to begin.
                </p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`/sessions/${session.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">#{session.id}</span>
                          <span className="text-sm text-muted-foreground">{session.agentName}</span>
                          <Badge
                            variant={
                              session.status === 'completed' ? 'success' :
                              session.status === 'running' ? 'warning' :
                              session.status === 'failed' ? 'destructive' : 'outline'
                            }
                          >
                            {session.status}
                          </Badge>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Started: {formatDateTime(session.startedAt)}</span>
                          {session.durationMs && <span>Duration: {formatDuration(session.durationMs)}</span>}
                          {session.exitCode !== null && <span>Exit: {session.exitCode}</span>}
                        </div>
                      </div>
                      {session.branchName && (
                        <div className="text-right text-xs">
                          <span className="text-muted-foreground">{session.branchName}</span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <p className="text-sm font-medium capitalize">{task.type}</p>
              </div>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">Assignee</label>
                <p className="text-sm font-medium">
                  {task.assigneeName ? (
                    <>
                      {task.assigneeType === 'ai' ? '🤖' : '👤'} {task.assigneeName}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </p>
              </div>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">Complexity</label>
                <p className="text-sm font-medium">
                  {task.complexity ? `${task.complexity}/10` : '-'}
                </p>
              </div>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">Labels</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {task.labels && task.labels.length > 0 ? (
                    task.labels.map((label) => (
                      <Badge key={label} variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No labels</span>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">Created</label>
                <p className="text-sm">{formatDateTime(task.createdAt)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Updated</label>
                <p className="text-sm">{formatDateTime(task.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
