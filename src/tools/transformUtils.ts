import type Konva from 'konva'
import type { Shape } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'

export interface TransformResult {
  points: number[]
  rotation?: number
  fontSize?: number
}

export function computeTransformedPoints(
  shape: Shape,
  node: Konva.Node,
  stageScale = 1
): TransformResult {
  const def = shapeRegistry.get(shape.type)
  if (def?.transform) {
    return def.transform(shape, node, stageScale)
  }
  console.warn(`[Transform] No transform registered for type: ${shape.type}`)
  return { points: shape.points }
}

// Shared polygon transform for all closed/open multi-vertex Line shapes.
// Computes the axis-aligned bounding box of the scaled local vertices,
// then translates to world coords. Rotation is stored separately.
export function computePolygonTransform(shape: Shape, node: Konva.Line, stageScale = 1): TransformResult {
  const cx = node.x() / stageScale
  const cy = node.y() / stageScale
  const rotation = node.rotation()
  const sX = node.scaleX()
  const sY = node.scaleY()
  const localPoints = node.points()

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < localPoints.length; i += 2) {
    const lx = localPoints[i] * sX / stageScale
    const ly = localPoints[i + 1] * sY / stageScale
    minX = Math.min(minX, lx)
    minY = Math.min(minY, ly)
    maxX = Math.max(maxX, lx)
    maxY = Math.max(maxY, ly)
  }

  return {
    points: [cx + minX, cy + minY, cx + maxX, cy + maxY],
    rotation: rotation || undefined,
  }
}

// Brush: move only. Compute delta from node position and apply to all points.
export function computeBrushTransform(shape: Shape, node: Konva.Line, stageScale = 1): TransformResult {
  const newPoints = [...shape.points]
  const dx = node.x() / stageScale
  const dy = node.y() / stageScale
  if (dx !== 0 || dy !== 0) {
    for (let i = 0; i < newPoints.length; i += 2) {
      newPoints[i] += dx
      newPoints[i + 1] += dy
    }
  }
  return { points: newPoints }
}

// Rectangle: full transform. Bake scale into width/height, capture rotation.
export function computeRectTransform(shape: Shape, node: Konva.Rect, stageScale = 1): TransformResult {
  const x = node.x() / stageScale
  const y = node.y() / stageScale
  const w = node.width() * node.scaleX() / stageScale
  const h = node.height() * node.scaleY() / stageScale
  const rotation = node.rotation()
  return {
    points: [x, y, x + w, y + h],
    rotation: rotation || undefined,
  }
}

// Circle: full transform. Bake scale into radii, capture rotation.
export function computeCircleTransform(shape: Shape, node: Konva.Ellipse, stageScale = 1): TransformResult {
  const cx = node.x() / stageScale
  const cy = node.y() / stageScale
  const rx = node.radiusX() * node.scaleX() / stageScale
  const ry = node.radiusY() * node.scaleY() / stageScale
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
export function computeArrowTransform(shape: Shape, node: Konva.Arrow, stageScale = 1): TransformResult {
  const cx = node.x() / stageScale
  const cy = node.y() / stageScale
  const rotation = node.rotation()
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()

  const localPoints = node.points()
  const localX1 = localPoints[0] * scaleX / stageScale
  const localY1 = localPoints[1] * scaleY / stageScale
  const localX2 = localPoints[2] * scaleX / stageScale
  const localY2 = localPoints[3] * scaleY / stageScale

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
export function computeTextTransform(shape: Shape, node: Konva.Text, stageScale = 1): TransformResult {
  const x = node.x() / stageScale
  const y = node.y() / stageScale
  const rotation = node.rotation()
  const scaleY = node.scaleY()
  const fontSize = shape.style.fontSize !== undefined
    ? Math.round(shape.style.fontSize * scaleY / stageScale)
    : Math.round(24 * scaleY / stageScale)
  return {
    points: [x, y],
    rotation: rotation || undefined,
    fontSize,
  }
}
