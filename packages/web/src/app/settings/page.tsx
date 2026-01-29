'use client'

import { useEffect, useState, Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  AlertCircle,
  Settings,
  Save,
  Loader2,
  GitBranch,
  Cpu,
  FolderOpen,
  Check,
} from 'lucide-react'

interface RawSetting {
  id: number
  key: string
  value: unknown
  updatedBy: string | null
  updatedAt: string | null
}

// Default settings configuration
const settingsConfig = [
  {
    category: 'Git',
    icon: GitBranch,
    settings: [
      { key: 'git.baseBranch', label: 'Base Branch', type: 'string', default: 'main', description: 'Default branch for worktrees' },
      { key: 'git.remoteName', label: 'Remote Name', type: 'string', default: 'origin', description: 'Git remote name' },
    ],
  },
  {
    category: 'Execution',
    icon: Cpu,
    settings: [
      { key: 'execution.maxWorkers', label: 'Max Workers', type: 'number', default: 3, description: 'Maximum concurrent workers' },
      { key: 'execution.defaultTimeout', label: 'Default Timeout (ms)', type: 'number', default: 3600000, description: 'Worker timeout' },
      { key: 'execution.autoApprove', label: 'Auto Approve', type: 'boolean', default: false, description: 'Auto-approve safe commands' },
    ],
  },
  {
    category: 'Paths',
    icon: FolderOpen,
    settings: [
      { key: 'paths.worktreeDir', label: 'Worktree Directory', type: 'string', default: '.agentmine/worktrees', description: 'Directory for worktrees' },
      { key: 'paths.memoryDir', label: 'Memory Export Directory', type: 'string', default: '.agentmine/memory', description: 'Directory for memory exports' },
    ],
  },
]

function SettingsContent() {
  const [settingsData, setSettingsData] = useState<Record<string, unknown>>({})
  const [rawSettings, setRawSettings] = useState<RawSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setSettingsData(data.settings || {})
        setRawSettings(data.raw || [])

        // Initialize form values
        const values: Record<string, string> = {}
        for (const category of settingsConfig) {
          for (const setting of category.settings) {
            const value = data.settings?.[setting.key] ?? setting.default
            values[setting.key] = String(value)
          }
        }
        setFormValues(values)
      } catch (e) {
        setError('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  async function handleSave(key: string, type: string) {
    const rawValue = formValues[key]
    let value: unknown = rawValue

    // Convert value based on type
    if (type === 'number') {
      value = parseInt(rawValue, 10)
      if (isNaN(value as number)) {
        setError(`Invalid number for ${key}`)
        return
      }
    } else if (type === 'boolean') {
      value = rawValue === 'true'
    }

    setSaving(key)
    setError(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })

      if (!res.ok) throw new Error('Failed to save')

      setSettingsData({ ...settingsData, [key]: value })
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } catch (e) {
      setError('Failed to save setting')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    )
  }

  if (error && !settingsData) {
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
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure project settings
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {error}
        </div>
      )}

      {/* Settings Cards */}
      {settingsConfig.map((category) => {
        const Icon = category.icon
        return (
          <Card key={category.category}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {category.category}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {category.settings.map((setting, index) => (
                <div key={setting.key}>
                  {index > 0 && <Separator className="mb-4" />}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium">{setting.label}</label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {setting.description}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {setting.key}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {setting.type === 'boolean' ? (
                        <select
                          className="w-24 px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                          value={formValues[setting.key]}
                          onChange={(e) => setFormValues({ ...formValues, [setting.key]: e.target.value })}
                          disabled={saving === setting.key}
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <Input
                          type={setting.type === 'number' ? 'number' : 'text'}
                          className="w-48"
                          value={formValues[setting.key]}
                          onChange={(e) => setFormValues({ ...formValues, [setting.key]: e.target.value })}
                          disabled={saving === setting.key}
                        />
                      )}
                      <Button
                        size="sm"
                        variant={saved === setting.key ? 'default' : 'outline'}
                        onClick={() => handleSave(setting.key, setting.type)}
                        disabled={saving === setting.key}
                      >
                        {saving === setting.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : saved === setting.key ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      {/* Raw Settings */}
      {rawSettings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Settings</CardTitle>
            <CardDescription>Raw key-value pairs stored in database</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Key</th>
                    <th className="px-3 py-2 text-left font-medium">Value</th>
                    <th className="px-3 py-2 text-left font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rawSettings.map((setting) => (
                    <tr key={setting.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{setting.key}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {JSON.stringify(setting.value)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {setting.updatedAt ? new Date(setting.updatedAt).toLocaleString('ja-JP') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}
