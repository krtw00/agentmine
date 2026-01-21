'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type SSEEventType =
  | 'connected'
  | 'ping'
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'session:started'
  | 'session:updated'
  | 'session:completed'
  | 'worker:started'
  | 'worker:stopped'
  | 'worker:progress'

export interface SSEEvent<T = any> {
  type: SSEEventType
  data: T
}

interface UseSSEOptions {
  enabled?: boolean
  onEvent?: (event: SSEEvent) => void
  onError?: (error: Error) => void
  reconnectDelay?: number
  maxRetries?: number
}

interface SSEState {
  connected: boolean
  clientId: string | null
  error: Error | null
  retryCount: number
}

export function useSSE(options: UseSSEOptions = {}) {
  const {
    enabled = true,
    onEvent,
    onError,
    reconnectDelay = 3000,
    maxRetries = 5,
  } = options

  const [state, setState] = useState<SSEState>({
    connected: false,
    clientId: null,
    error: null,
    retryCount: 0,
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (!enabled) return

    // Clear any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const eventSource = new EventSource('/api/events')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setState((prev) => ({
          ...prev,
          connected: true,
          error: null,
          retryCount: 0,
        }))
      }

      eventSource.onerror = (event) => {
        const error = new Error('SSE connection error')
        setState((prev) => ({
          ...prev,
          connected: false,
          error,
        }))

        eventSource.close()
        eventSourceRef.current = null

        // Attempt reconnect if within retry limit
        setState((prev) => {
          if (prev.retryCount < maxRetries) {
            reconnectTimeoutRef.current = setTimeout(() => {
              setState((p) => ({ ...p, retryCount: p.retryCount + 1 }))
              connect()
            }, reconnectDelay)
          } else if (onError) {
            onError(new Error(`SSE reconnection failed after ${maxRetries} attempts`))
          }
          return prev
        })
      }

      // Handle connected event
      eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data)
        setState((prev) => ({
          ...prev,
          clientId: data.clientId,
        }))
        if (onEvent) {
          onEvent({ type: 'connected', data })
        }
      })

      // Handle ping event (keep-alive)
      eventSource.addEventListener('ping', () => {
        // Keep-alive, no action needed
      })

      // Handle task events
      const taskEvents = ['task:created', 'task:updated', 'task:deleted']
      taskEvents.forEach((eventType) => {
        eventSource.addEventListener(eventType, (event) => {
          const data = JSON.parse(event.data)
          if (onEvent) {
            onEvent({ type: eventType as SSEEventType, data })
          }
        })
      })

      // Handle session events
      const sessionEvents = ['session:started', 'session:updated', 'session:completed']
      sessionEvents.forEach((eventType) => {
        eventSource.addEventListener(eventType, (event) => {
          const data = JSON.parse(event.data)
          if (onEvent) {
            onEvent({ type: eventType as SSEEventType, data })
          }
        })
      })

      // Handle worker events
      const workerEvents = ['worker:started', 'worker:stopped', 'worker:progress']
      workerEvents.forEach((eventType) => {
        eventSource.addEventListener(eventType, (event) => {
          const data = JSON.parse(event.data)
          if (onEvent) {
            onEvent({ type: eventType as SSEEventType, data })
          }
        })
      })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        connected: false,
        error: error as Error,
      }))
      if (onError) {
        onError(error as Error)
      }
    }
  }, [enabled, onEvent, onError, reconnectDelay, maxRetries])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState({
      connected: false,
      clientId: null,
      error: null,
      retryCount: 0,
    })
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    ...state,
    connect,
    disconnect,
  }
}

// Hook for subscribing to specific event types
export function useSSESubscription<T = any>(
  eventTypes: SSEEventType | SSEEventType[],
  callback: (data: T) => void,
  deps: React.DependencyList = []
) {
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes]

  const handleEvent = useCallback(
    (event: SSEEvent) => {
      if (types.includes(event.type)) {
        callback(event.data)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, ...deps]
  )

  useSSE({
    enabled: true,
    onEvent: handleEvent,
  })
}
