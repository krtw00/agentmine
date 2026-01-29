'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  AlertCircle,
  Brain,
  FileText,
  Archive,
  Filter,
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

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  })
}

function MemoryContent() {
  const searchParams = useSearchParams()
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || '')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '')

  useEffect(() => {
    async function fetchMemories() {
      try {
        let url = '/api/memories'
        const params = new URLSearchParams()
        if (categoryFilter) params.set('category', categoryFilter)
        if (statusFilter) params.set('status', statusFilter)
        if (params.toString()) url += '?' + params.toString()

        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch')
        setMemories(await res.json())
      } catch (e) {
        setError('Failed to load memories')
      } finally {
        setLoading(false)
      }
    }
    fetchMemories()
  }, [categoryFilter, statusFilter])

  // Get all memories for category counts
  const [allMemories, setAllMemories] = useState<Memory[]>([])
  useEffect(() => {
    if (!categoryFilter && !statusFilter) {
      setAllMemories(memories)
    } else {
      fetch('/api/memories').then(r => r.json()).then(setAllMemories).catch(() => {})
    }
  }, [memories, categoryFilter, statusFilter])

  const categoryCounts = allMemories.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
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
          <h1 className="text-2xl font-bold">Memory Bank</h1>
          <p className="text-sm text-muted-foreground">
            {allMemories.length} memor{allMemories.length !== 1 ? 'ies' : 'y'} stored
          </p>
        </div>
        <Button asChild>
          <Link href="/memory/new">
            <Plus className="h-4 w-4 mr-2" />
            New Memory
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Category:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryFilter === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter('')}
          >
            All ({allMemories.length})
          </Button>
          {Object.entries(categoryConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={categoryFilter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(categoryFilter === key ? '' : key)}
            >
              {config.label} ({categoryCounts[key] || 0})
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {Object.entries(statusConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={statusFilter === key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className="text-xs"
            >
              {key === 'archived' && <Archive className="h-3 w-3 mr-1" />}
              {config.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Memories Grid */}
      {memories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No memories found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a memory to store project knowledge
            </p>
            <Button className="mt-4" asChild>
              <Link href="/memory/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Memory
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {memories.map((memory) => {
            const catConfig = categoryConfig[memory.category] || { label: memory.category, color: 'bg-gray-100 text-gray-700' }
            const statConfig = statusConfig[memory.status] || statusConfig.active
            return (
              <Link key={memory.id} href={`/memory/${memory.id}`}>
                <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${catConfig.color}`}>
                            {catConfig.label}
                          </span>
                          <Badge variant={statConfig.variant} className="text-xs">
                            {statConfig.label}
                          </Badge>
                        </div>
                        <CardTitle className="text-base truncate">{memory.title}</CardTitle>
                      </div>
                      <span className="text-xs text-muted-foreground">v{memory.version}</span>
                    </div>
                    {memory.summary && (
                      <CardDescription className="line-clamp-2">
                        {memory.summary}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {memory.tags && memory.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {memory.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {memory.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{memory.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {memory.content.length} chars
                        </span>
                        <span>Updated {formatDate(memory.updatedAt)}</span>
                      </div>
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

export default function MemoryPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    }>
      <MemoryContent />
    </Suspense>
  )
}
