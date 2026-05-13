import type { Shape, Point, Anchor } from '../types'

/** 计算形状 9 个锚点的像素坐标 */
export function getAnchorPositions(shape: Shape): Record<Anchor, Point> {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  return {
    top: { x: cx, y: minY },
    bottom: { x: cx, y: maxY },
    left: { x: minX, y: cy },
    right: { x: maxX, y: cy },
    center: { x: cx, y: cy },
    'top-left': { x: minX, y: minY },
    'top-right': { x: maxX, y: minY },
    'bottom-left': { x: minX, y: maxY },
    'bottom-right': { x: maxX, y: maxY },
  }
}

/** 获取单个锚点坐标 */
export function getAnchorPosition(shape: Shape, anchor: Anchor): Point {
  return getAnchorPositions(shape)[anchor]
}

/** 找到距给定点最近的锚点（在 snapRadius 内），无则返回 null */
export function findNearestAnchor(shape: Shape, point: Point, snapRadius = 20): { anchor: Anchor; position: Point } | null {
  const anchors = getAnchorPositions(shape)
  let best: { anchor: Anchor; position: Point; dist: number } | null = null
  for (const [anchor, pos] of Object.entries(anchors)) {
    const dist = Math.hypot(pos.x - point.x, pos.y - point.y)
    if (dist <= snapRadius && (!best || dist < best.dist)) {
      best = { anchor: anchor as Anchor, position: pos, dist }
    }
  }
  return best ? { anchor: best.anchor, position: best.position } : null
}

/** 选离给定点最近边缘，锚点定位到该点在边上的垂直投影 */
export function getBestEdgeAnchor(shape: Shape, point: Point): { anchor: Anchor; position: Point } {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
  // 各边离 point 最近的点
  const topPt =    { x: Math.max(minX, Math.min(maxX, point.x)), y: minY }
  const bottomPt = { x: Math.max(minX, Math.min(maxX, point.x)), y: maxY }
  const leftPt =   { x: minX, y: Math.max(minY, Math.min(maxY, point.y)) }
  const rightPt =  { x: maxX, y: Math.max(minY, Math.min(maxY, point.y)) }
  const dTop =    Math.hypot(topPt.x - point.x, topPt.y - point.y)
  const dBottom = Math.hypot(bottomPt.x - point.x, bottomPt.y - point.y)
  const dLeft =   Math.hypot(leftPt.x - point.x, leftPt.y - point.y)
  const dRight =  Math.hypot(rightPt.x - point.x, rightPt.y - point.y)
  const minDist = Math.min(dTop, dBottom, dLeft, dRight)
  if (minDist === dTop)    return { anchor: 'top',    position: topPt }
  if (minDist === dBottom) return { anchor: 'bottom', position: bottomPt }
  if (minDist === dLeft)   return { anchor: 'left',   position: leftPt }
  return { anchor: 'right', position: rightPt }
}

/** 判断点是否在形状包围盒附近（含 padding） */
export function isPointInShapeBounds(shape: Shape, point: Point, padding = 4): boolean {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2) - padding
  const maxX = Math.max(x1, x2) + padding
  const minY = Math.min(y1, y2) - padding
  const maxY = Math.max(y1, y2) + padding
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
}
