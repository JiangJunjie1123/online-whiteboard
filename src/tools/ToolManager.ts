import type { ToolType, Shape, ShapeStyle, Point } from '../types'
import { generateId } from '../stores/useCanvasStore'

export function createShape(
  tool: ToolType,
  startPoint: Point,
  style: ShapeStyle,
  userId?: string
): Shape {
  return {
    id: generateId(),
    type: tool,
    points: [startPoint.x, startPoint.y],
    style: { ...style },
    userId,
  }
}

export function updateShapePoints(
  shape: Shape,
  currentPoint: Point
): number[] {
  const [sx, sy] = [shape.points[0], shape.points[1]]

  switch (shape.type) {
    case 'brush':
      return [...shape.points, currentPoint.x, currentPoint.y]
    case 'rectangle':
      return [sx, sy, currentPoint.x, currentPoint.y]
    case 'circle':
      return [sx, sy, currentPoint.x, currentPoint.y]
    case 'arrow':
      return [sx, sy, currentPoint.x, currentPoint.y]
    case 'text':
      return [sx, sy]
    case 'line':
      return [sx, sy, currentPoint.x, currentPoint.y]
    case 'triangle': {
      const minX = Math.min(sx, currentPoint.x), maxX = Math.max(sx, currentPoint.x)
      const minY = Math.min(sy, currentPoint.y), maxY = Math.max(sy, currentPoint.y)
      const midX = (minX + maxX) / 2
      return [midX, minY, minX, maxY, maxX, maxY]
    }
    case 'diamond': {
      const minX = Math.min(sx, currentPoint.x), maxX = Math.max(sx, currentPoint.x)
      const minY = Math.min(sy, currentPoint.y), maxY = Math.max(sy, currentPoint.y)
      const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2
      return [midX, minY, maxX, midY, midX, maxY, minX, midY]
    }
    case 'pentagon': {
      const minX = Math.min(sx, currentPoint.x), maxX = Math.max(sx, currentPoint.x)
      const minY = Math.min(sy, currentPoint.y), maxY = Math.max(sy, currentPoint.y)
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
      const r = Math.min(maxX - minX, maxY - minY) / 2
      const pts: number[] = []
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 5
        pts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
      }
      return pts
    }
    case 'star': {
      const minX = Math.min(sx, currentPoint.x), maxX = Math.max(sx, currentPoint.x)
      const minY = Math.min(sy, currentPoint.y), maxY = Math.max(sy, currentPoint.y)
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
      const outerR = Math.min(maxX - minX, maxY - minY) / 2
      const innerR = outerR * 0.382
      const pts: number[] = []
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (Math.PI * i) / 5
        const r = i % 2 === 0 ? outerR : innerR
        pts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
      }
      return pts
    }
    default:
      return shape.points
  }
}

export function isClick(points: number[]): boolean {
  if (points.length < 4) return true
  const [x1, y1] = [points[0], points[1]]
  const last = points.slice(-2)
  const dx = Math.abs(x1 - last[0])
  const dy = Math.abs(y1 - last[1])
  return dx < 5 && dy < 5
}
