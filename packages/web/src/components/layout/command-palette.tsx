'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  LayoutDashboard,
  CheckSquare,
  PlayCircle,
  Bot,
  Database,
  Settings,
  Plus,
  Search,
  Command,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  shortcut?: string
  icon: React.ElementType
  action: () => void
  category: 'navigation' | 'action'
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      shortcut: 'g d',
      icon: LayoutDashboard,
      action: () => router.push('/'),
      category: 'navigation',
    },
    {
      id: 'nav-tasks',
      label: 'Go to Tasks',
      shortcut: 'g t',
      icon: CheckSquare,
      action: () => router.push('/tasks'),
      category: 'navigation',
    },
    {
      id: 'nav-sessions',
      label: 'Go to Sessions',
      shortcut: 'g s',
      icon: PlayCircle,
      action: () => router.push('/sessions'),
      category: 'navigation',
    },
    {
      id: 'nav-agents',
      label: 'Go to Agents',
      shortcut: 'g a',
      icon: Bot,
      action: () => router.push('/agents'),
      category: 'navigation',
    },
    {
      id: 'nav-memory',
      label: 'Go to Memory Bank',
      shortcut: 'g m',
      icon: Database,
      action: () => router.push('/memory'),
      category: 'navigation',
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      shortcut: 'g ,',
      icon: Settings,
      action: () => router.push('/settings'),
      category: 'navigation',
    },
    // Actions
    {
      id: 'action-new-task',
      label: 'Create New Task',
      shortcut: 'n',
      icon: Plus,
      action: () => router.push('/tasks/new'),
      category: 'action',
    },
    {
      id: 'action-new-agent',
      label: 'Create New Agent',
      icon: Plus,
      action: () => router.push('/agents/new'),
      category: 'action',
    },
    {
      id: 'action-new-memory',
      label: 'Create New Memory',
      icon: Plus,
      action: () => router.push('/memory/new'),
      category: 'action',
    },
  ], [router])

  const filteredCommands = useMemo(() => {
    if (!query) return commands
    const lowerQuery = query.toLowerCase()
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(lowerQuery)
    )
  }, [commands, query])

  const handleSelect = useCallback((command: CommandItem) => {
    onOpenChange(false)
    setQuery('')
    command.action()
  }, [onOpenChange])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredCommands.length - 1)
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            handleSelect(filteredCommands[selectedIndex])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, filteredCommands, selectedIndex, handleSelect])

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      action: [],
    }
    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  let currentIndex = -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Type a command or search..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            esc
          </kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            <>
              {groupedCommands.navigation.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Navigation
                  </div>
                  {groupedCommands.navigation.map((cmd) => {
                    currentIndex++
                    const index = currentIndex
                    return (
                      <button
                        key={cmd.id}
                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm ${
                          selectedIndex === index
                            ? 'bg-accent'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => handleSelect(cmd)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <cmd.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-left">{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              {groupedCommands.action.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Actions
                  </div>
                  {groupedCommands.action.map((cmd) => {
                    currentIndex++
                    const index = currentIndex
                    return (
                      <button
                        key={cmd.id}
                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm ${
                          selectedIndex === index
                            ? 'bg-accent'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => handleSelect(cmd)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <cmd.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-left">{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <div className="border-t px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="bg-muted px-1 rounded">↑</kbd>
            <kbd className="bg-muted px-1 rounded">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted px-1 rounded">↵</kbd>
            to select
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Command className="h-3 w-3" />
            <kbd className="bg-muted px-1 rounded">K</kbd>
            to open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
