'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronDown,
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  AlertCircle,
  Folder,
  File,
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

interface TreeNode {
  task: Task
  children: TreeNode[]
}

const statusIcons: Record<string, React.ElementType> = {
  open: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  failed: XCircle,
  dod_failed: AlertCircle,
  cancelled: Ban,
}

const statusColors: Record<string, string> = {
  open: 'text-gray-500',
  in_progress: 'text-yellow-500',
  done: 'text-green-500',
  failed: 'text-red-500',
  dod_failed: 'text-red-500',
  cancelled: 'text-gray-400',
}

const priorityColors: Record<string, string> = {
  critical: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  high: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
  medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
  low: 'text-gray-600 bg-gray-100 dark:bg-gray-900/30',
}

interface TreeNodeComponentProps {
  node: TreeNode
  level: number
  expandedIds: Set<number>
  onToggle: (id: number) => void
}

function TreeNodeComponent({ node, level, expandedIds, onToggle }: TreeNodeComponentProps) {
  const { task, children } = node
  const hasChildren = children.length > 0
  const isExpanded = expandedIds.has(task.id)
  const StatusIcon = statusIcons[task.status] || Circle
  const statusColor = statusColors[task.status] || 'text-gray-500'

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-accent/50 transition-colors group"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {/* Expand/Collapse Button */}
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${!hasChildren ? 'invisible' : ''}`}
          onClick={() => onToggle(task.id)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        {/* Icon */}
        {hasChildren ? (
          <Folder className="h-4 w-4 text-muted-foreground" />
        ) : (
          <File className="h-4 w-4 text-muted-foreground" />
        )}

        {/* Status Icon */}
        <StatusIcon className={`h-4 w-4 ${statusColor}`} />

        {/* Task ID */}
        <span className="text-xs text-muted-foreground">#{task.id}</span>

        {/* Title */}
        <Link
          href={`/tasks/${task.id}`}
          className="flex-1 truncate hover:underline font-medium"
        >
          {task.title}
        </Link>

        {/* Priority Badge */}
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            priorityColors[task.priority] || priorityColors.medium
          }`}
        >
          {task.priority}
        </span>

        {/* Assignee */}
        {task.assigneeName && (
          <span className="text-xs text-muted-foreground">
            {task.assigneeType === 'ai' ? '🤖' : '👤'} {task.assigneeName}
          </span>
        )}

        {/* Children Count */}
        {hasChildren && (
          <Badge variant="secondary" className="text-xs">
            {children.length}
          </Badge>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <TreeNodeComponent
              key={child.task.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface TaskHierarchyProps {
  tasks: Task[]
}

export function TaskHierarchy({ tasks }: TaskHierarchyProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [showOrphans, setShowOrphans] = useState(true)

  const tree = useMemo(() => {
    const taskMap = new Map<number, Task>()
    const childrenMap = new Map<number, Task[]>()
    const rootTasks: Task[] = []

    // Build maps
    tasks.forEach((task) => {
      taskMap.set(task.id, task)
      if (task.parentId === null) {
        rootTasks.push(task)
      } else {
        const siblings = childrenMap.get(task.parentId) || []
        siblings.push(task)
        childrenMap.set(task.parentId, siblings)
      }
    })

    // Find orphans (tasks with parentId that doesn't exist)
    const orphans: Task[] = []
    tasks.forEach((task) => {
      if (task.parentId !== null && !taskMap.has(task.parentId)) {
        orphans.push(task)
      }
    })

    // Build tree recursively
    function buildNode(task: Task): TreeNode {
      const children = childrenMap.get(task.id) || []
      return {
        task,
        children: children
          .sort((a, b) => a.id - b.id)
          .map((child) => buildNode(child)),
      }
    }

    const rootNodes = rootTasks
      .sort((a, b) => a.id - b.id)
      .map((task) => buildNode(task))

    return { rootNodes, orphans }
  }, [tasks])

  const handleToggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExpandAll = () => {
    const allIds = new Set<number>()
    function collectIds(nodes: TreeNode[]) {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          allIds.add(node.task.id)
          collectIds(node.children)
        }
      })
    }
    collectIds(tree.rootNodes)
    setExpandedIds(allIds)
  }

  const handleCollapseAll = () => {
    setExpandedIds(new Set())
  }

  const hasParentChild = tree.rootNodes.some((node) => node.children.length > 0)

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No tasks yet.</p>
        </CardContent>
      </Card>
    )
  }

  if (!hasParentChild && tree.orphans.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">
            No parent-child relationships found.
          </p>
          <p className="text-sm text-muted-foreground">
            Create subtasks by setting a parent task when creating or editing tasks.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExpandAll}>
          Expand All
        </Button>
        <Button variant="outline" size="sm" onClick={handleCollapseAll}>
          Collapse All
        </Button>
        {tree.orphans.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOrphans(!showOrphans)}
          >
            {showOrphans ? 'Hide' : 'Show'} Orphans ({tree.orphans.length})
          </Button>
        )}
      </div>

      {/* Tree */}
      <Card>
        <CardContent className="p-2">
          {tree.rootNodes.map((node) => (
            <TreeNodeComponent
              key={node.task.id}
              node={node}
              level={0}
              expandedIds={expandedIds}
              onToggle={handleToggle}
            />
          ))}
        </CardContent>
      </Card>

      {/* Orphans */}
      {showOrphans && tree.orphans.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Orphan Tasks (parent not found)
          </h3>
          <Card>
            <CardContent className="p-2">
              {tree.orphans.map((task) => (
                <TreeNodeComponent
                  key={task.id}
                  node={{ task, children: [] }}
                  level={0}
                  expandedIds={expandedIds}
                  onToggle={handleToggle}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
