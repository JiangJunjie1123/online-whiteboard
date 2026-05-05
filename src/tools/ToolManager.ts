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
      const r = Math.sqrt((currentPoint.x - sx) ** 2 + (currentPoint.y - sy) ** 2) * 0.5
      const pts: number[] = []
      for (let i = 0; i < 3; i++) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 3
        pts.push(sx + r * Math.cos(angle), sy + r * Math.sin(angle))
      }
      return pts
    }
    case 'diamond': {
      const r = Math.sqrt((currentPoint.x - sx) ** 2 + (currentPoint.y - sy) ** 2) * 0.5
      const pts: number[] = []
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI * 2 * i) / 4 - Math.PI / 2
        pts.push(sx + r * Math.cos(angle), sy + r * Math.sin(angle))
      }
      return pts
    }
    case 'pentagon': {
      const r = Math.sqrt((currentPoint.x - sx) ** 2 + (currentPoint.y - sy) ** 2) * 0.5
      const pts: number[] = []
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 5
        pts.push(sx + r * Math.cos(angle), sy + r * Math.sin(angle))
      }
      return pts
    }
    case 'star': {
      const r = Math.sqrt((currentPoint.x - sx) ** 2 + (currentPoint.y - sy) ** 2) * 0.5
      const innerR = r * 0.382
      const pts: number[] = []
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (Math.PI * i) / 5
        const radius = i % 2 === 0 ? r : innerR
        pts.push(sx + radius * Math.cos(angle), sy + radius * Math.sin(angle))
      }
      return pts
    }
    default:
      return shape.points
  }
}

export function isClick(points: number[]): boolean {
  if (points.length < 4) return true
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i])
    minY = Math.min(minY, points[i + 1])
    maxX = Math.max(maxX, points[i])
    maxY = Math.max(maxY, points[i + 1])
  }
  return (maxX - minX) < 5 && (maxY - minY) < 5
}
