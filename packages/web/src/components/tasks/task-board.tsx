'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  AlertCircle,
  GripVertical,
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

type GroupAxis = 'status' | 'priority' | 'label' | 'assignee'

interface ColumnConfig {
  id: string
  label: string
  color?: string
}

const statusColumns: ColumnConfig[] = [
  { id: 'open', label: 'Open', color: 'bg-gray-500' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
  { id: 'done', label: 'Done', color: 'bg-green-500' },
  { id: 'failed', label: 'Failed', color: 'bg-red-500' },
  { id: 'cancelled', label: 'Cancelled', color: 'bg-gray-400' },
]

const priorityColumns: ColumnConfig[] = [
  { id: 'critical', label: 'Critical', color: 'bg-red-500' },
  { id: 'high', label: 'High', color: 'bg-orange-500' },
  { id: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { id: 'low', label: 'Low', color: 'bg-gray-500' },
]

const defaultLabelColumns: ColumnConfig[] = [
  { id: 'blocked', label: 'Blocked', color: 'bg-red-500' },
  { id: 'needs_review', label: 'Needs Review', color: 'bg-purple-500' },
  { id: 'ready', label: 'Ready', color: 'bg-green-500' },
  { id: 'candidate', label: 'Candidate', color: 'bg-blue-500' },
  { id: 'on_hold', label: 'On Hold', color: 'bg-gray-500' },
  { id: '_none', label: 'No Label', color: 'bg-gray-400' },
]

const statusIcons: Record<string, React.ElementType> = {
  open: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  failed: XCircle,
  dod_failed: AlertCircle,
  cancelled: Ban,
}

const priorityColors: Record<string, string> = {
  critical: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  high: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
  medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
  low: 'text-gray-600 bg-gray-100 dark:bg-gray-900/30',
}

interface TaskCardProps {
  task: Task
  isDragging?: boolean
}

function TaskCard({ task, isDragging }: TaskCardProps) {
  const StatusIcon = statusIcons[task.status] || Circle

  return (
    <Card
      className={`cursor-pointer transition-all ${
        isDragging ? 'opacity-50 shadow-lg rotate-2' : 'hover:shadow-md'
      }`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">#{task.id}</span>
              <StatusIcon className="h-3 w-3 text-muted-foreground" />
            </div>
            <Link href={`/tasks/${task.id}`} className="hover:underline">
              <h4 className="text-sm font-medium truncate">{task.title}</h4>
            </Link>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  priorityColors[task.priority] || priorityColors.medium
                }`}
              >
                {task.priority}
              </span>
              {task.assigneeName && (
                <span className="text-xs text-muted-foreground truncate">
                  {task.assigneeType === 'ai' ? '🤖' : '👤'} {task.assigneeName}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface SortableTaskCardProps {
  task: Task
}

function SortableTaskCard({ task }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  )
}

interface BoardColumnProps {
  column: ColumnConfig
  tasks: Task[]
  isDropDisabled?: boolean
}

function BoardColumn({ column, tasks, isDropDisabled }: BoardColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2 h-2 rounded-full ${column.color}`} />
        <h3 className="font-medium text-sm">{column.label}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {tasks.length}
        </Badge>
      </div>
      <div
        className={`flex-1 space-y-2 p-2 rounded-lg min-h-[200px] ${
          isDropDisabled ? 'bg-muted/30' : 'bg-muted/50'
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No tasks
          </div>
        )}
      </div>
    </div>
  )
}

interface TaskBoardProps {
  tasks: Task[]
  onTaskUpdate?: (taskId: number, updates: Partial<Task>) => Promise<void>
}

export function TaskBoard({ tasks, onTaskUpdate }: TaskBoardProps) {
  const [groupAxis, setGroupAxis] = useState<GroupAxis>('status')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const columns = useMemo(() => {
    switch (groupAxis) {
      case 'status':
        return statusColumns
      case 'priority':
        return priorityColumns
      case 'label':
        return defaultLabelColumns
      case 'assignee':
        const assignees = new Set<string>()
        tasks.forEach((t) => {
          if (t.assigneeName) assignees.add(t.assigneeName)
        })
        const assigneeColumns: ColumnConfig[] = Array.from(assignees).map((name) => ({
          id: name,
          label: name,
          color: 'bg-blue-500',
        }))
        assigneeColumns.push({ id: '_unassigned', label: 'Unassigned', color: 'bg-gray-400' })
        return assigneeColumns
      default:
        return statusColumns
    }
  }, [groupAxis, tasks])

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    columns.forEach((col) => {
      groups[col.id] = []
    })

    tasks.forEach((task) => {
      let key: string
      switch (groupAxis) {
        case 'status':
          key = task.status
          break
        case 'priority':
          key = task.priority
          break
        case 'label':
          key = task.labels.length > 0 ? task.labels[0] : '_none'
          break
        case 'assignee':
          key = task.assigneeName || '_unassigned'
          break
        default:
          key = task.status
      }
      if (groups[key]) {
        groups[key].push(task)
      } else if (groups['_none']) {
        groups['_none'].push(task)
      } else if (groups['_unassigned']) {
        groups['_unassigned'].push(task)
      }
    })

    return groups
  }, [tasks, groupAxis, columns])

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event

    if (!over || !onTaskUpdate) return

    const taskId = active.id as number
    const targetColumnId = findColumnForPosition(over.id as string | number)

    if (!targetColumnId) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // statusの場合はドラッグで変更不可（AI担当タスクのため）
    if (groupAxis === 'status') return

    const updates: Partial<Task> = {}
    switch (groupAxis) {
      case 'priority':
        updates.priority = targetColumnId
        break
      case 'label':
        if (targetColumnId === '_none') {
          updates.labels = []
        } else {
          updates.labels = [targetColumnId]
        }
        break
      case 'assignee':
        if (targetColumnId === '_unassigned') {
          updates.assigneeName = null
          updates.assigneeType = null
        } else {
          updates.assigneeName = targetColumnId
        }
        break
    }

    if (Object.keys(updates).length > 0) {
      await onTaskUpdate(taskId, updates)
    }
  }

  const findColumnForPosition = (id: string | number): string | null => {
    // Check if the id is a column id
    const column = columns.find((c) => c.id === id)
    if (column) return column.id

    // Check if the id is a task id within a column
    for (const [columnId, columnTasks] of Object.entries(groupedTasks)) {
      if (columnTasks.some((t) => t.id === id)) {
        return columnId
      }
    }
    return null
  }

  const isDropDisabled = groupAxis === 'status'

  return (
    <div className="space-y-4">
      {/* Axis Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Group by:</span>
        <div className="flex gap-1">
          {(['status', 'priority', 'label', 'assignee'] as GroupAxis[]).map((axis) => (
            <Button
              key={axis}
              variant={groupAxis === axis ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupAxis(axis)}
            >
              {axis.charAt(0).toUpperCase() + axis.slice(1)}
            </Button>
          ))}
        </div>
        {isDropDisabled && (
          <span className="text-xs text-muted-foreground ml-2">
            (Status changes are determined by AI execution)
          </span>
        )}
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={groupedTasks[column.id] || []}
              isDropDisabled={isDropDisabled}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
