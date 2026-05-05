import type { ToolType } from '../types'

export interface ToolConfig {
  type: ToolType
  label: string
  icon: string
}

export const TOOLS: ToolConfig[] = [
  { type: 'brush',     label: '画笔', icon: '✏️' },
  { type: 'rectangle', label: '矩形', icon: '⬜' },
  { type: 'circle',    label: '圆形', icon: '⭕' },
  { type: 'arrow',     label: '箭头', icon: '➡️' },
  { type: 'text',      label: '文本', icon: '🔤' },
  { type: 'line',      label: '直线', icon: '📏' },
  { type: 'triangle',  label: '三角', icon: '🔺' },
  { type: 'diamond',   label: '菱形', icon: '🔷' },
  { type: 'pentagon',  label: '五边', icon: '⬠' },
  { type: 'star',      label: '星形', icon: '⭐' },
]
