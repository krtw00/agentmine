'use client'

import { ThemeProvider } from 'next-themes'
import { SSEProvider } from './providers/sse-provider'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SSEProvider>
        {children}
      </SSEProvider>
    </ThemeProvider>
  )
}
