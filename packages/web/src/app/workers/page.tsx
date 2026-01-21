'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Play,
  Square,
  AlertCircle,
  RefreshCw,
  Clock,
  Cpu,
  Plus,
  Loader2,
} from 'lucide-react'

interface Worker {
  id: number
  taskId: number | null
  agentName: string
  status: string
  startedAt: string | null
  worktreePath: string | null
  branchName: string | null
}

interface Task {
  id: number
  title: string
  status: string
  priority: string
  type: string
}

interface Agent {
  id: number
  name: string
  description: string | null
  client: string
  model: string
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

function WorkersContent() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [selectedAgentName, setSelectedAgentName] = useState<string>('')
  const [starting, setStarting] = useState(false)
  const [stoppingId, setStoppingId] = useState<number | null>(null)
  const [elapsedKey, setElapsedKey] = useState(0)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch active workers
        const workersRes = await fetch('/api/workers')
        if (!workersRes.ok) throw new Error('Failed to fetch workers')
        setWorkers(await workersRes.json())

        // Fetch available tasks (open, failed, dod_failed status)
        const tasksRes = await fetch('/api/tasks')
        if (tasksRes.ok) {
          const allTasks = await tasksRes.json()
          setAvailableTasks(
            allTasks.filter((t: Task) =>
              ['open', 'failed', 'dod_failed'].includes(t.status)
            )
          )
        }

        // Fetch agents
        const agentsRes = await fetch('/api/agents')
        if (agentsRes.ok) {
          setAgents(await agentsRes.json())
        }
      } catch (e) {
        setError('Failed to load workers')
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    // Auto-refresh every 3 seconds
    const interval = setInterval(() => {
      fetchData()
      setElapsedKey(k => k + 1)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  async function handleStartWorker() {
    if (!selectedTaskId || !selectedAgentName) return
    setStarting(true)
    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: parseInt(selectedTaskId, 10),
          agentName: selectedAgentName,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start worker')
      }
      // Refresh workers list
      const workersRes = await fetch('/api/workers')
      if (workersRes.ok) {
        setWorkers(await workersRes.json())
      }
      setDialogOpen(false)
      setSelectedTaskId('')
      setSelectedAgentName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start worker')
    } finally {
      setStarting(false)
    }
  }

  async function handleStopWorker(sessionId: number) {
    setStoppingId(sessionId)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', signal: 'SIGTERM' }),
      })
      if (res.ok) {
        // Refresh workers list
        const workersRes = await fetch('/api/workers')
        if (workersRes.ok) {
          setWorkers(await workersRes.json())
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setStoppingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
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
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workers</h1>
          <p className="text-sm text-muted-foreground">
            {workers.length} active worker{workers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={availableTasks.length === 0 || agents.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Start Worker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Worker</DialogTitle>
              <DialogDescription>
                Select a task and agent to start a new worker
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Task</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                >
                  <option value="">Select a task...</option>
                  {availableTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      #{task.id} - {task.title} ({task.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedAgentName}
                  onChange={(e) => setSelectedAgentName(e.target.value)}
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.name}>
                      {agent.name} ({agent.client}/{agent.model})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStartWorker}
                disabled={!selectedTaskId || !selectedAgentName || starting}
              >
                {starting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Start
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info cards */}
      {(availableTasks.length === 0 || agents.length === 0) && (
        <Card className="border-yellow-200 dark:border-yellow-900">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                {availableTasks.length === 0 && 'No tasks available. Create a task first.'}
                {availableTasks.length > 0 && agents.length === 0 && 'No agents configured. Create an agent first.'}
              </span>
              {availableTasks.length === 0 && (
                <Button variant="link" size="sm" className="p-0 h-auto" asChild>
                  <Link href="/tasks/new">Create Task</Link>
                </Button>
              )}
              {availableTasks.length > 0 && agents.length === 0 && (
                <Button variant="link" size="sm" className="p-0 h-auto" asChild>
                  <Link href="/agents">Manage Agents</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workers List */}
      {workers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Cpu className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No active workers</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start a worker to begin processing tasks
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workers.map((worker) => (
            <Card key={worker.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Worker #{worker.id}</CardTitle>
                  <Badge variant="warning" className="gap-1">
                    <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    Running
                  </Badge>
                </div>
                <CardDescription>{worker.agentName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {worker.taskId && (
                  <Link
                    href={`/tasks/${worker.taskId}`}
                    className="block p-2 rounded border text-sm hover:bg-accent/50 transition-colors"
                  >
                    Task #{worker.taskId}
                  </Link>
                )}

                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Started
                    </span>
                    <span className="font-mono">{formatDateTime(worker.startedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Elapsed
                    </span>
                    <span key={elapsedKey} className="font-mono text-yellow-600">
                      {getElapsedTime(worker.startedAt)}
                    </span>
                  </div>
                </div>

                {worker.branchName && (
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {worker.branchName}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/sessions/${worker.id}`}>
                      <Play className="h-3 w-3 mr-1" />
                      View
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleStopWorker(worker.id)}
                    disabled={stoppingId === worker.id}
                  >
                    {stoppingId === worker.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Square className="h-3 w-3 mr-1" />
                    )}
                    Stop
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function WorkersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    }>
      <WorkersContent />
    </Suspense>
  )
}
