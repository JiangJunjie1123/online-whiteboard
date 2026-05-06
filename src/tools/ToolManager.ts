import type { Shape, ShapeStyle, Point } from '../types'
import { generateId } from '../stores/useCanvasStore'
import { shapeRegistry } from '../config/shapeRegistry'

export function createShape(
  tool: string,
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
  // V3B: Delegate to Shape Registry first
  const def = shapeRegistry.get(shape.type)
  if (def?.updatePoints) {
    return def.updatePoints(shape, currentPoint)
  }

  // Fallback: legacy switch for unregistered types
  const [sx, sy] = [shape.points[0], shape.points[1]]

  switch (shape.type) {
    case 'brush':
      return [...shape.points, currentPoint.x, currentPoint.y]
    case 'rectangle':
    case 'circle':
    case 'arrow':
    case 'line':
    case 'triangle':
    case 'diamond':
    case 'pentagon':
    case 'star':
      return [sx, sy, currentPoint.x, currentPoint.y]
    case 'text':
      return [sx, sy]
    default:
      return shape.points
  }
}

export function isClick(points: number[], scale = 1): boolean {
  if (points.length < 4) return true
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i])
    minY = Math.min(minY, points[i + 1])
    maxX = Math.max(maxX, points[i])
    maxY = Math.max(maxY, points[i + 1])
  }
  const threshold = 5 / scale
  return (maxX - minX) < threshold && (maxY - minY) < threshold
}
