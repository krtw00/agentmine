'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

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
}

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('task')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus] = useState('open')
  const [assigneeType, setAssigneeType] = useState<'ai' | 'human' | ''>('')
  const [assigneeName, setAssigneeName] = useState('')
  const [complexity, setComplexity] = useState<string>('')

  useEffect(() => {
    async function fetchTask() {
      try {
        const res = await fetch(`/api/tasks/${resolvedParams.id}`)
        if (!res.ok) throw new Error('Task not found')
        const task: Task = await res.json()

        setTitle(task.title)
        setDescription(task.description || '')
        setType(task.type)
        setPriority(task.priority)
        setStatus(task.status)
        setAssigneeType((task.assigneeType as 'ai' | 'human' | '') || '')
        setAssigneeName(task.assigneeName || '')
        setComplexity(task.complexity?.toString() || '')
      } catch (e) {
        setFetchError('Failed to load task')
      } finally {
        setLoading(false)
      }
    }
    fetchTask()
  }, [resolvedParams.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/tasks/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          type,
          priority,
          status,
          assigneeType: assigneeType || null,
          assigneeName: assigneeName.trim() || null,
          complexity: complexity ? parseInt(complexity, 10) : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update task')
      }

      router.push(`/tasks/${resolvedParams.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{fetchError}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/tasks">Back to Tasks</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href={`/tasks/${resolvedParams.id}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Task
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit Task #{resolvedParams.id}</CardTitle>
          <CardDescription>Update task details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
                {error}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                disabled={saving}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="w-full min-h-[120px] px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the task in detail..."
                disabled={saving}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={saving}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="failed">Failed</option>
                <option value="dod_failed">DoD Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={saving}
                >
                  <option value="task">Task</option>
                  <option value="feature">Feature</option>
                  <option value="bug">Bug</option>
                  <option value="refactor">Refactor</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={saving}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assignee Type</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={assigneeType}
                  onChange={(e) => setAssigneeType(e.target.value as '' | 'ai' | 'human')}
                  disabled={saving}
                >
                  <option value="">Unassigned</option>
                  <option value="ai">AI Agent</option>
                  <option value="human">Human</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assignee Name</label>
                <Input
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  placeholder={assigneeType === 'ai' ? 'e.g., coder' : 'e.g., John'}
                  disabled={saving || !assigneeType}
                />
              </div>
            </div>

            {/* Complexity */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Complexity (1-10)</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={complexity}
                onChange={(e) => setComplexity(e.target.value)}
                placeholder="Task complexity"
                disabled={saving}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" disabled={saving} asChild>
                <Link href={`/tasks/${resolvedParams.id}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
