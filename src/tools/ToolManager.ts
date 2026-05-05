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
    case 'triangle':
    case 'diamond':
    case 'pentagon':
    case 'star':
      return [sx, sy, currentPoint.x, currentPoint.y]
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
