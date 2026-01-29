'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Play,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  AlertCircle,
  RefreshCw,
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
  dodResult: string | null
  branchName: string | null
  prUrl: string | null
  worktreePath: string | null
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

function getElapsedTime(startedAt: string | null): string {
  if (!startedAt) return '-'
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - start) / 1000)

  if (elapsed < 60) return `${elapsed}s`
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
  return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`
}

function SessionsContent() {
  const searchParams = useSearchParams()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function fetchSessions() {
      try {
        const url = statusFilter ? `/api/sessions?status=${statusFilter}` : '/api/sessions'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json()
        setSessions(json)
      } catch (e) {
        setError('Failed to load sessions')
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()

    // Auto-refresh every 5 seconds for running sessions
    const interval = setInterval(() => {
      fetchSessions()
    }, 5000)

    return () => clearInterval(interval)
  }, [statusFilter, refreshKey])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { running: 0, completed: 0, failed: 0, cancelled: 0 }
    for (const session of sessions) {
      if (session.status in counts) {
        counts[session.status]++
      }
    }
    return counts
  }, [sessions])

  // Re-count from all sessions for accurate filter counts
  const [allSessions, setAllSessions] = useState<Session[]>([])
  useEffect(() => {
    if (!statusFilter) {
      setAllSessions(sessions)
    } else {
      fetch('/api/sessions').then(res => res.json()).then(setAllSessions).catch(() => {})
    }
  }, [sessions, statusFilter])

  const allStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { running: 0, completed: 0, failed: 0, cancelled: 0 }
    for (const session of allSessions) {
      if (session.status in counts) {
        counts[session.status]++
      }
    }
    return counts
  }, [allSessions])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => setRefreshKey(k => k + 1)}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={statusFilter === '' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('')}
        >
          All ({allSessions.length})
        </Button>
        {Object.entries(statusConfig).map(([key, config]) => {
          const Icon = config.icon
          return (
            <Button
              key={key}
              variant={statusFilter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className="gap-1"
            >
              <Icon className="h-3 w-3" />
              {config.label} ({allStatusCounts[key] || 0})
            </Button>
          )
        })}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {statusFilter ? `No ${statusFilter} sessions found.` : 'No sessions yet. Start a worker to create a session.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const config = statusConfig[session.status] || statusConfig.running
            const StatusIcon = config.icon
            const isRunning = session.status === 'running'

            return (
              <Link key={session.id} href={`/sessions/${session.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">#{session.id}</span>
                          <span className="text-sm text-muted-foreground">{session.agentName}</span>
                          {session.taskId && (
                            <span className="text-xs text-muted-foreground">
                              → Task #{session.taskId}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Started: {formatDateTime(session.startedAt)}
                          </span>
                          {isRunning ? (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                              Elapsed: {getElapsedTime(session.startedAt)}
                            </span>
                          ) : (
                            <span>Duration: {formatDuration(session.durationMs)}</span>
                          )}
                          {session.exitCode !== null && (
                            <span className={session.exitCode === 0 ? 'text-green-600' : 'text-red-600'}>
                              Exit: {session.exitCode}
                            </span>
                          )}
                          {session.dodResult && (
                            <Badge
                              variant={session.dodResult === 'passed' ? 'success' : 'destructive'}
                              className="text-xs"
                            >
                              DoD: {session.dodResult}
                            </Badge>
                          )}
                        </div>

                        {session.branchName && (
                          <div className="mt-2 text-xs text-muted-foreground font-mono truncate">
                            {session.branchName}
                          </div>
                        )}
                      </div>

                      <Badge variant={config.variant} className="gap-1 shrink-0">
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    }>
      <SessionsContent />
    </Suspense>
  )
}
