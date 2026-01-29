'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  ArrowLeft,
  AlertCircle,
  Brain,
  Edit,
  Trash2,
  Loader2,
  FileText,
  Tag,
  Clock,
} from 'lucide-react'

interface Memory {
  id: number
  category: string
  title: string
  summary: string | null
  content: string
  status: string
  tags: string[]
  version: number
  relatedTaskId: number | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  architecture: { label: 'Architecture', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  convention: { label: 'Convention', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  tooling: { label: 'Tooling', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rule: { label: 'Rule', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  decision: { label: 'Decision', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  draft: { label: 'Draft', variant: 'secondary' },
  archived: { label: 'Archived', variant: 'outline' },
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

export default function MemoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [memory, setMemory] = useState<Memory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchMemory() {
      try {
        const res = await fetch(`/api/memories/${resolvedParams.id}`)
        if (!res.ok) throw new Error('Memory not found')
        setMemory(await res.json())
      } catch (e) {
        setError('Failed to load memory')
      } finally {
        setLoading(false)
      }
    }
    fetchMemory()
  }, [resolvedParams.id])

  async function handleDelete() {
    if (!memory) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/memories/${memory.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/memory')
      }
    } catch (e) {
      // ignore
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (error || !memory) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{error || 'Memory not found'}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/memory">Back to Memory Bank</Link>
          </Button>
        </div>
      </div>
    )
  }

  const catConfig = categoryConfig[memory.category] || { label: memory.category, color: 'bg-gray-100 text-gray-700' }
  const statConfig = statusConfig[memory.status] || statusConfig.active

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/memory">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Memory Bank
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${catConfig.color}`}>
                {catConfig.label}
              </span>
              <Badge variant={statConfig.variant}>{statConfig.label}</Badge>
              <span className="text-xs text-muted-foreground">v{memory.version}</span>
            </div>
            <h1 className="text-2xl font-bold">{memory.title}</h1>
            {memory.summary && (
              <p className="text-sm text-muted-foreground mt-1">{memory.summary}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/memory/${memory.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Memory</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{memory.title}&quot;? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded overflow-x-auto">
                  {memory.content}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Tags */}
          {memory.tags && memory.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {memory.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono">{memory.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span>{memory.version}</span>
              </div>
              {memory.createdBy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created By</span>
                  <span>{memory.createdBy}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-xs">{formatDateTime(memory.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="text-xs">{formatDateTime(memory.updatedAt)}</span>
              </div>
              {memory.relatedTaskId && (
                <div className="pt-2 border-t">
                  <Link
                    href={`/tasks/${memory.relatedTaskId}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Related Task #{memory.relatedTaskId}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
