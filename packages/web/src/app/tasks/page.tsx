'use client'

import { useEffect, useState, useMemo, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskList } from '@/components/tasks/task-list'
import { TaskBoard } from '@/components/tasks/task-board'
import { TaskHierarchy } from '@/components/tasks/task-hierarchy'
import {
  Plus,
  Search,
  Filter,
  AlertCircle,
  List,
  LayoutGrid,
  GitBranch,
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
  parentId: number | null
  createdAt: string | null
  updatedAt: string | null
}

type ViewMode = 'list' | 'board' | 'hierarchy'

const statusConfig: Record<string, { label: string }> = {
  open: { label: 'Open' },
  in_progress: { label: 'In Progress' },
  done: { label: 'Done' },
  failed: { label: 'Failed' },
  dod_failed: { label: 'DoD Failed' },
  cancelled: { label: 'Cancelled' },
}

function TasksContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '')
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) || 'list'
  )

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setTasks(json)
    } catch (e) {
      setError('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', mode)
    router.push(`/tasks?${params.toString()}`, { scroll: false })
  }

  const handleTaskUpdate = useCallback(async (taskId: number, updates: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update')
      await fetchTasks()
    } catch (e) {
      console.error('Failed to update task:', e)
    }
  }, [fetchTasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (statusFilter && task.status !== statusFilter) {
        return false
      }
      return true
    })
  }, [tasks, searchQuery, statusFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const task of tasks) {
      counts[task.status] = (counts[task.status] || 0) + 1
    }
    return counts
  }, [tasks])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
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
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => handleViewChange('list')}
              title="List View"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none border-x"
              onClick={() => handleViewChange('board')}
              title="Board View"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'hierarchy' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => handleViewChange('hierarchy')}
              title="Hierarchy View"
            >
              <GitBranch className="h-4 w-4" />
            </Button>
          </div>
          <Button asChild>
            <Link href="/tasks/new">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters (only for list view) */}
      {viewMode === 'list' && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filter:</span>
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap gap-1">
            <Button
              variant={statusFilter === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('')}
            >
              All ({tasks.length})
            </Button>
            {Object.entries(statusConfig).map(([key, config]) => (
              <Button
                key={key}
                variant={statusFilter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              >
                {config.label} ({statusCounts[key] || 0})
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Task Views */}
      {tasks.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No tasks yet. Create your first task!</p>
            <Button asChild>
              <Link href="/tasks/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'list' && <TaskList tasks={filteredTasks} />}
          {viewMode === 'board' && (
            <TaskBoard tasks={filteredTasks} onTaskUpdate={handleTaskUpdate} />
          )}
          {viewMode === 'hierarchy' && <TaskHierarchy tasks={filteredTasks} />}
        </>
      )}
    </div>
  )
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    }>
      <TasksContent />
    </Suspense>
  )
}
