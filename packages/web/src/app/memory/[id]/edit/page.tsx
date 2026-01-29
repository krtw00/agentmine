'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Loader2, Plus, X, AlertCircle } from 'lucide-react'

// Dynamic import Monaco Editor to avoid SSR issues
const MarkdownEditor = dynamic(
  () => import('@/components/editor/monaco-editor').then((mod) => mod.MarkdownEditor),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> }
)

interface Memory {
  id: number
  category: string
  title: string
  summary: string | null
  content: string
  status: string
  tags: string[]
}

export default function EditMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [category, setCategory] = useState('architecture')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('active')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  useEffect(() => {
    async function fetchMemory() {
      try {
        const res = await fetch(`/api/memories/${resolvedParams.id}`)
        if (!res.ok) throw new Error('Memory not found')
        const memory: Memory = await res.json()

        setCategory(memory.category)
        setTitle(memory.title)
        setSummary(memory.summary || '')
        setContent(memory.content)
        setStatus(memory.status)
        setTags(memory.tags || [])
      } catch (e) {
        setFetchError('Failed to load memory')
      } finally {
        setLoading(false)
      }
    }
    fetchMemory()
  }, [resolvedParams.id])

  function addTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/memories/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          summary: summary.trim() || null,
          content: content.trim(),
          status,
          tags,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update memory')
      }

      router.push(`/memory/${resolvedParams.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[500px]" />
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
            <Link href="/memory">Back to Memory Bank</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href={`/memory/${resolvedParams.id}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Memory
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit Memory</CardTitle>
          <CardDescription>Update memory content</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
                {error}
              </div>
            )}

            {/* Category & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category *</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={saving}
                >
                  <option value="architecture">Architecture</option>
                  <option value="convention">Convention</option>
                  <option value="tooling">Tooling</option>
                  <option value="rule">Rule</option>
                  <option value="decision">Decision</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={saving}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Database Schema Design"
                disabled={saving}
              />
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Summary (for AI context)</label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief one-line summary..."
                disabled={saving}
              />
            </div>

            {/* Content with Monaco Editor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Content (Markdown) *</label>
              <div className="border rounded-lg overflow-hidden">
                <MarkdownEditor
                  value={content}
                  onChange={setContent}
                  height="300px"
                  readOnly={saving}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  disabled={saving}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag} disabled={saving}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-secondary rounded"
                    >
                      {tag}
                      <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" disabled={saving} asChild>
                <Link href={`/memory/${resolvedParams.id}`}>Cancel</Link>
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
