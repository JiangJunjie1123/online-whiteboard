import type Konva from 'konva'
import type { Shape } from '../types'

export interface TransformResult {
  points: number[]
  rotation?: number
  fontSize?: number
}

export function computeTransformedPoints(
  shape: Shape,
  node: Konva.Node
): TransformResult {
  switch (shape.type) {
    case 'brush':
      return computeBrushTransform(shape, node as Konva.Line)

    case 'rectangle':
      return computeRectTransform(shape, node as Konva.Rect)

    case 'circle':
      return computeCircleTransform(shape, node as Konva.Ellipse)

    case 'arrow':
      return computeArrowTransform(shape, node as Konva.Arrow)

    case 'text':
      return computeTextTransform(shape, node as Konva.Text)

    default:
      return { points: shape.points }
  }
}

// Brush: move only. Compute delta from node position and apply to all points.
function computeBrushTransform(shape: Shape, node: Konva.Line): TransformResult {
  const newPoints = [...shape.points]
  const dx = node.x()
  const dy = node.y()
  if (dx !== 0 || dy !== 0) {
    for (let i = 0; i < newPoints.length; i += 2) {
      newPoints[i] += dx
      newPoints[i + 1] += dy
    }
  }
  return { points: newPoints }
}

// Rectangle: full transform. Bake scale into width/height, capture rotation.
function computeRectTransform(shape: Shape, node: Konva.Rect): TransformResult {
  const x = node.x()
  const y = node.y()
  const w = node.width() * node.scaleX()
  const h = node.height() * node.scaleY()
  const rotation = node.rotation()
  return {
    points: [x, y, x + w, y + h],
    rotation: rotation || undefined,
  }
}

// Circle: full transform. Bake scale into radii, capture rotation.
function computeCircleTransform(shape: Shape, node: Konva.Ellipse): TransformResult {
  const cx = node.x()
  const cy = node.y()
  const rx = node.radiusX() * node.scaleX()
  const ry = node.radiusY() * node.scaleY()
  const rotation = node.rotation()
  return {
    points: [cx - rx, cy - ry, cx + rx, cy + ry],
    rotation: rotation || undefined,
  }
}

// Arrow: full transform. The arrow is positioned at its midpoint with relative points.
// After transform, compute world-space start/end by applying scale and rotation to
// the local points, then translating by the node position. Rotation is baked into
// the resulting world-space points (no separate rotation field).
function computeArrowTransform(shape: Shape, node: Konva.Arrow): TransformResult {
  const cx = node.x()
  const cy = node.y()
  const rotation = node.rotation()
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()

  const localPoints = node.points()
  const localX1 = localPoints[0] * scaleX
  const localY1 = localPoints[1] * scaleY
  const localX2 = localPoints[2] * scaleX
  const localY2 = localPoints[3] * scaleY

  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const worldX1 = cx + localX1 * cos - localY1 * sin
  const worldY1 = cy + localX1 * sin + localY1 * cos
  const worldX2 = cx + localX2 * cos - localY2 * sin
  const worldY2 = cy + localX2 * sin + localY2 * cos

  return {
    points: [worldX1, worldY1, worldX2, worldY2],
  }
}

// Text: move + rotate. Scale bakes into fontSize.
function computeTextTransform(shape: Shape, node: Konva.Text): TransformResult {
  const x = node.x()
  const y = node.y()
  const rotation = node.rotation()
  const scaleY = node.scaleY()
  const fontSize = shape.style.fontSize
    ? Math.round(shape.style.fontSize * scaleY)
    : Math.round(24 * scaleY)
  return {
    points: [x, y],
    rotation: rotation || undefined,
    fontSize,
  }
}
