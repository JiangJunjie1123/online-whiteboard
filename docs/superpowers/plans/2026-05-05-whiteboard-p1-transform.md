# Whiteboard Phase 1: Selection + Transform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shape selection (visual highlight + Transformer) and transform (move/resize/rotate) to all 5 shape types using Konva.Transformer.

**Architecture:** Single Konva `<Transformer>` in WhiteboardCanvas binds to the selected shape's Konva node via a ref map. Each shape renderer forwards a `shapeRef` callback. On `transformend`, node attributes (x/y/scale/rotation) are converted back to `points` + `rotation` fields and synced via existing `operation/update` protocol. Backend: zero changes.

**Tech Stack:** React 18, react-konva 18, Konva 9, TypeScript, Zustand (existing stack — no new deps)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/tools/BrushTool.tsx` | Modify | Add `shapeRef` prop, forward to Line |
| `src/tools/RectangleTool.tsx` | Modify | Add `shapeRef` prop, forward to Rect, apply rotation |
| `src/tools/CircleTool.tsx` | Modify | Add `shapeRef` prop, forward to Ellipse, apply rotation |
| `src/tools/ArrowTool.tsx` | Modify | Add `shapeRef` prop, forward to Arrow, apply rotation |
| `src/tools/TextTool.tsx` | Modify | Add `shapeRef` prop, forward to Text, apply rotation |
| `src/tools/transformUtils.ts` | Create | Points conversion functions per shape type |
| `src/components/WhiteboardCanvas.tsx` | Modify | Add Transformer, shapeNodes ref map, transformend handler, click-empty-deselect |

---

### Task 1: Add shapeRef forwarding to shape renderers

**Files:**
- Modify: `src/tools/BrushTool.tsx`
- Modify: `src/tools/RectangleTool.tsx`
- Modify: `src/tools/CircleTool.tsx`
- Modify: `src/tools/ArrowTool.tsx`
- Modify: `src/tools/TextTool.tsx`

- [ ] **Step 1: Update BrushTool.tsx**

Change the import to include Konva and add `shapeRef` prop, forwarding it to the Line node.

```tsx
import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface BrushShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function BrushShape({ shape, isSelected, onSelect, shapeRef }: BrushShapeProps) {
  return (
    <Line
      id={shape.id}
      ref={shapeRef}
      points={shape.points}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      opacity={shape.style.opacity}
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      globalCompositeOperation="source-over"
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={shape.style.strokeWidth + 10}
    />
  )
}
```

- [ ] **Step 2: Update RectangleTool.tsx**

Add `shapeRef` prop, apply `shape.rotation` to the Rect node.

```tsx
import { Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface RectShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Rect | null) => void
}

export function RectangleShape({ shape, isSelected, onSelect, shapeRef }: RectShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)

  return (
    <Rect
      id={shape.id}
      ref={shapeRef}
      x={x}
      y={y}
      width={width || 1}
      height={height || 1}
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.fillColor}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
    />
  )
}
```

- [ ] **Step 3: Update CircleTool.tsx**

Add `shapeRef` prop, apply `shape.rotation`.

```tsx
import { Ellipse } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface CircleShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Ellipse | null) => void
}

export function CircleShape({ shape, isSelected, onSelect, shapeRef }: CircleShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const rx = Math.abs(x2 - x1) / 2
  const ry = Math.abs(y2 - y1) / 2

  return (
    <Ellipse
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      radiusX={rx || 1}
      radiusY={ry || 1}
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.fillColor}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
    />
  )
}
```

- [ ] **Step 4: Update ArrowTool.tsx**

Add `shapeRef` prop, apply `shape.rotation`. Arrow needs special handling — rotation is around the arrow's center, not (0,0).

```tsx
import { Arrow } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface ArrowShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Arrow | null) => void
}

export function ArrowShape({ shape, isSelected, onSelect, shapeRef }: ArrowShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  return (
    <Arrow
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      points={[x1 - cx, y1 - cy, x2 - cx, y2 - cy]}
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.strokeColor}
      opacity={shape.style.opacity}
      pointerLength={Math.min(15, len / 3)}
      pointerWidth={Math.min(10, len / 4)}
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={shape.style.strokeWidth + 10}
    />
  )
}
```

> Arrow note: Konva's Arrow component anchors at (x, y) and rotates around that point. By setting x/y to the midpoint and using relative points, rotation works correctly around the arrow's center.

- [ ] **Step 5: Update TextTool.tsx**

Add `shapeRef` prop, apply `shape.rotation`. Remove `draggable` (Transformer handles dragging now).

```tsx
import { Text } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface TextShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Text | null) => void
}

export function TextShape({ shape, isSelected, onSelect, shapeRef }: TextShapeProps) {
  return (
    <Text
      id={shape.id}
      ref={shapeRef}
      x={shape.points[0]}
      y={shape.points[1]}
      text={shape.text || '文本'}
      fontSize={shape.style.fontSize || 24}
      fill={shape.style.strokeColor}
      opacity={shape.style.opacity}
      rotation={shape.rotation || 0}
      onClick={onSelect}
      onTap={onSelect}
    />
  )
}
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/tools/BrushTool.tsx src/tools/RectangleTool.tsx src/tools/CircleTool.tsx src/tools/ArrowTool.tsx src/tools/TextTool.tsx
git commit -m "feat: add shapeRef forwarding to all shape renderers for Transformer support"
```

---

### Task 2: Create transform points utilities

**Files:**
- Create: `src/tools/transformUtils.ts`

This module converts Konva node attributes back to `points` + `rotation` after a transform operation. Dependency-free pure functions.

- [ ] **Step 1: Write transformUtils.ts**

```ts
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

// Brush: move only. Compute delta from node position (old=0,0) and apply to all points.
// After baking, reset node x/y to 0, scale to 1.
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
// After transform, compute world-space start/end from local points + node position + rotation.
function computeArrowTransform(shape: Shape, node: Konva.Arrow): TransformResult {
  const cx = node.x()
  const cy = node.y()
  const rotation = node.rotation()
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()

  // Reconstruct world-space start/end from the transformed node
  // Original local points (relative to midpoint): [localX1, localY1, localX2, localY2]
  const localPoints = node.points()
  const localX1 = localPoints[0] * scaleX
  const localY1 = localPoints[1] * scaleY
  const localX2 = localPoints[2] * scaleX
  const localY2 = localPoints[3] * scaleY

  // Apply rotation
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

// Node transform reset is handled inline in WhiteboardCanvas after computing new points.
// Each type resets x/y/scaleX/scaleY/rotation to identity since the transform
// has been baked into the points/rotation/fontSize fields.
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/transformUtils.ts
git commit -m "feat: add transform points conversion utilities"
```

---

### Task 3: Integrate Transformer in WhiteboardCanvas

**Files:**
- Modify: `src/components/WhiteboardCanvas.tsx`

This is the core integration: add Transformer, shapeNodes ref map, transformend handler, and click-empty-to-deselect.

- [ ] **Step 1: Update imports in WhiteboardCanvas.tsx**

Replace the current import block (lines 1-14) with:

```tsx
import { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useToolStore } from '../stores/useToolStore'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useUserStore } from '../stores/useUserStore'
import { createShape, updateShapePoints, isClick } from '../tools/ToolManager'
import { BrushShape } from '../tools/BrushTool'
import { RectangleShape } from '../tools/RectangleTool'
import { CircleShape } from '../tools/CircleTool'
import { ArrowShape } from '../tools/ArrowTool'
import { TextShape } from '../tools/TextTool'
import { computeTransformedPoints } from '../tools/transformUtils'
import { getSyncManager } from '../sync/SyncManager'
import type { Shape, Point } from '../types'
```

- [ ] **Step 2: Add new state and refs**

Add these after the `cursorThrottle` ref declaration (after current line 24):

```tsx
const transformerRef = useRef<Konva.Transformer>(null)
const shapeNodesRef = useRef<Map<string, Konva.Node>>(new Map())
```

- [ ] **Step 3: Add shapeRef callback and node registration**

Add this after the `syncSend` callback (after current line 47):

```tsx
// Register/unregister Konva node refs for Transformer binding
const getShapeRef = useCallback((id: string) => (node: Konva.Node | null) => {
  if (node) {
    shapeNodesRef.current.set(id, node)
  } else {
    shapeNodesRef.current.delete(id)
  }
}, [])

// Bind Transformer to selected shape node; unbind on deselect
useEffect(() => {
  const transformer = transformerRef.current
  if (!transformer) return

  if (selectedId) {
    const node = shapeNodesRef.current.get(selectedId)
    if (node) {
      transformer.nodes([node])
      transformer.getLayer()?.batchDraw()
    }
  } else {
    transformer.nodes([])
    transformer.getLayer()?.batchDraw()
  }
}, [selectedId, shapes])
```

The `shapes` dependency ensures Transformer re-binds when shape list changes (e.g., remote sync replaces a node).

- [ ] **Step 4: Add transformer config and transformend handler**

Add this after the `useEffect` from Step 3:

```tsx
// Get Transformer anchor configuration per shape type
const getTransformerConfig = useCallback((shape: Shape) => {
  switch (shape.type) {
    case 'brush':
      return {
        enabledAnchors: [] as string[],
        rotateEnabled: false,
        keepRatio: false,
      }
    case 'text':
      return {
        enabledAnchors: [] as string[],
        rotateEnabled: true,
        keepRatio: false,
      }
    default:
      return {
        enabledAnchors: [
          'top-left', 'top-center', 'top-right',
          'middle-left', 'middle-right',
          'bottom-left', 'bottom-center', 'bottom-right',
        ] as string[],
        rotateEnabled: true,
        keepRatio: false,
      }
  }
}, [])

const handleTransformEnd = useCallback(() => {
  const transformer = transformerRef.current
  if (!transformer || !selectedId) return

  const node = shapeNodesRef.current.get(selectedId)
  if (!node) return

  const shape = shapes.find((s) => s.id === selectedId)
  if (!shape) return

  // Compute new points + rotation from transformed node
  const result = computeTransformedPoints(shape, node)

  // Reset node transform to identity (points now hold the baked state)
  node.x(0)
  node.y(0)
  node.scaleX(1)
  node.scaleY(1)
  node.rotation(0)

  // Build updated shape
  const updated: Partial<Shape> = {
    points: result.points,
    rotation: result.rotation,
  }
  if (result.fontSize !== undefined) {
    updated.style = { ...shape.style, fontSize: result.fontSize }
  }

  // Update local store
  useCanvasStore.getState().updateShape(selectedId, updated)

  // Sync to other clients
  const fullShape = { ...shape, ...updated, style: updated.style ?? shape.style }
  syncSend('update', fullShape)

  transformer.getLayer()?.batchDraw()
}, [selectedId, shapes, syncSend])
```

- [ ] **Step 5: Add click-empty-to-deselect on Stage**

Add `onMouseDown` handling for deselection. The Stage's `onMouseDown` needs to detect clicks on empty space. Since shape clicks are handled by each shape's `onClick`, we can use a flag to distinguish.

Replace the current `handleMouseDown` (lines 49-61) with:

```tsx
const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
  // Click on empty space → deselect
  if (e.target === e.target.getStage()) {
    setSelectedId(null)
    return
  }

  // Click on a shape that's not the currently selected one → select it
  // (shape onClick handlers handle selection toggling)
  if (e.target.getParent()?.id() && e.target !== e.target.getStage()) {
    // Let the shape's onClick handle selection
    return
  }
}, [])
```

Wait — this approach is problematic because `e.target` on the Stage level may not behave as expected. Better approach: use `onMouseDown` on the Stage with a check against the background.

Actually, the cleanest approach: the Stage `onMouseDown` is ONLY for starting a drawing operation. Deselection happens when clicking empty space. We need to detect "empty space" clicks.

Rethink: Stage `onMouseDown` fires for every click, including on shapes. We can check `e.target.name()` or compare `e.target` against the stage. In Konva, clicking on empty space means `e.target === stage`.

Let me revise the handleMouseDown:

```tsx
const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
  // Click on empty canvas area → deselect
  if (e.target === e.target.getStage()) {
    setSelectedId(null)
    // Also start drawing if not text tool
    if (activeTool !== 'text') {
      const pos = getPointerPos()
      const shape = createShape(activeTool, pos, style, userId || undefined)
      setDrawingShape(shape)
    }
    return
  }

  // Click on a shape — let the shape's onClick handle selection
  // Do NOT start drawing when clicking on an existing shape
}, [activeTool, style, getPointerPos, userId])
```

And text tool needs special handling — clicking empty space opens text input:

```tsx
  if (activeTool === 'text') {
    if (e.target === e.target.getStage()) {
      const pos = getPointerPos()
      setTextPos(pos)
      setTextValue('')
      setShowTextInput(true)
    }
    return
  }
```

Let me merge this properly. Here's the full revised handleMouseDown:

```tsx
const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
  // Click on empty canvas
  if (e.target === e.target.getStage()) {
    setSelectedId(null)
    const pos = getPointerPos()

    if (activeTool === 'text') {
      setTextPos(pos)
      setTextValue('')
      setShowTextInput(true)
      return
    }

    const shape = createShape(activeTool, pos, style, userId || undefined)
    setDrawingShape(shape)
    return
  }

  // Click on a shape — handled by shape's onClick (selection toggle)
}, [activeTool, style, getPointerPos, userId])
```

- [ ] **Step 6: Update renderShape to pass shapeRef**

Replace the `renderShape` function (lines 113-127) with:

```tsx
const renderShape = (shape: Shape) => {
  const props = {
    shape,
    isSelected: shape.id === selectedId,
    onSelect: () => handleSelectShape(shape.id),
    shapeRef: getShapeRef(shape.id),
  }
  switch (shape.type) {
    case 'brush': return <BrushShape key={shape.id} {...props} />
    case 'rectangle': return <RectangleShape key={shape.id} {...props} />
    case 'circle': return <CircleShape key={shape.id} {...props} />
    case 'arrow': return <ArrowShape key={shape.id} {...props} />
    case 'text': return <TextShape key={shape.id} {...props} />
    default: return null
  }
}
```

- [ ] **Step 7: Add Transformer to the Layer**

Replace the `<Layer>` content (lines 197-200) with:

```tsx
<Layer>
  {shapes.map(renderShape)}
  {renderDrawingPreview()}
  {selectedId && (
    <Transformer
      ref={transformerRef}
      {...getTransformerConfig(shapes.find((s) => s.id === selectedId)!)}
      onTransformEnd={handleTransformEnd}
      boundBoxFunc={(oldBox, newBox) => {
        // Prevent negative sizing
        if (newBox.width < 5 || newBox.height < 5) {
          return oldBox
        }
        return newBox
      }}
    />
  )}
</Layer>
```

- [ ] **Step 8: Update Stage's onMouseDown to use event object**

In the `<Stage>` JSX (line 191), change:
```tsx
onMouseDown={handleMouseDown}
```
(stays the same, but handleMouseDown signature now takes Konva event)

- [ ] **Step 9: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/WhiteboardCanvas.tsx
git commit -m "feat: integrate Konva Transformer for shape move/resize/rotate"
```

---

### Task 4: End-to-end verification

**Files:** None (testing only)

- [ ] **Step 1: Start backend and frontend, verify basic flow**

Terminal 1: `cd backend && python run.py`
Terminal 2: `npm run dev`

Open `http://localhost:5173` in two browser tabs, join the same room.

- [ ] **Step 2: Verify brush transform**

Draw a brush stroke in tab 1. Click it — Transformer appears with NO resize handles (only drag). Drag it to a new position. Verify:
- Shape moves locally in tab 1
- Shape moves in tab 2 (remote sync)
- Refresh tab 2 — shape is at the new position (sync on room_state)

- [ ] **Step 3: Verify rectangle transform**

Draw a rectangle. Select it — 8 resize handles + rotation anchor visible. Test:
- Drag to move ✓
- Drag corner handle to resize ✓
- Drag rotation anchor to rotate ✓
- All changes sync to tab 2 ✓

- [ ] **Step 4: Verify circle and arrow transform**

Same as rectangle — full transform including rotation.

- [ ] **Step 5: Verify text transform**

Create text. Select it — no resize handles, rotation anchor visible. Test:
- Drag to move ✓
- Rotate via anchor ✓
- Verify the rotation is stored and synced ✓

- [ ] **Step 6: Verify selection UX**

- Click shape → selected (Transformer appears) ✓
- Click same shape again → deselected ✓
- Click different shape → selection switches ✓
- Click empty canvas → deselected ✓
- Delete key → removes selected shape ✓
- Ctrl+Z → undo (works as before) ✓

- [ ] **Step 7: Commit final verification notes**

```bash
git add -A && git commit -m "chore: Phase 1 transform verification complete"
```
(Only if any changes were made during testing)
