import { NextRequest } from 'next/server'

// SSE connection manager
type SSEClient = {
  id: string
  controller: ReadableStreamDefaultController
}

const clients: Map<string, SSEClient> = new Map()

// Helper to broadcast events to all connected clients
export function broadcastEvent(eventType: string, data: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
  clients.forEach((client) => {
    try {
      client.controller.enqueue(new TextEncoder().encode(message))
    } catch (e) {
      // Client disconnected
      clients.delete(client.id)
    }
  })
}

/**
 * GET /api/events - Server-Sent Events endpoint
 */
export async function GET(request: NextRequest) {
  const clientId = Math.random().toString(36).substring(7)

  const stream = new ReadableStream({
    start(controller) {
      // Register client
      clients.set(clientId, { id: clientId, controller })

      // Send initial connection message
      const connectMessage = `event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`
      controller.enqueue(new TextEncoder().encode(connectMessage))

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          const pingMessage = `event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`
          controller.enqueue(new TextEncoder().encode(pingMessage))
        } catch (e) {
          clearInterval(keepAlive)
          clients.delete(clientId)
        }
      }, 30000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        clients.delete(clientId)
        controller.close()
      })
    },
    cancel() {
      clients.delete(clientId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// Export for other API routes to use
export { clients }
