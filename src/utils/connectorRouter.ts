import type { Point, Shape } from '../types'

interface Obstacle {
  x1: number; y1: number; x2: number; y2: number
}

/** 正交路由：基于起止锚点方向，选穿障最少路径 */
export function routeOrthogonal(
  startPos: Point, endPos: Point,
  startAnchor: string, endAnchor: string,
  allShapes: Shape[], excludeIds: string[],
): number[] {
  const obstacles = getObstacles(allShapes, excludeIds)
  const candidates: number[][] = []
  const startH = startAnchor === 'left' || startAnchor === 'right'
  const endH = endAnchor === 'left' || endAnchor === 'right'

  if (startH && endH) {
    // 两端水平 → 横-竖-横
    for (const f of [0.3, 0.5, 0.7]) {
      const mx = startPos.x + (endPos.x - startPos.x) * f
      candidates.push([startPos.x, startPos.y, mx, startPos.y, mx, endPos.y, endPos.x, endPos.y])
    }
  } else if (!startH && !endH) {
    // 两端垂直 → 竖-横-竖
    for (const f of [0.3, 0.5, 0.7]) {
      const my = startPos.y + (endPos.y - startPos.y) * f
      candidates.push([startPos.x, startPos.y, startPos.x, my, endPos.x, my, endPos.x, endPos.y])
    }
  } else if (startH && !endH) {
    // 起始水平 + 终点垂直 → 只横-竖
    candidates.push([startPos.x, startPos.y, endPos.x, startPos.y, endPos.x, endPos.y])
  } else {
    // 起始垂直 + 终点水平 → 只竖-横
    candidates.push([startPos.x, startPos.y, startPos.x, endPos.y, endPos.x, endPos.y])
  }

  let best = candidates[0]
  let bestScore = countHits(best, obstacles)
  for (let i = 1; i < candidates.length; i++) {
    const score = countHits(candidates[i], obstacles)
    if (score < bestScore) { best = candidates[i]; bestScore = score }
  }
  return best
}

export function routeStraight(startPos: Point, endPos: Point): number[] {
  return [startPos.x, startPos.y, endPos.x, endPos.y]
}

// ---- internal ----

function getObstacles(shapes: Shape[], excludeIds: string[]): Obstacle[] {
  const pad = 16
  return shapes
    .filter(s => !excludeIds.includes(s.id) && s.type !== 'connector')
    .map(s => {
      const [a, b, c, d] = s.points
      return { x1: Math.min(a, c) - pad, y1: Math.min(b, d) - pad, x2: Math.max(a, c) + pad, y2: Math.max(b, d) + pad }
    })
}

function countHits(path: number[], obstacles: Obstacle[]): number {
  let hits = 0
  for (let i = 0; i < path.length - 2; i += 2) {
    for (const obs of obstacles) {
      if (segHitsRect(path[i], path[i+1], path[i+2], path[i+3], obs)) hits++
    }
  }
  return hits
}

function segHitsRect(x1: number, y1: number, x2: number, y2: number, r: Obstacle): boolean {
  if (x1 === x2) {
    if (x1 <= r.x1 || x1 >= r.x2) return false
    const my = Math.min(y1, y2), My = Math.max(y1, y2)
    return My > r.y1 && my < r.y2
  }
  if (y1 === y2) {
    if (y1 <= r.y1 || y1 >= r.y2) return false
    const mx = Math.min(x1, x2), Mx = Math.max(x1, x2)
    return Mx > r.x1 && mx < r.x2
  }
  return false
}
