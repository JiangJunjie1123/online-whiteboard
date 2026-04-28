import { create } from 'zustand'
import type { Shape } from '../types'

interface CanvasState {
  shapes: Shape[]
  history: Shape[][]   // undo stack
  redoStack: Shape[][] // redo stack
  setShapes: (shapes: Shape[]) => void
  addShape: (shape: Shape, remote?: boolean) => void
  updateShape: (id: string, partial: Partial<Shape>, remote?: boolean) => void
  removeShape: (id: string, remote?: boolean) => void
  undo: () => void
  redo: () => void
  clearCanvas: (remote?: boolean) => void
  _commitHistory: () => void
}

let idCounter = 0
export const generateId = (): string => `shape_${Date.now()}_${++idCounter}`

export const useCanvasStore = create<CanvasState>((set, get) => ({
  shapes: [],
  history: [],
  redoStack: [],

  _commitHistory: () => {
    set((s) => ({
      history: [...s.history, [...s.shapes]],
      redoStack: [],
    }))
  },

  setShapes: (shapes) => set({ shapes, history: [], redoStack: [] }),

  addShape: (shape, remote = false) => {
    if (!remote) get()._commitHistory()
    set((s) => ({ shapes: [...s.shapes, shape] }))
  },

  updateShape: (id, partial, _remote = false) => {
    set((s) => ({
      shapes: s.shapes.map((sh) => (sh.id === id ? { ...sh, ...partial } : sh)),
    }))
  },

  removeShape: (id, remote = false) => {
    if (!remote) get()._commitHistory()
    set((s) => ({ shapes: s.shapes.filter((sh) => sh.id !== id) }))
  },

  undo: () => {
    const { history, shapes } = get()
    if (history.length === 0) return
    const prev = history[history.length - 1]
    set({
      shapes: prev,
      history: history.slice(0, -1),
      redoStack: [...get().redoStack, [...shapes]],
    })
  },

  redo: () => {
    const { redoStack, shapes } = get()
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    set({
      shapes: next,
      history: [...get().history, [...shapes]],
      redoStack: redoStack.slice(0, -1),
    })
  },

  clearCanvas: (remote = false) => {
    if (!remote) get()._commitHistory()
    set({ shapes: [] })
  },
}))
