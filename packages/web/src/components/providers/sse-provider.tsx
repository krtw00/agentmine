'use client'

import { createContext, useContext, useCallback, ReactNode } from 'react'
import { useSSE, SSEEvent, SSEEventType } from '@/hooks/use-sse'

interface SSEContextValue {
  connected: boolean
  clientId: string | null
  error: Error | null
  subscribe: (
    eventTypes: SSEEventType | SSEEventType[],
    callback: (event: SSEEvent) => void
  ) => () => void
}

const SSEContext = createContext<SSEContextValue | null>(null)

interface SSEProviderProps {
  children: ReactNode
  enabled?: boolean
}

export function SSEProvider({ children, enabled = true }: SSEProviderProps) {
  const subscribers = new Map<string, (event: SSEEvent) => void>()

  const handleEvent = useCallback((event: SSEEvent) => {
    subscribers.forEach((callback) => {
      callback(event)
    })
  }, [])

  const { connected, clientId, error } = useSSE({
    enabled,
    onEvent: handleEvent,
  })

  const subscribe = useCallback(
    (
      eventTypes: SSEEventType | SSEEventType[],
      callback: (event: SSEEvent) => void
    ) => {
      const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes]
      const id = Math.random().toString(36).substring(7)

      const wrappedCallback = (event: SSEEvent) => {
        if (types.includes(event.type)) {
          callback(event)
        }
      }

      subscribers.set(id, wrappedCallback)

      return () => {
        subscribers.delete(id)
      }
    },
    []
  )

  return (
    <SSEContext.Provider value={{ connected, clientId, error, subscribe }}>
      {children}
    </SSEContext.Provider>
  )
}

export function useSSEContext() {
  const context = useContext(SSEContext)
  if (!context) {
    throw new Error('useSSEContext must be used within an SSEProvider')
  }
  return context
}
