export type ToolType = 'brush' | 'rectangle' | 'circle' | 'arrow' | 'text'
  | 'line' | 'triangle' | 'star' | 'diamond' | 'pentagon'

export interface ShapeStyle {
  strokeColor: string
  strokeWidth: number
  fillColor: string
  opacity: number
  fontSize?: number
}

export interface Point {
  x: number
  y: number
}

export interface Shape {
  id: string
  type: ToolType
  points: number[]
  style: ShapeStyle
  text?: string
  rotation?: number
  userId?: string
}

export interface DrawingState {
  isDrawing: boolean
  currentShape: Shape | null
}

// --- WebSocket / Collaboration types ---

export interface User {
  id: string
  name: string
  color: string
  cursor?: { x: number; y: number } | null
}

// Server -> Client messages
export type ServerMessage =
  | { type: 'room_state'; roomId: string; userId: string; users: User[]; shapes: Shape[] }
  | { type: 'operation'; action: string; shape?: Shape; shapeId?: string }
  | { type: 'cursor_update'; userId: string; position: { x: number; y: number } }
  | { type: 'user_joined'; user: User }
  | { type: 'user_left'; userId: string }
  | { type: 'error'; message: string }

// Client -> Server messages
export type ClientMessage =
  | { type: 'join_room'; roomId?: string; userId: string; userName: string }
  | { type: 'operation'; action: string; shape?: Shape; shapeId?: string }
  | { type: 'cursor_move'; position: { x: number; y: number } }
  | { type: 'request_sync' }
