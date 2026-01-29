'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  AlertCircle,
  Bot,
  Code,
  Terminal,
  Sparkles,
} from 'lucide-react'

interface Agent {
  id: number
  name: string
  description: string | null
  client: string
  model: string
  scope: { write?: string[]; exclude?: string[]; read?: string[] }
  version: number
  createdAt: string | null
  updatedAt: string | null
}

const clientIcons: Record<string, React.ElementType> = {
  'claude-code': Terminal,
  'codex': Code,
  'gemini-cli': Sparkles,
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  })
}

function AgentsContent() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents')
        if (!res.ok) throw new Error('Failed to fetch')
        setAgents(await res.json())
      } catch (e) {
        setError('Failed to load agents')
      } finally {
        setLoading(false)
      }
    }
    fetchAgents()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
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
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-sm text-muted-foreground">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button asChild>
          <Link href="/agents/new">
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Link>
        </Button>
      </div>

      {/* Agents Grid */}
      {agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No agents configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create an agent to start running workers
            </p>
            <Button className="mt-4" asChild>
              <Link href="/agents/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const ClientIcon = clientIcons[agent.client] || Bot
            return (
              <Link key={agent.id} href={`/agents/${agent.id}`}>
                <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ClientIcon className="h-5 w-5" />
                        {agent.name}
                      </CardTitle>
                      <Badge variant="outline">v{agent.version}</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {agent.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Client</span>
                        <span className="font-mono">{agent.client}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Model</span>
                        <span className="font-mono">{agent.model}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Scope</span>
                        <div className="flex gap-1">
                          {agent.scope?.write && agent.scope.write.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {agent.scope.write.length} write
                            </Badge>
                          )}
                          {agent.scope?.exclude && agent.scope.exclude.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {agent.scope.exclude.length} exclude
                            </Badge>
                          )}
                          {(!agent.scope?.write || agent.scope.write.length === 0) &&
                           (!agent.scope?.exclude || agent.scope.exclude.length === 0) && (
                            <span className="text-muted-foreground text-xs">No restrictions</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                        <span>Updated {formatDate(agent.updatedAt)}</span>
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

export default function AgentsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    }>
      <AgentsContent />
    </Suspense>
  )
}
