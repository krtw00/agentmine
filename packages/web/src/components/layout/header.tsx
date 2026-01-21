'use client'

import { usePathname } from 'next/navigation'
import { Moon, Sun, Search, Command } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/tasks': 'Tasks',
  '/sessions': 'Sessions',
  '/agents': 'Agents',
  '/memory': 'Memory Bank',
  '/settings': 'Settings',
  '/workers': 'Workers',
}

interface HeaderProps {
  onCommandPaletteOpen?: () => void
}

export function Header({ onCommandPaletteOpen }: HeaderProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  // Get page title from pathname
  const getPageTitle = () => {
    if (pageTitles[pathname]) return pageTitles[pathname]
    // Handle nested routes
    for (const [path, title] of Object.entries(pageTitles)) {
      if (path !== '/' && pathname.startsWith(path)) return title
    }
    return 'AgentMine'
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6">
      <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
      <div className="flex-1" />

      {/* Command Palette Button */}
      {onCommandPaletteOpen && (
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-2 text-muted-foreground"
          onClick={onCommandPaletteOpen}
        >
          <Search className="h-4 w-4" />
          <span className="text-sm">Search...</span>
          <kbd className="ml-2 inline-flex items-center gap-1 rounded border bg-muted px-1.5 text-xs font-medium">
            <Command className="h-3 w-3" />K
          </kbd>
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    </header>
  )
}
