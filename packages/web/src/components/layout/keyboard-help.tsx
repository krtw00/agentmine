'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutItem[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close dialog / Go back' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['g', 'd'], description: 'Go to Dashboard' },
      { keys: ['g', 't'], description: 'Go to Tasks' },
      { keys: ['g', 's'], description: 'Go to Sessions' },
      { keys: ['g', 'a'], description: 'Go to Agents' },
      { keys: ['g', 'm'], description: 'Go to Memory Bank' },
      { keys: ['g', ','], description: 'Go to Settings' },
    ],
  },
  {
    title: 'List Navigation',
    shortcuts: [
      { keys: ['j', '↓'], description: 'Next item' },
      { keys: ['k', '↑'], description: 'Previous item' },
      { keys: ['Enter'], description: 'Open selected item' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['n'], description: 'New item (context-dependent)' },
      { keys: ['e'], description: 'Edit selected item' },
      { keys: ['/'], description: 'Focus search / filter' },
      { keys: ['⌘', 'S'], description: 'Save' },
    ],
  },
  {
    title: 'Editor',
    shortcuts: [
      { keys: ['⌘', '⇧', 'F'], description: 'Format code' },
      { keys: ['⌘', '.'], description: 'Quick fix' },
      { keys: ['⌘', 'Space'], description: 'Show completions' },
      { keys: ['F8'], description: 'Next error' },
      { keys: ['⇧', 'F8'], description: 'Previous error' },
    ],
  },
]

interface KeyboardHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardHelp({ open, onOpenChange }: KeyboardHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex}>
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium bg-muted rounded border border-border">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 &&
                            shortcut.keys.length > 1 &&
                            key.length > 1 && (
                              <span className="text-muted-foreground mx-0.5">+</span>
                            )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
          Press <kbd className="bg-muted px-1.5 py-0.5 rounded mx-1">?</kbd> to
          toggle this help
        </div>
      </DialogContent>
    </Dialog>
  )
}
