'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NewTaskPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('task')
  const [priority, setPriority] = useState('medium')
  const [assigneeType, setAssigneeType] = useState<'ai' | 'human' | ''>('')
  const [assigneeName, setAssigneeName] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          type,
          priority,
          assigneeType: assigneeType || null,
          assigneeName: assigneeName.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create task')
      }

      const task = await res.json()
      router.push(`/tasks/${task.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/tasks">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create New Task</CardTitle>
          <CardDescription>Add a new task for your AI agents or team members</CardDescription>
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
                disabled={loading}
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
                disabled={loading}
              />
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading || !assigneeType}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" disabled={loading} asChild>
                <Link href="/tasks">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
