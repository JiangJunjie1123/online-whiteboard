import { create } from 'zustand'
import type { ToolType, ShapeStyle } from '../types'

interface ToolState {
  activeTool: ToolType
  style: ShapeStyle
  setTool: (tool: ToolType) => void
  setColor: (color: string) => void
  setStrokeWidth: (width: number) => void
  setFillColor: (color: string) => void
  setOpacity: (opacity: number) => void
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'brush',
  style: {
    strokeColor: '#1A73E8',
    strokeWidth: 2,
    fillColor: '#e8f0fe',
    opacity: 1,
  },
  setTool: (tool) => set({ activeTool: tool }),
  setColor: (color) => set((s) => ({ style: { ...s.style, strokeColor: color } })),
  setStrokeWidth: (width) => set((s) => ({ style: { ...s.style, strokeWidth: width } })),
  setFillColor: (color) => set((s) => ({ style: { ...s.style, fillColor: color } })),
  setOpacity: (opacity) => set((s) => ({ style: { ...s.style, opacity: opacity } })),
}))
