'use client'

import { Sidebar } from './sidebar'
import { Header } from './header'
import { CommandPalette } from './command-palette'
import { KeyboardHelp } from './keyboard-help'
import { useKeyboardNavigation } from '@/hooks/use-keyboard-navigation'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const {
    showHelp,
    setShowHelp,
    showCommandPalette,
    setShowCommandPalette,
  } = useKeyboardNavigation()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onCommandPaletteOpen={() => setShowCommandPalette(true)} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
      />

      {/* Keyboard Help */}
      <KeyboardHelp
        open={showHelp}
        onOpenChange={setShowHelp}
      />
    </div>
  )
}
