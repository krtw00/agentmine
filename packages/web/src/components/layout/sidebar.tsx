'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListTodo,
  Play,
  Bot,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Workers', href: '/workers', icon: Cpu },
  { name: 'Sessions', href: '/sessions', icon: Play },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Memory', href: '/memory', icon: Brain },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col h-screen border-r bg-background transition-all duration-300',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b px-4">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Bot className="h-6 w-6" />
              <span>AgentMine</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/" className="flex items-center justify-center w-full">
              <Bot className="h-6 w-6" />
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.name}>{linkContent}</div>
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full', collapsed && 'px-2')}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
