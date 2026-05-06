import { create } from 'zustand'
import type Konva from 'konva'
import type { Shape } from '../types'

interface CanvasState {
  shapes: Shape[]
  stageX: number
  stageY: number
  scale: number
  gridVisible: boolean
  getStage: (() => Konva.Stage | null) | null
  setShapes: (shapes: Shape[]) => void
  addShape: (shape: Shape, remote?: boolean) => void
  updateShape: (id: string, partial: Partial<Shape>, remote?: boolean) => void
  removeShape: (id: string, remote?: boolean) => void
  clearCanvas: (remote?: boolean) => void
  setViewport: (x: number, y: number, scale: number) => void
  setStageGetter: (getter: () => Konva.Stage | null) => void
  setGridVisible: (visible: boolean) => void
  /** Undo: remove the last shape created by `userId`. Returns the removed shapeId or null. */
  undoOwn: (userId: string) => string | null
}

let idCounter = 0
export const generateId = (): string => `shape_${Date.now()}_${++idCounter}`

export const useCanvasStore = create<CanvasState>((set, get) => ({
  shapes: [],
  stageX: 0,
  stageY: 0,
  scale: 1,
  gridVisible: true,
  getStage: null,

  setViewport: (x, y, scale) => set({ stageX: x, stageY: y, scale }),
  setStageGetter: (getter) => set({ getStage: getter }),
  setGridVisible: (visible) => set({ gridVisible: visible }),

  setShapes: (shapes) => set({ shapes }),

  addShape: (shape, _remote = false) => {
    set((s) => ({ shapes: [...s.shapes, shape] }))
  },

  updateShape: (id, partial, _remote = false) => {
    set((s) => ({
      shapes: s.shapes.map((sh) => (sh.id === id ? { ...sh, ...partial } : sh)),
    }))
  },

  removeShape: (id, _remote = false) => {
    set((s) => ({ shapes: s.shapes.filter((sh) => sh.id !== id) }))
  },

  clearCanvas: (_remote = false) => {
    set({ shapes: [] })
  },

  undoOwn: (userId) => {
    const { shapes } = get()
    // Walk backwards to find the last shape owned by this user
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (shapes[i].userId === userId) {
        const shapeId = shapes[i].id
        set({ shapes: shapes.filter((_, idx) => idx !== i) })
        return shapeId
      }
    }
    return null
  },
}))
