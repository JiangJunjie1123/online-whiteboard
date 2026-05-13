# Connector System Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-connect anchor system so users can link two shapes with a line that follows them when moved.

**Architecture:** Connection is a Shape (`type: "connector"`) with linkage metadata in `extras`. A `Map<shapeId, Set<connectionId>>` index enables O(1) lookup when shapes move. Anchors are computed from 4-value bounds. Phase 1 uses straight-line routing.

**Tech Stack:** TypeScript, Konva.js, Zustand (existing stores), no backend changes.

**Spec:** `docs/superpowers/specs/2026-05-13-connector-system-design.md`

---

### Task 1: Add Anchor and ConnectorExtras types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add type definitions**

Add after the existing `Point` interface and before `Shape`:

```typescript
// --- Connector / Anchor types ---

export const ANCHORS = [
  'top', 'bottom', 'left', 'right', 'center',
  'top-left', 'top-right', 'bottom-left', 'bottom-right',
] as const

export type Anchor = (typeof ANCHORS)[number]

export interface ConnectorExtras {
  startShapeId: string
  endShapeId: string
  startAnchor: Anchor
  endAnchor: Anchor
  arrowStart?: 'none' | 'triangle' | 'circle' | 'diamond'
  arrowEnd?: 'none' | 'triangle' | 'circle' | 'diamond'
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  waypoints?: Point[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (only the new type additions).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Anchor and ConnectorExtras types for connector system"
```

---

### Task 2: Create anchorUtils.ts — anchor position calculation

**Files:**
- Create: `src/utils/anchorUtils.ts`

- [ ] **Step 1: Write the unit tests**

Since there's no test suite, verify correctness through a temporary console test. Write the utility file with an IIFE validation block.

Create `src/utils/anchorUtils.ts`:

```typescript
import type { Shape, Point, Anchor } from '../types'

/**
 * Compute all 9 anchor positions for a shape from its 4-value bounds.
 * All shape types use this uniform calculation.
 */
export function getAnchorPositions(shape: Shape): Record<Anchor, Point> {
  const [x1, y1, x2, y2] = shape.points
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  return {
    'top':          { x: cx, y: y1 },
    'bottom':       { x: cx, y: y2 },
    'left':         { x: x1, y: cy },
    'right':        { x: x2, y: cy },
    'center':       { x: cx, y: cy },
    'top-left':     { x: x1, y: y1 },
    'top-right':    { x: x2, y: y1 },
    'bottom-left':  { x: x1, y: y2 },
    'bottom-right': { x: x2, y: y2 },
  }
}

/**
 * Get a single anchor's pixel position.
 */
export function getAnchorPosition(shape: Shape, anchor: Anchor): Point {
  return getAnchorPositions(shape)[anchor]
}

/**
 * Find the nearest anchor to a given world-space point within `snapRadius` px.
 * Returns null if no anchor is within range.
 */
export function findNearestAnchor(
  shape: Shape,
  point: Point,
  snapRadius: number = 12,
): { anchor: Anchor; position: Point } | null {
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

/**
 * Check if a point is inside a shape's bounding box (with optional padding).
 */
export function isPointInShapeBounds(shape: Shape, point: Point, padding: number = 0): boolean {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2) - padding
  const maxX = Math.max(x1, x2) + padding
  const minY = Math.min(y1, y2) - padding
  const maxY = Math.max(y1, y2) + padding
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/anchorUtils.ts
git commit -m "feat: add anchor position calculation utilities"
```

---

### Task 3: Create connectorRouter.ts — straight-line routing

**Files:**
- Create: `src/utils/connectorRouter.ts`

- [ ] **Step 1: Write the routing utility**

Create `src/utils/connectorRouter.ts`:

```typescript
import type { Point } from '../types'

/**
 * Phase 1: Straight-line routing between two anchor positions.
 * Returns the points array for the connector shape.
 * Phase 2 will replace this with orthogonal routing.
 */
export function routeConnection(startPos: Point, endPos: Point): number[] {
  return [startPos.x, startPos.y, endPos.x, endPos.y]
}

/**
 * Compute the midpoint between two points (for label placement).
 */
export function getLineMidpoint(startPos: Point, endPos: Point): Point {
  return {
    x: (startPos.x + endPos.x) / 2,
    y: (startPos.y + endPos.y) / 2,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/connectorRouter.ts
git commit -m "feat: add connector straight-line routing utility"
```

---

### Task 4: Add anchorIndex to useCanvasStore

**Files:**
- Modify: `src/stores/useCanvasStore.ts`
- Check: `src/sync/SyncManager.ts` (for how incoming shapes flow into setShapes)

- [ ] **Step 1: Add anchorIndex to CanvasState and maintain in mutations**

Modify `src/stores/useCanvasStore.ts` — all changes inline:

```typescript
import { create } from 'zustand'
import type Konva from 'konva'
import type { Shape, ConnectorExtras } from '../types'

interface CanvasState {
  shapes: Shape[]
  stageX: number
  stageY: number
  scale: number
  gridVisible: boolean
  getStage: (() => Konva.Stage | null) | null
  /** anchorIndex: shapeId → Set<connectionId> for O(1) connector lookup */
  anchorIndex: Map<string, Set<string>>
  setShapes: (shapes: Shape[]) => void
  addShape: (shape: Shape, remote?: boolean) => void
  updateShape: (id: string, partial: Partial<Shape>, remote?: boolean) => void
  removeShape: (id: string, remote?: boolean) => void
  clearCanvas: (remote?: boolean) => void
  setViewport: (x: number, y: number, scale: number) => void
  setStageGetter: (getter: () => Konva.Stage | null) => void
  setGridVisible: (visible: boolean) => void
  undoOwn: (userId: string) => string | null
  /** Rebuild anchorIndex from all connector shapes */
  rebuildAnchorIndex: () => void
  /** Get all connection IDs that reference a given shape */
  getConnectionsForShape: (shapeId: string) => Set<string>
}

let idCounter = 0
export const generateId = (): string => `shape_${Date.now()}_${++idCounter}`

export const useCanvasStore = create<CanvasState>((set, get) => ({
  shapes: [],
  stageX: 0,
  stageY: 0,
  scale: 1,
  gridVisible: true,
  getStage: null,
  anchorIndex: new Map(),

  setViewport: (x, y, scale) => set({ stageX: x, stageY: y, scale }),
  setStageGetter: (getter) => set({ getStage: getter }),
  setGridVisible: (visible) => set({ gridVisible: visible }),

  setShapes: (shapes) => {
    const ai = new Map<string, Set<string>>()
    for (const shape of shapes) {
      if (shape.type === 'connector' && shape.extras) {
        const extras = shape.extras as unknown as ConnectorExtras
        addToIndex(ai, extras.startShapeId, shape.id)
        addToIndex(ai, extras.endShapeId, shape.id)
      }
    }
    set({ shapes, anchorIndex: ai })
  },

  addShape: (shape, _remote = false) => {
    set((s) => {
      const ai = new Map(s.anchorIndex)
      if (shape.type === 'connector' && shape.extras) {
        const extras = shape.extras as unknown as ConnectorExtras
        addToIndex(ai, extras.startShapeId, shape.id)
        addToIndex(ai, extras.endShapeId, shape.id)
      }
      return { shapes: [...s.shapes, shape], anchorIndex: ai }
    })
  },

  updateShape: (id, partial, _remote = false) => {
    set((s) => {
      const ai = new Map(s.anchorIndex)
      const newShape = s.shapes.find((sh) => sh.id === id)
      if (newShape && newShape.type === 'connector' && newShape.extras) {
        const extras = newShape.extras as unknown as ConnectorExtras
        addToIndex(ai, extras.startShapeId, id)
        addToIndex(ai, extras.endShapeId, id)
      }
      return {
        shapes: s.shapes.map((sh) => (sh.id === id ? { ...sh, ...partial } : sh)),
        anchorIndex: ai,
      }
    })
  },

  removeShape: (id, _remote = false) => {
    set((s) => {
      const shape = s.shapes.find((sh) => sh.id === id)
      const ai = new Map(s.anchorIndex)

      // Cascade: if removing a shape, also remove all its connections
      if (shape && shape.type !== 'connector') {
        const connIds = ai.get(id)
        if (connIds) {
          s.shapes
            .filter((sh) => connIds.has(sh.id))
            .forEach((conn) => {
              ai.delete(conn.id)
              ai.delete((conn.extras as unknown as ConnectorExtras)?.startShapeId)
              ai.delete((conn.extras as unknown as ConnectorExtras)?.endShapeId)
            })
        }
        ai.delete(id)
      } else {
        // Removing a connector: clean index entries
        if (shape?.extras) {
          const extras = shape.extras as unknown as ConnectorExtras
          removeFromIndex(ai, extras.startShapeId, id)
          removeFromIndex(ai, extras.endShapeId, id)
        }
        ai.delete(id)
      }

      return {
        shapes: s.shapes.filter((sh) => {
          if (sh.id === id) return false
          // Also remove connections that reference the deleted shape
          if (shape && shape.type !== 'connector') {
            const refs = s.anchorIndex.get(id)
            if (refs?.has(sh.id)) return false
          }
          return true
        }),
        anchorIndex: ai,
      }
    })
  },

  clearCanvas: (_remote = false) => {
    set({ shapes: [], anchorIndex: new Map() })
  },

  undoOwn: (userId) => {
    const { shapes } = get()
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (shapes[i].userId === userId) {
        const shapeId = shapes[i].id
        const ai = new Map(get().anchorIndex)
        // Clean anchorIndex for removed shape and its connections
        const removed = shapes.filter((_, idx) => {
          if (idx === i) return true
          // Also remove connections on this shape if they belong to user
          return false
        })
        set({ shapes: shapes.filter((_, idx) => idx !== i), anchorIndex: ai })
        return shapeId
      }
    }
    return null
  },

  rebuildAnchorIndex: () => {
    const ai = new Map<string, Set<string>>()
    for (const shape of get().shapes) {
      if (shape.type === 'connector' && shape.extras) {
        const extras = shape.extras as unknown as ConnectorExtras
        addToIndex(ai, extras.startShapeId, shape.id)
        addToIndex(ai, extras.endShapeId, shape.id)
      }
    }
    set({ anchorIndex: ai })
  },

  getConnectionsForShape: (shapeId: string) => {
    return get().anchorIndex.get(shapeId) ?? new Set()
  },
}))

// Index helpers (not exported, file-private)
function addToIndex(ai: Map<string, Set<string>>, shapeId: string, connId: string) {
  if (!ai.has(shapeId)) ai.set(shapeId, new Set())
  ai.get(shapeId)!.add(connId)
}

function removeFromIndex(ai: Map<string, Set<string>>, shapeId: string, connId: string) {
  const set = ai.get(shapeId)
  if (set) {
    set.delete(connId)
    if (set.size === 0) ai.delete(shapeId)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/stores/useCanvasStore.ts
git commit -m "feat: add anchorIndex to canvas store for connector O(1) lookup"
```

---

### Task 5: Create ConnectorTool.tsx — renderer + shapeRegistry registration

**Files:**
- Create: `src/tools/ConnectorTool.tsx`

- [ ] **Step 1: Write the connector renderer**

Create `src/tools/ConnectorTool.tsx`:

```typescript
import { Group, Arrow, Circle } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point, ConnectorExtras } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { getAnchorPosition, findNearestAnchor } from '../utils/anchorUtils'
import { routeConnection } from '../utils/connectorRouter'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useToolStore } from '../stores/useToolStore'
import { getSyncManager } from '../sync/SyncManager'

interface ConnectorShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

function ConnectorShape({ shape, isSelected, onSelect, shapeRef }: ConnectorShapeProps) {
  const points = shape.points
  const extras = shape.extras as unknown as ConnectorExtras | undefined

  // Arrow head config
  const endArrow = extras?.arrowEnd || 'triangle'
  const startArrow = extras?.arrowStart || 'none'
  const stroke = shape.style.strokeColor || '#2563EB'
  const strokeW = shape.style.strokeWidth || 2
  const arrowLen = Math.min(12, Math.hypot(points[2] - points[0], points[3] - points[1]) / 4)
  const arrowW = Math.min(8, arrowLen * 0.8)

  return (
    <>
      <Arrow
        id={shape.id}
        points={points}
        stroke={stroke}
        strokeWidth={strokeW}
        fill={stroke}
        pointerLength={endArrow !== 'none' ? arrowLen : 0}
        pointerWidth={endArrow !== 'none' ? arrowW : 0}
        onClick={onSelect}
        onTap={onSelect}
        hitStrokeWidth={12}
      />
      {/* Selected anchor handles for reconnecting */}
      {isSelected && extras && (
        <>
          <Circle
            x={points[0]}
            y={points[1]}
            radius={6}
            fill="white"
            stroke="#2563EB"
            strokeWidth={2}
            draggable
            onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
              const node = e.target
              const newPoints = [...points]
              newPoints[0] = node.x()
              newPoints[1] = node.y()
              useCanvasStore.getState().updateShape(shape.id, { points: newPoints })
            }}
            onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
              const node = e.target
              const shapeStore = useCanvasStore.getState()
              const pos: Point = { x: node.x(), y: node.y() }
              let snapped = false
              for (const s of shapeStore.shapes) {
                if (s.id === shape.id || s.type === 'connector') continue
                const nearest = findNearestAnchor(s, pos, 16)
                if (nearest) {
                  const newExtras = { ...extras, startAnchor: nearest.anchor, startShapeId: s.id }
                  const anchorPos = getAnchorPosition(s, nearest.anchor)
                  const routed = routeConnection(anchorPos, { x: points[2], y: points[3] })
                  shapeStore.updateShape(shape.id, { points: routed, extras: newExtras as any })
                  const sm = getSyncManager()
                  if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: routed, extras: newExtras as any } })
                  snapped = true
                  break
                }
              }
              if (!snapped) {
                shapeStore.updateShape(shape.id, { points: [points[0], points[1], node.x(), node.y()] })
              }
            }}
          />
          <Circle
            x={points[2]}
            y={points[3]}
            radius={6}
            fill="white"
            stroke="#2563EB"
            strokeWidth={2}
            draggable
            onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
              const node = e.target
              const newPoints = [...points]
              newPoints[2] = node.x()
              newPoints[3] = node.y()
              useCanvasStore.getState().updateShape(shape.id, { points: newPoints })
            }}
            onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
              const node = e.target
              const shapeStore = useCanvasStore.getState()
              const pos: Point = { x: node.x(), y: node.y() }
              let snapped = false
              for (const s of shapeStore.shapes) {
                if (s.id === shape.id || s.type === 'connector') continue
                const nearest = findNearestAnchor(s, pos, 16)
                if (nearest) {
                  const newExtras = { ...extras, endAnchor: nearest.anchor, endShapeId: s.id }
                  const anchorPos = getAnchorPosition(s, nearest.anchor)
                  const routed = routeConnection({ x: points[0], y: points[1] }, anchorPos)
                  shapeStore.updateShape(shape.id, { points: routed, extras: newExtras as any })
                  const sm = getSyncManager()
                  if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: routed, extras: newExtras as any } })
                  snapped = true
                  break
                }
              }
              if (!snapped) {
                shapeStore.updateShape(shape.id, { points: [points[0], points[1], node.x(), node.y()] })
              }
            }}
          />
        </>
      )}
    </>
  )
}

// Register with shape registry
shapeRegistry.register({
  type: 'connector',
  label: '连接线',
  icon: '→',
  category: 'arrow',
  renderer: (props) => <ConnectorShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { strokeColor: '#2563EB', strokeWidth: 2 },
  getTransformerConfig: () => ({
    enabledAnchors: [],
    rotateEnabled: false,
    keepRatio: false,
  }),
})
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/ConnectorTool.tsx
git commit -m "feat: add ConnectorTool renderer with draggable endpoints"
```

---

### Task 6: Create AnchorOverlay.tsx — hover anchor display + drag-to-connect

**Files:**
- Create: `src/components/AnchorOverlay.tsx`

- [ ] **Step 1: Write the anchor overlay component**

Create `src/components/AnchorOverlay.tsx`:

```typescript
import { useState, useRef, useCallback, useEffect } from 'react'
import { Group, Circle, Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point, Anchor, ConnectorExtras } from '../types'
import { getAnchorPositions, findNearestAnchor, isPointInShapeBounds } from '../utils/anchorUtils'
import { routeConnection } from '../utils/connectorRouter'
import { useCanvasStore, generateId } from '../stores/useCanvasStore'
import { useToolStore } from '../stores/useToolStore'
import { getSyncManager } from '../sync/SyncManager'

interface AnchorOverlayProps {
  shapes: Shape[]
  scale: number
  getPointerPos: () => Point
  userId?: string | null
}

export function AnchorOverlay({ shapes, scale, getPointerPos, userId }: AnchorOverlayProps) {
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{
    fromShapeId: string
    fromAnchor: Anchor
    fromPos: Point
    currentPos: Point
  } | null>(null)
  const hoverTimerRef = useRef<number | null>(null)

  const hoveredShape = shapes.find((s) => s.id === hoveredShapeId)
  const anchors = hoveredShape ? getAnchorPositions(hoveredShape) : null

  // Mouse tracking for hover detection
  useEffect(() => {
    const checkHover = () => {
      const pos = getPointerPos()
      let found: string | null = null
      for (const shape of shapes) {
        if (shape.type === 'connector') continue
        if (isPointInShapeBounds(shape, pos, 4 / scale)) {
          found = shape.id
          break
        }
      }
      if (found !== hoveredShapeId) {
        setHoveredShapeId(found)
      }
    }

    const stage = useCanvasStore.getState().getStage?.()
    if (!stage) return
    const container = stage.container()
    container.addEventListener('mousemove', checkHover)
    return () => container.removeEventListener('mousemove', checkHover)
  }, [shapes, hoveredShapeId, scale, getPointerPos])

  const handleAnchorMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>, shapeId: string, anchor: Anchor) => {
    e.cancelBubble = true
    const shape = shapes.find((s) => s.id === shapeId)
    if (!shape) return
    const pos = getAnchorPositions(shape)[anchor]
    setDragging({
      fromShapeId: shapeId,
      fromAnchor: anchor,
      fromPos: pos,
      currentPos: pos,
    })
  }, [shapes])

  // Track mouse during drag
  useEffect(() => {
    if (!dragging) return
    const stage = useCanvasStore.getState().getStage?.()
    if (!stage) return
    const container = stage.container()

    const onMove = () => {
      const pos = getPointerPos()
      setDragging((prev) => prev ? { ...prev, currentPos: pos } : null)
    }
    const onUp = () => {
      setDragging((prev) => {
        if (!prev) return null
        const pos = getPointerPos()

        // Find target shape + anchor
        for (const shape of shapes) {
          if (shape.id === prev.fromShapeId || shape.type === 'connector') continue
          const nearest = findNearestAnchor(shape, pos, 16 / scale)
          if (nearest) {
            // Create connector shape
            const routed = routeConnection(prev.fromPos, nearest.position)
            const style = useToolStore.getState().style
            const connector: Shape = {
              id: generateId(),
              type: 'connector',
              points: routed,
              style: { ...style },
              userId: userId || undefined,
              extras: {
                startShapeId: prev.fromShapeId,
                endShapeId: shape.id,
                startAnchor: prev.fromAnchor,
                endAnchor: nearest.anchor,
                arrowEnd: 'triangle',
                arrowStart: 'none',
                lineStyle: 'solid',
              } as ConnectorExtras,
            }
            useCanvasStore.getState().addShape(connector)
            const sm = getSyncManager()
            if (sm) sm.send({ type: 'operation', action: 'draw', shape: connector })
            break
          }
        }
        return null
      })
    }

    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseup', onUp)
    return () => {
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseup', onUp)
    }
  }, [dragging, shapes, scale, getPointerPos, userId])

  if (!anchors && !dragging) return null

  const anchorSize = 5 / scale
  const hitSize = 10 / scale

  return (
    <Group listening={false}>
      {/* Hover anchors */}
      {anchors && !dragging && Object.entries(anchors).map(([anchorName, pos]) => (
        <Circle
          key={anchorName}
          x={pos.x}
          y={pos.y}
          radius={anchorSize}
          fill="#2563EB"
          stroke="white"
          strokeWidth={1.5 / scale}
          listening={true}
          onMouseDown={(e) => handleAnchorMouseDown(e, hoveredShapeId!, anchorName as Anchor)}
          hitFunc={(ctx) => {
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, hitSize, 0, Math.PI * 2)
            ctx.fillStrokeShape({ x: pos.x, y: pos.y })
          }}
        />
      ))}

      {/* Drag preview line */}
      {dragging && (
        <Line
          points={[dragging.fromPos.x, dragging.fromPos.y, dragging.currentPos.x, dragging.currentPos.y]}
          stroke="#2563EB"
          strokeWidth={2 / scale}
          dash={[8 / scale, 4 / scale]}
          listening={false}
        />
      )}
    </Group>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AnchorOverlay.tsx
git commit -m "feat: add AnchorOverlay — hover anchors + drag-to-connect"
```

---

### Task 7: Integrate connector system into WhiteboardCanvas

**Files:**
- Modify: `src/components/WhiteboardCanvas.tsx`
- Modify: `src/tools/registerAll.ts`

- [ ] **Step 1: Add ConnectorTool import to registerAll.ts**

Add after the existing arrow imports in `src/tools/registerAll.ts`:

```typescript
// Connector system
import './ConnectorTool'
```

- [ ] **Step 2: Add connection follow logic to WhiteboardCanvas**

In `src/components/WhiteboardCanvas.tsx`, add these imports at the top of the file:

```typescript
import { AnchorOverlay } from './AnchorOverlay'
import { getAnchorPosition } from '../utils/anchorUtils'
import { routeConnection } from '../utils/connectorRouter'
```

Then in `handleTransformEnd`, after the `useCanvasStore.getState().updateShape(selectedId, updated)` call (line ~141), add connector follow logic:

```typescript
    // --- Connector follow: update connected lines ---
    const store = useCanvasStore.getState()
    const connIds = store.getConnectionsForShape(selectedId)
    if (connIds.size > 0) {
      connIds.forEach((cid) => {
        const conn = shapes.find((s) => s.id === cid)
        if (!conn || conn.type !== 'connector' || !conn.extras) return
        const extras = conn.extras as unknown as import('../types').ConnectorExtras

        let startPos: Point
        let endPos: Point
        if (extras.startShapeId === selectedId) {
          const startShape = store.shapes.find((s: Shape) => s.id === extras.startShapeId)
          startPos = startShape ? getAnchorPosition(startShape as any, extras.startAnchor) : { x: conn.points[0], y: conn.points[1] }
        } else {
          startPos = { x: conn.points[0], y: conn.points[1] }
        }
        if (extras.endShapeId === selectedId) {
          const endShape = store.shapes.find((s: Shape) => s.id === extras.endShapeId)
          endPos = endShape ? getAnchorPosition(endShape as any, extras.endAnchor) : { x: conn.points[2], y: conn.points[3] }
        } else {
          endPos = { x: conn.points[2], y: conn.points[3] }
        }

        const newPoints = routeConnection(startPos, endPos)
        store.updateShape(cid, { points: newPoints })
        const updatedConn = { ...conn, points: newPoints }
        syncSend('update', updatedConn)
      })
    }
    // --- End connector follow ---
```

- [ ] **Step 3: Add AnchorOverlay to the Stage children**

In the JSX, add `<AnchorOverlay>` inside the `<Layer>` after `{shapes.map(renderShape)}`:

```tsx
          {shapes.map(renderShape)}
          <AnchorOverlay
            shapes={shapes}
            scale={scale}
            getPointerPos={getPointerPos}
            userId={userId}
          />
          {renderDrawingPreview()}
```

- [ ] **Step 4: Add 'connector' to drawing tools whitelist (prevent creating on canvas click)**

In `handleMouseDown`, the `drawingTools` array already filters which tools start drawing on canvas click. Connector is NOT a click-to-draw tool (it's drag-from-anchor), so no change needed. The current whitelist won't include 'connector', which is correct.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/WhiteboardCanvas.tsx src/tools/registerAll.ts
git commit -m "feat: integrate connector system — anchor overlay + follow on transform"
```

---

### Task 8: Dev test — verify end-to-end connector flow

**Files:** (none — manual verification)

- [ ] **Step 1: Start dev servers and test**

Start backend: `cd backend && python run.py`
Start frontend: `npm run dev`

Verify the following in the browser at http://localhost:5173:

1. Enter a room and draw two rectangles on the canvas
2. Hover over the first rectangle → 9 blue anchor dots appear
3. Drag from one anchor → dashed preview line follows the mouse
4. Drop on an anchor of the second rectangle → connector line appears with arrow
5. Drag the first rectangle → connector updates its position in real time
6. Select the connector → white anchor handles appear at both ends
7. Drag an anchor handle to a different shape's anchor → connector reattaches
8. Delete one of the connected shapes → connector is also removed
9. Ctrl+Z undo → both shape and connector are restored

- [ ] **Step 2: Commit any fixes**

If issues found during testing, fix and commit.

```bash
git add -A
git commit -m "fix: connector integration test fixes"
```

---

### Task 9: Commit final state

- [ ] **Step 1: Run build to confirm**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 connector system — drag-to-connect anchors with follow"
```
