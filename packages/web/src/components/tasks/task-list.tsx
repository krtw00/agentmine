'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  AlertCircle,
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
  createdAt: string | null
  updatedAt: string | null
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

const typeConfig: Record<string, { label: string; className: string }> = {
  task: { label: 'Task', className: 'text-blue-600' },
  feature: { label: 'Feature', className: 'text-purple-600' },
  bug: { label: 'Bug', className: 'text-red-600' },
  refactor: { label: 'Refactor', className: 'text-green-600' },
}

function TaskStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.open
  const Icon = config.icon
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

function TaskPriorityBadge({ priority }: { priority: string }) {
  const config = priorityConfig[priority] || priorityConfig.medium
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  })
}

interface TaskListProps {
  tasks: Task[]
}

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No tasks match your filters.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Link key={task.id} href={`/tasks/${task.id}`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">#{task.id}</span>
                    <span className={`text-xs font-medium ${typeConfig[task.type]?.className || ''}`}>
                      {typeConfig[task.type]?.label || task.type}
                    </span>
                  </div>
                  <h3 className="font-medium truncate">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    {task.assigneeName && (
                      <span>
                        {task.assigneeType === 'ai' ? '🤖' : '👤'} {task.assigneeName}
                      </span>
                    )}
                    <span>Updated {formatDate(task.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <TaskStatusBadge status={task.status} />
                  <TaskPriorityBadge priority={task.priority} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
