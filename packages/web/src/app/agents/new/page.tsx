'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react'

export default function NewAgentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [client, setClient] = useState('claude-code')
  const [model, setModel] = useState('sonnet')
  const [promptContent, setPromptContent] = useState('')
  const [writePaths, setWritePaths] = useState<string[]>([])
  const [excludePaths, setExcludePaths] = useState<string[]>([])
  const [dodCommands, setDodCommands] = useState<string[]>([])
  const [newWritePath, setNewWritePath] = useState('')
  const [newExcludePath, setNewExcludePath] = useState('')
  const [newDodCommand, setNewDodCommand] = useState('')

  function addWritePath() {
    if (newWritePath.trim() && !writePaths.includes(newWritePath.trim())) {
      setWritePaths([...writePaths, newWritePath.trim()])
      setNewWritePath('')
    }
  }

  function addExcludePath() {
    if (newExcludePath.trim() && !excludePaths.includes(newExcludePath.trim())) {
      setExcludePaths([...excludePaths, newExcludePath.trim()])
      setNewExcludePath('')
    }
  }

  function addDodCommand() {
    if (newDodCommand.trim() && !dodCommands.includes(newDodCommand.trim())) {
      setDodCommands([...dodCommands, newDodCommand.trim()])
      setNewDodCommand('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          client,
          model,
          promptContent: promptContent.trim() || null,
          scope: {
            write: writePaths,
            exclude: excludePaths,
          },
          dod: dodCommands,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create agent')
      }

      const agent = await res.json()
      router.push(`/agents/${agent.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/agents">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Agents
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create New Agent</CardTitle>
          <CardDescription>Configure an AI agent for task execution</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., coder, reviewer, refactor-bot"
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this agent does..."
                disabled={loading}
              />
            </div>

            {/* Client & Model */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  disabled={loading}
                >
                  <option value="claude-code">Claude Code</option>
                  <option value="codex">Codex CLI</option>
                  <option value="gemini-cli">Gemini CLI</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={loading}
                >
                  <option value="opus">Opus</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="haiku">Haiku</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="o3">o3</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                </select>
              </div>
            </div>

            {/* Prompt Content */}
            <div className="space-y-2">
              <label className="text-sm font-medium">System Prompt</label>
              <textarea
                className="w-full min-h-[120px] px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                placeholder="Instructions and context for the agent..."
                disabled={loading}
              />
            </div>

            {/* Write Scope */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Write Scope (allowed paths)</label>
              <div className="flex gap-2">
                <Input
                  value={newWritePath}
                  onChange={(e) => setNewWritePath(e.target.value)}
                  placeholder="e.g., src/**, packages/core/**"
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addWritePath())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addWritePath} disabled={loading}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {writePaths.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {writePaths.map((path) => (
                    <span
                      key={path}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded"
                    >
                      {path}
                      <button type="button" onClick={() => setWritePaths(writePaths.filter(p => p !== path))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Exclude Scope */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Exclude Scope (forbidden paths)</label>
              <div className="flex gap-2">
                <Input
                  value={newExcludePath}
                  onChange={(e) => setNewExcludePath(e.target.value)}
                  placeholder="e.g., .env, secrets/**, *.key"
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludePath())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addExcludePath} disabled={loading}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {excludePaths.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {excludePaths.map((path) => (
                    <span
                      key={path}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded"
                    >
                      {path}
                      <button type="button" onClick={() => setExcludePaths(excludePaths.filter(p => p !== path))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* DoD Commands */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Definition of Done (verification commands)</label>
              <div className="flex gap-2">
                <Input
                  value={newDodCommand}
                  onChange={(e) => setNewDodCommand(e.target.value)}
                  placeholder="e.g., pnpm build, pnpm test, pnpm lint"
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDodCommand())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addDodCommand} disabled={loading}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {dodCommands.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {dodCommands.map((cmd) => (
                    <span
                      key={cmd}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-mono"
                    >
                      {cmd}
                      <button type="button" onClick={() => setDodCommands(dodCommands.filter(c => c !== cmd))}>
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
                <Link href="/agents">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Agent
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
