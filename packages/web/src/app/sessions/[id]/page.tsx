'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  AlertCircle,
  ExternalLink,
  GitBranch,
  FileText,
  RefreshCw,
  Square,
} from 'lucide-react'

interface Session {
  id: number
  taskId: number | null
  agentName: string
  status: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  exitCode: number | null
  error: string | null
  dodResult: string | null
  branchName: string | null
  prUrl: string | null
  worktreePath: string | null
  reviewStatus: string | null
  reviewedBy: string | null
  reviewComment: string | null
  reviewedAt: string | null
  signal: string | null
  artifacts: unknown | null
}

interface Task {
  id: number
  title: string
  status: string
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline' }> = {
  running: { label: 'Running', icon: Play, variant: 'warning' },
  completed: { label: 'Completed', icon: CheckCircle2, variant: 'success' },
  failed: { label: 'Failed', icon: XCircle, variant: 'destructive' },
  cancelled: { label: 'Cancelled', icon: Ban, variant: 'outline' },
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
    second: '2-digit',
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

function getElapsedTime(startedAt: string | null): string {
  if (!startedAt) return '-'
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - start) / 1000)

  if (elapsed < 60) return `${elapsed}s`
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
  return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [session, setSession] = useState<Session | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const sessionRes = await fetch(`/api/sessions/${resolvedParams.id}`)
        if (!sessionRes.ok) throw new Error('Session not found')
        const sessionData = await sessionRes.json()
        setSession(sessionData)

        // Fetch associated task if exists
        if (sessionData.taskId) {
          const taskRes = await fetch(`/api/tasks/${sessionData.taskId}`)
          if (taskRes.ok) {
            setTask(await taskRes.json())
          }
        }
      } catch (e) {
        setError('Failed to load session')
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    // Auto-refresh for running sessions
    const interval = setInterval(() => {
      if (session?.status === 'running') {
        fetchData()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [resolvedParams.id, session?.status])

  async function handleCancel() {
    if (!session || cancelling) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', signal: 'SIGTERM' }),
      })
      if (res.ok) {
        setSession(await res.json())
      }
    } catch (e) {
      // ignore
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{error || 'Session not found'}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/sessions">Back to Sessions</Link>
          </Button>
        </div>
      </div>
    )
  }

  const config = statusConfig[session.status] || statusConfig.running
  const StatusIcon = config.icon
  const isRunning = session.status === 'running'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sessions">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Sessions
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Session #{session.id}</h1>
            <p className="text-sm text-muted-foreground">{session.agentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
            >
              <Square className="h-4 w-4 mr-2" />
              {cancelling ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
          <Badge variant={config.variant} className="gap-1 text-sm px-3 py-1">
            <StatusIcon className="h-4 w-4" />
            {config.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Started
                </span>
                <span className="font-mono">{formatDateTime(session.startedAt)}</span>
              </div>
              {session.completedAt ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </span>
                  <span className="font-mono">{formatDateTime(session.completedAt)}</span>
                </div>
              ) : isRunning && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-yellow-600 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running
                  </span>
                  <span className="font-mono text-yellow-600">{getElapsedTime(session.startedAt)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-mono">
                  {isRunning ? getElapsedTime(session.startedAt) : formatDuration(session.durationMs)}
                </span>
              </div>
              {session.exitCode !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Exit Code</span>
                  <span className={`font-mono ${session.exitCode === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {session.exitCode}
                  </span>
                </div>
              )}
              {session.signal && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Signal</span>
                  <span className="font-mono text-orange-600">{session.signal}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error */}
          {session.error && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="text-base text-red-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm font-mono bg-red-50 dark:bg-red-950/30 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                  {session.error}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Git Info */}
          {(session.branchName || session.prUrl) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Git
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.branchName && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Branch</span>
                    <span className="font-mono">{session.branchName}</span>
                  </div>
                )}
                {session.prUrl && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pull Request</span>
                    <a
                      href={session.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View PR <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {session.worktreePath && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Worktree</span>
                    <span className="font-mono text-xs truncate max-w-[300px]">{session.worktreePath}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* DoD & Review */}
          {(session.dodResult || session.reviewStatus) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Definition of Done & Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.dodResult && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">DoD Result</span>
                    <Badge variant={session.dodResult === 'passed' ? 'success' : 'destructive'}>
                      {session.dodResult}
                    </Badge>
                  </div>
                )}
                {session.reviewStatus && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Review Status</span>
                      <Badge variant={
                        session.reviewStatus === 'approved' ? 'success' :
                        session.reviewStatus === 'rejected' ? 'destructive' : 'secondary'
                      }>
                        {session.reviewStatus}
                      </Badge>
                    </div>
                    {session.reviewedBy && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Reviewed By</span>
                        <span>{session.reviewedBy}</span>
                      </div>
                    )}
                    {session.reviewedAt && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Reviewed At</span>
                        <span className="font-mono">{formatDateTime(session.reviewedAt)}</span>
                      </div>
                    )}
                    {session.reviewComment && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground mb-1">Review Comment</p>
                        <p className="text-sm">{session.reviewComment}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Task Info */}
          {task && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Related Task</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/tasks/${task.id}`}
                  className="block p-3 rounded border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">#{task.id}</span>
                  </div>
                  <p className="font-medium text-sm truncate">{task.title}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {task.status}
                  </Badge>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Session Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session ID</span>
                <span className="font-mono">{session.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent</span>
                <span>{session.agentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Task ID</span>
                <span className="font-mono">{session.taskId || '-'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
