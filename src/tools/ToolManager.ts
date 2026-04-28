import type { ToolType, Shape, ShapeStyle, Point } from '../types'
import { generateId } from '../stores/useCanvasStore'

export function createShape(
  tool: ToolType,
  startPoint: Point,
  style: ShapeStyle
): Shape {
  return {
    id: generateId(),
    type: tool,
    points: [startPoint.x, startPoint.y],
    style: { ...style },
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
