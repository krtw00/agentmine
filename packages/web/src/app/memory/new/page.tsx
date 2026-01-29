'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react'

export default function NewMemoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState('architecture')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('active')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

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

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
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
        throw new Error(data.error || 'Failed to create memory')
      }

      const memory = await res.json()
      router.push(`/memory/${memory.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/memory">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Memory Bank
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create New Memory</CardTitle>
          <CardDescription>Store project knowledge for AI context</CardDescription>
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
                  disabled={loading}
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
                  disabled={loading}
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
                disabled={loading}
              />
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Summary (for AI context)</label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief one-line summary..."
                disabled={loading}
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Content (Markdown) *</label>
              <textarea
                className="w-full min-h-[200px] px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write memory content in Markdown..."
                disabled={loading}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag} disabled={loading}>
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
              <Button type="button" variant="outline" disabled={loading} asChild>
                <Link href="/memory">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Memory
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
