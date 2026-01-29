'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Loader2, Plus, X, AlertCircle, Code, FormInput } from 'lucide-react'

// Dynamic import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@/components/editor/monaco-editor').then((mod) => mod.MonacoEditor),
  { ssr: false, loading: () => <Skeleton className="h-[200px]" /> }
)

const YamlEditor = dynamic(
  () => import('@/components/editor/monaco-editor').then((mod) => mod.YamlEditor),
  { ssr: false, loading: () => <Skeleton className="h-[400px]" /> }
)

interface Agent {
  id: number
  name: string
  description: string | null
  client: string
  model: string
  scope: { write?: string[]; exclude?: string[]; read?: string[] }
  promptContent: string | null
  dod: string[]
}

type EditMode = 'form' | 'yaml'

function agentToYaml(agent: Partial<Agent>): string {
  const yaml = `name: ${agent.name || ''}
description: ${agent.description || ''}
client: ${agent.client || 'claude-code'}
model: ${agent.model || 'sonnet'}
scope:
  write:
${(agent.scope?.write || []).map((p) => `    - ${p}`).join('\n') || '    # - src/**'}
  exclude:
${(agent.scope?.exclude || []).map((p) => `    - ${p}`).join('\n') || '    # - .env'}
dod:
${(agent.dod || []).map((c) => `  - ${c}`).join('\n') || '  # - pnpm build'}
promptContent: |
${(agent.promptContent || '').split('\n').map((l) => `  ${l}`).join('\n') || '  # System prompt content here'}`
  return yaml
}

function yamlToAgent(yaml: string): Partial<Agent> {
  const lines = yaml.split('\n')
  const result: Partial<Agent> = {
    name: '',
    description: '',
    client: 'claude-code',
    model: 'sonnet',
    scope: { write: [], exclude: [] },
    dod: [],
    promptContent: '',
  }

  let currentSection = ''
  let currentSubSection = ''
  let promptLines: string[] = []
  let inPrompt = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (line.startsWith('name:')) {
      result.name = trimmed.replace('name:', '').trim()
    } else if (line.startsWith('description:')) {
      result.description = trimmed.replace('description:', '').trim()
    } else if (line.startsWith('client:')) {
      result.client = trimmed.replace('client:', '').trim()
    } else if (line.startsWith('model:')) {
      result.model = trimmed.replace('model:', '').trim()
    } else if (line.startsWith('scope:')) {
      currentSection = 'scope'
    } else if (line.startsWith('  write:')) {
      currentSubSection = 'write'
    } else if (line.startsWith('  exclude:')) {
      currentSubSection = 'exclude'
    } else if (line.startsWith('dod:')) {
      currentSection = 'dod'
      currentSubSection = ''
    } else if (line.startsWith('promptContent:')) {
      inPrompt = true
      currentSection = ''
      currentSubSection = ''
    } else if (inPrompt && line.startsWith('  ')) {
      promptLines.push(line.slice(2))
    } else if (trimmed.startsWith('- ') && !trimmed.startsWith('# ')) {
      const value = trimmed.slice(2).trim()
      if (currentSection === 'scope' && currentSubSection === 'write') {
        result.scope!.write!.push(value)
      } else if (currentSection === 'scope' && currentSubSection === 'exclude') {
        result.scope!.exclude!.push(value)
      } else if (currentSection === 'dod') {
        result.dod!.push(value)
      }
    }
  }

  result.promptContent = promptLines.join('\n')
  return result
}

export default function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<EditMode>('form')

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
  const [yamlContent, setYamlContent] = useState('')

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${resolvedParams.id}`)
        if (!res.ok) throw new Error('Agent not found')
        const agent: Agent = await res.json()

        setName(agent.name)
        setDescription(agent.description || '')
        setClient(agent.client)
        setModel(agent.model)
        setPromptContent(agent.promptContent || '')
        setWritePaths(agent.scope?.write || [])
        setExcludePaths(agent.scope?.exclude || [])
        setDodCommands(agent.dod || [])
        setYamlContent(agentToYaml(agent))
      } catch (e) {
        setFetchError('Failed to load agent')
      } finally {
        setLoading(false)
      }
    }
    fetchAgent()
  }, [resolvedParams.id])

  function syncFormToYaml() {
    setYamlContent(agentToYaml({
      name,
      description,
      client,
      model,
      scope: { write: writePaths, exclude: excludePaths },
      dod: dodCommands,
      promptContent,
    }))
  }

  function syncYamlToForm() {
    const parsed = yamlToAgent(yamlContent)
    setName(parsed.name || '')
    setDescription(parsed.description || '')
    setClient(parsed.client || 'claude-code')
    setModel(parsed.model || 'sonnet')
    setWritePaths(parsed.scope?.write || [])
    setExcludePaths(parsed.scope?.exclude || [])
    setDodCommands(parsed.dod || [])
    setPromptContent(parsed.promptContent || '')
  }

  function handleModeChange(mode: EditMode) {
    if (mode === 'yaml' && editMode === 'form') {
      syncFormToYaml()
    } else if (mode === 'form' && editMode === 'yaml') {
      syncYamlToForm()
    }
    setEditMode(mode)
  }

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

    // Sync YAML to form if in YAML mode
    if (editMode === 'yaml') {
      syncYamlToForm()
    }

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const submitData = editMode === 'yaml' ? yamlToAgent(yamlContent) : {
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
      }

      const res = await fetch(`/api/agents/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update agent')
      }

      router.push(`/agents/${resolvedParams.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[600px]" />
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
            <Link href="/agents">Back to Agents</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href={`/agents/${resolvedParams.id}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Agent
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Edit Agent</CardTitle>
              <CardDescription>Update agent configuration</CardDescription>
            </div>
            {/* Mode Toggle */}
            <div className="flex border rounded-lg">
              <Button
                type="button"
                variant={editMode === 'form' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-r-none gap-2"
                onClick={() => handleModeChange('form')}
              >
                <FormInput className="h-4 w-4" />
                Form
              </Button>
              <Button
                type="button"
                variant={editMode === 'yaml' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-l-none gap-2"
                onClick={() => handleModeChange('yaml')}
              >
                <Code className="h-4 w-4" />
                YAML
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
                {error}
              </div>
            )}

            {editMode === 'yaml' ? (
              /* YAML Editor Mode */
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent Configuration (YAML)</label>
                <div className="border rounded-lg overflow-hidden">
                  <YamlEditor
                    value={yamlContent}
                    onChange={setYamlContent}
                    height="500px"
                    readOnly={saving}
                  />
                </div>
              </div>
            ) : (
              /* Form Mode */
              <>
                {/* Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., coder, reviewer, refactor-bot"
                    disabled={saving}
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
                    disabled={saving}
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
                      disabled={saving}
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
                      disabled={saving}
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

                {/* Prompt Content with Monaco Editor */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">System Prompt</label>
                  <div className="border rounded-lg overflow-hidden">
                    <MonacoEditor
                      value={promptContent}
                      onChange={setPromptContent}
                      language="markdown"
                      height="200px"
                      readOnly={saving}
                    />
                  </div>
                </div>

                {/* Write Scope */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Write Scope (allowed paths)</label>
                  <div className="flex gap-2">
                    <Input
                      value={newWritePath}
                      onChange={(e) => setNewWritePath(e.target.value)}
                      placeholder="e.g., src/**, packages/core/**"
                      disabled={saving}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addWritePath())}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addWritePath} disabled={saving}>
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
                      disabled={saving}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludePath())}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addExcludePath} disabled={saving}>
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
                      disabled={saving}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDodCommand())}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addDodCommand} disabled={saving}>
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
              </>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" disabled={saving} asChild>
                <Link href={`/agents/${resolvedParams.id}`}>Cancel</Link>
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
