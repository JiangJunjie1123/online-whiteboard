export type ShapeType = string
export type ToolType = ShapeType  // backward compatibility alias

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
  type: string
  points: number[]
  style: ShapeStyle
  text?: string
  rotation?: number
  userId?: string
  /** V3B: shape-specific attributes (JSON-serializable) */
  extras?: Record<string, unknown>
  /** V3B: connection data for linked shapes (Phase 2) */
  // connectionData?: ConnectionData
  /** V3B: template instance ID marking shapes created by a template */
  // templateId?: string
  /** V3B: group ID for batch operations */
  // groupId?: string
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
