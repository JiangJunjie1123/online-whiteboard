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
  node: Konva.Node
): TransformResult {
  const def = shapeRegistry.get(shape.type)
  if (def?.transform) {
    return def.transform(shape, node)
  }
  console.warn(`[Transform] No transform registered for type: ${shape.type}`)
  return { points: shape.points }
}

// Shared polygon transform for all closed/open multi-vertex Line shapes.
// Computes the axis-aligned bounding box of the scaled local vertices,
// then translates to world coords. Rotation is stored separately.
export function computePolygonTransform(shape: Shape, node: Konva.Line): TransformResult {
  const cx = node.x()
  const cy = node.y()
  const rotation = node.rotation()
  const sX = node.scaleX()
  const sY = node.scaleY()
  const localPoints = node.points()

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < localPoints.length; i += 2) {
    const lx = localPoints[i] * sX
    const ly = localPoints[i + 1] * sY
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
export function computeBrushTransform(shape: Shape, node: Konva.Line): TransformResult {
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

// Group-based shapes: derive original size from shape points, then scale.
// Group nodes don't have width()/height() set, so we can't use node.width().
export function computeGroupTransform(shape: Shape, node: Konva.Group): TransformResult {
  const [x1, y1, x2, y2] = shape.points
  const origW = Math.abs(x2 - x1)
  const origH = Math.abs(y2 - y1)
  return {
    points: [
      node.x(),
      node.y(),
      node.x() + origW * node.scaleX(),
      node.y() + origH * node.scaleY(),
    ],
    rotation: node.rotation() || undefined,
  }
}

// Rectangle: full transform. Bake scale into width/height, capture rotation.
export function computeRectTransform(shape: Shape, node: Konva.Rect): TransformResult {
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
export function computeCircleTransform(shape: Shape, node: Konva.Ellipse): TransformResult {
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
export function computeArrowTransform(shape: Shape, node: Konva.Arrow): TransformResult {
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
export function computeTextTransform(shape: Shape, node: Konva.Text): TransformResult {
  const x = node.x()
  const y = node.y()
  const rotation = node.rotation()
  const scaleY = node.scaleY()
  const fontSize = shape.style.fontSize !== undefined
    ? Math.round(shape.style.fontSize * scaleY)
    : Math.round(24 * scaleY)
  return {
    points: [x, y],
    rotation: rotation || undefined,
    fontSize,
  }
}
