import type { ClientMessage, ServerMessage, Shape, User } from '../types'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useUserStore } from '../stores/useUserStore'

type MessageHandler = (msg: ServerMessage) => void

class SyncManagerClass {
  private ws: WebSocket | null = null
  private url: string
  private reconnectTimer: number | null = null
  private handlers: MessageHandler[] = []
  private destroyed = false
  private pendingJoin: { roomId?: string; userName: string } | null = null

  constructor(url: string) {
    this.url = url
  }

  connect() {
    if (this.destroyed) return
    this.disconnect()

    try {
      this.ws = new WebSocket(this.url)
    } catch (e) {
      console.error('[Sync] WS creation failed:', e)
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      console.log('[Sync] Connected')
      useUserStore.getState().setConnected(true)
      // Re-join room if we had one
      if (this.pendingJoin) {
        this.send({
          type: 'join_room',
          roomId: this.pendingJoin.roomId,
          userName: this.pendingJoin.userName,
        })
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)
        this.dispatch(msg)
      } catch (e) {
        console.error('[Sync] Parse error:', e)
      }
    }

    this.ws.onclose = () => {
      console.log('[Sync] Disconnected')
      useUserStore.getState().setConnected(false)
      if (!this.destroyed) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      console.error('[Sync] Error')
    }
  }

  disconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
  }

  destroy() {
    this.destroyed = true
    this.disconnect()
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    } else {
      console.warn('[Sync] Not connected, cannot send')
    }
  }

  joinRoom(roomId: string | undefined, userName: string) {
    this.pendingJoin = { roomId, userName }
    this.send({ type: 'join_room', roomId, userName })
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler)
    }
  }

  private dispatch(msg: ServerMessage) {
    switch (msg.type) {
      case 'room_state': {
        const store = useUserStore.getState()
        store.setRoomId(msg.roomId)
        store.setUserId(msg.userId)
        store.setUsers(msg.users)
        useCanvasStore.getState().setShapes(msg.shapes)
        break
      }
      case 'user_joined':
        useUserStore.getState().addUser(msg.user)
        break
      case 'user_left':
        useUserStore.getState().removeUser(msg.userId)
        break
      case 'cursor_update':
        useUserStore.getState().updateUserCursor(msg.userId, msg.position)
        break
      case 'operation': {
        const canvasStore = useCanvasStore.getState()
        if (msg.action === 'draw' && msg.shape) {
          canvasStore.addShape(msg.shape, true)
        } else if (msg.action === 'delete' && msg.shapeId) {
          canvasStore.removeShape(msg.shapeId, true)
        } else if (msg.action === 'clear') {
          canvasStore.setShapes([])
        } else if (msg.action === 'update' && msg.shape) {
          canvasStore.updateShape(msg.shape.id, msg.shape, true)
        }
        break
      }
    }

    this.handlers.forEach((h) => h(msg))
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      console.log('[Sync] Reconnecting...')
      this.connect()
    }, 2000)
  }
}

let instance: SyncManagerClass | null = null

export function createSyncManager(url: string): SyncManagerClass {
  if (instance) {
    instance.destroy()
  }
  instance = new SyncManagerClass(url)
  return instance
}

export function getSyncManager(): SyncManagerClass | null {
  return instance
}
