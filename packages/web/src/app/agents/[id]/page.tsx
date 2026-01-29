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
  Bot,
  Edit,
  Trash2,
  Terminal,
  Code,
  Sparkles,
  FileCode,
  Shield,
  CheckCircle,
  Loader2,
} from 'lucide-react'

interface Agent {
  id: number
  name: string
  description: string | null
  client: string
  model: string
  scope: { write?: string[]; exclude?: string[]; read?: string[] }
  config: Record<string, unknown>
  promptContent: string | null
  dod: string[]
  version: number
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

const clientIcons: Record<string, React.ElementType> = {
  'claude-code': Terminal,
  'codex': Code,
  'gemini-cli': Sparkles,
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

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${resolvedParams.id}`)
        if (!res.ok) throw new Error('Agent not found')
        setAgent(await res.json())
      } catch (e) {
        setError('Failed to load agent')
      } finally {
        setLoading(false)
      }
    }
    fetchAgent()
  }, [resolvedParams.id])

  async function handleDelete() {
    if (!agent) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/agents')
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
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{error || 'Agent not found'}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/agents">Back to Agents</Link>
          </Button>
        </div>
      </div>
    )
  }

  const ClientIcon = clientIcons[agent.client] || Bot

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/agents">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Agents
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <ClientIcon className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <Badge variant="outline">v{agent.version}</Badge>
            </div>
            {agent.description && (
              <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/agents/${agent.id}/edit`}>
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
                <DialogTitle>Delete Agent</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{agent.name}&quot;? This action cannot be undone.
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
        <div className="lg:col-span-2 space-y-4">
          {/* System Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                System Prompt
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agent.promptContent ? (
                <pre className="text-sm font-mono bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap">
                  {agent.promptContent}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No system prompt configured.</p>
              )}
            </CardContent>
          </Card>

          {/* Scope */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Scope Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2 text-green-600">Write Paths</h4>
                {agent.scope?.write && agent.scope.write.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {agent.scope.write.map((path) => (
                      <Badge key={path} variant="secondary" className="font-mono text-xs">
                        {path}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No write restrictions (full access)</p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2 text-red-600">Excluded Paths</h4>
                {agent.scope?.exclude && agent.scope.exclude.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {agent.scope.exclude.map((path) => (
                      <Badge key={path} variant="destructive" className="font-mono text-xs">
                        {path}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No exclusions configured</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* DoD */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Definition of Done
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agent.dod && agent.dod.length > 0 ? (
                <div className="space-y-2">
                  {agent.dod.map((cmd, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <code className="flex-1 px-2 py-1 bg-muted rounded font-mono">{cmd}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No verification commands configured.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span className="font-mono">{agent.client}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-mono">{agent.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span>{agent.version}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono">{agent.id}</span>
              </div>
              {agent.createdBy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created By</span>
                  <span>{agent.createdBy}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-xs">{formatDateTime(agent.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="text-xs">{formatDateTime(agent.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
