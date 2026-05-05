# Phase 2A: 新图形类型 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 增加 5 种新形状（line/diamond/triangle/pentagon/star），共用 `<Line closed>` 渲染 + 通用多边形变换函数。

**Architecture:** 所有新形状统一模式：重心定位 + 相对坐标 + `computePolygonTransform` 通用变换。遵循现有 5 步骤管线（类型→ToolManager→渲染组件→WhiteboardCanvas→transformUtils）。

**Tech Stack:** React 18, react-konva, Konva 9, TypeScript (same stack — no new deps)

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/types/index.ts` | Modify | 扩展 ToolType 联合 5 个字面量 |
| `src/tools/ToolManager.ts` | Modify | updateShapePoints 新增 5 个 case |
| `src/tools/LineTool.tsx` | Create | LineShape 渲染组件 |
| `src/tools/TriangleTool.tsx` | Create | TriangleShape 渲染组件 |
| `src/tools/StarTool.tsx` | Create | StarShape 渲染组件 |
| `src/tools/DiamondTool.tsx` | Create | DiamondShape 渲染组件 |
| `src/tools/PentagonTool.tsx` | Create | PentagonShape 渲染组件 |
| `src/tools/transformUtils.ts` | Modify | 新增通用 computePolygonTransform + 5 个 case |
| `src/components/WhiteboardCanvas.tsx` | Modify | renderShape + renderDrawingPreview + getTransformerConfig 各加 5 case |
| `src/components/Toolbar.tsx` | Modify | tools 数组新增 5 条目 |

---

### Task 1: Extend ToolType union

**Files:**
- Modify: `src/types/index.ts:1`

- [ ] **Step 1: Add 5 new type literals to ToolType**

```ts
export type ToolType = 'brush' | 'rectangle' | 'circle' | 'arrow' | 'text'
  | 'line' | 'triangle' | 'star' | 'diamond' | 'pentagon'
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Multiple errors about missing cases in ToolManager.ts, transformUtils.ts, WhiteboardCanvas.tsx — these will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: extend ToolType with line/triangle/star/diamond/pentagon"
```

---

### Task 2: Add drawing logic in ToolManager

**Files:**
- Modify: `src/tools/ToolManager.ts:19-38`

- [ ] **Step 1: Read current file and add 5 new cases to updateShapePoints**

In the `switch (shape.type)` block of `updateShapePoints`, add these cases BEFORE the `default` case:

```ts
case 'line':
  return [sx, sy, currentPoint.x, currentPoint.y]

case 'triangle': {
  const minX = Math.min(sx, currentPoint.x), maxX = Math.max(sx, currentPoint.x)
  const minY = Math.min(sy, currentPoint.y), maxY = Math.max(sy, currentPoint.y)
  const midX = (minX + maxX) / 2
  return [midX, minY, minX, maxY, maxX, maxY]  // top, bottom-left, bottom-right
}

case 'diamond': {
  const minX = Math.min(sx, currentPoint.x), maxX = Math.max(sx, currentPoint.x)
  const minY = Math.min(sy, currentPoint.y), maxY = Math.max(sy, currentPoint.y)
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2
  return [midX, minY, maxX, midY, midX, maxY, minX, midY]  // top, right, bottom, left
}

case 'pentagon': {
  const minX = Math.min(sx, currentPoint.x), maxX = Math.max(sx, currentPoint.x)
  const minY = Math.min(sy, currentPoint.y), maxY = Math.max(sy, currentPoint.y)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const r = Math.min(maxX - minX, maxY - minY) / 2
  const pts: number[] = []
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 5
    pts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
  }
  return pts
}

case 'star': {
  const minX = Math.min(sx, currentPoint.x), maxX = Math.max(sx, currentPoint.x)
  const minY = Math.min(sy, currentPoint.y), maxY = Math.max(sy, currentPoint.y)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const outerR = Math.min(maxX - minX, maxY - minY) / 2
  const innerR = outerR * 0.382
  const pts: number[] = []
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 5
    const r = i % 2 === 0 ? outerR : innerR
    pts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
  }
  return pts
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Fewer errors — ToolManager is now covered. Remaining errors about missing cases in transformUtils and WhiteboardCanvas.

- [ ] **Step 3: Commit**

```bash
git add src/tools/ToolManager.ts
git commit -m "feat: add drawing logic for 5 new shape types in ToolManager"
```

---

### Task 3: Create shape renderers

**Files:**
- Create: `src/tools/LineTool.tsx`
- Create: `src/tools/TriangleTool.tsx`
- Create: `src/tools/StarTool.tsx`
- Create: `src/tools/DiamondTool.tsx`
- Create: `src/tools/PentagonTool.tsx`

All 5 renderers follow the exact same pattern. Each renders a `<Line>` (closed for diamond/triangle/star/pentagon, open for line) positioned at its geometric centroid with relative vertex coordinates.

- [ ] **Step 1: Create LineTool.tsx**

```tsx
import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface LineShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function LineShape({ shape, isSelected, onSelect, shapeRef }: LineShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  return (
    <Line
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      points={[x1 - cx, y1 - cy, x2 - cx, y2 - cy]}
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={shape.style.strokeWidth + 10}
    />
  )
}
```

- [ ] **Step 2: Create DiamondTool.tsx**

```tsx
import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface DiamondShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function DiamondShape({ shape, isSelected, onSelect, shapeRef }: DiamondShapeProps) {
  const pts = shape.points
  const cx = (pts[0] + pts[2] + pts[4] + pts[6]) / 4
  const cy = (pts[1] + pts[3] + pts[5] + pts[7]) / 4

  return (
    <Line
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      points={pts.map((v, i) => i % 2 === 0 ? v - cx : v - cy)}
      closed
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

- [ ] **Step 3: Create TriangleTool.tsx**

Same pattern as DiamondShape but centroid is `(pts[0]+pts[2]+pts[4])/3, (pts[1]+pts[3]+pts[5])/3` and `closed={true}`.

- [ ] **Step 4: Create PentagonTool.tsx**

Generic N-vertex centroid: sum all even-indexed / N, sum all odd-indexed / N. `closed={true}`. Number of vertices = `points.length / 2`.

- [ ] **Step 5: Create StarTool.tsx**

Same as PentagonShape — generic centroid from all points, `closed={true}`.

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Errors about missing imports in WhiteboardCanvas — will be fixed in Task 5.

- [ ] **Step 7: Commit**

```bash
git add src/tools/LineTool.tsx src/tools/TriangleTool.tsx src/tools/StarTool.tsx src/tools/DiamondTool.tsx src/tools/PentagonTool.tsx
git commit -m "feat: add 5 new shape renderer components (line/diamond/triangle/pentagon/star)"
```

---

### Task 4: Add transform logic in transformUtils

**Files:**
- Modify: `src/tools/transformUtils.ts`

- [ ] **Step 1: Add computePolygonTransform and 5 new cases**

Add this helper BEFORE the existing compute functions:

```ts
// Shared polygon transform: scales local points, applies rotation matrix, translates to world coords.
// Works for any number of vertex pairs. Rotation is fully baked into world-space points.
function computePolygonTransform(shape: Shape, node: Konva.Line): TransformResult {
  const cx = node.x()
  const cy = node.y()
  const rotation = node.rotation()
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  const localPoints = node.points()
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const newPoints: number[] = []
  for (let i = 0; i < localPoints.length; i += 2) {
    const lx = localPoints[i] * scaleX
    const ly = localPoints[i + 1] * scaleY
    newPoints.push(
      cx + lx * cos - ly * sin,
      cy + lx * sin + ly * cos
    )
  }
  return { points: newPoints }
}
```

In `computeTransformedPoints`, add these 5 cases to the switch BEFORE the `default`:

```ts
case 'line':
  return computePolygonTransform(shape, node as Konva.Line)
case 'triangle':
  return computePolygonTransform(shape, node as Konva.Line)
case 'star':
  return computePolygonTransform(shape, node as Konva.Line)
case 'diamond':
  return computePolygonTransform(shape, node as Konva.Line)
case 'pentagon':
  return computePolygonTransform(shape, node as Konva.Line)
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Only WhiteboardCanvas errors remaining.

- [ ] **Step 3: Commit**

```bash
git add src/tools/transformUtils.ts
git commit -m "feat: add polygon transform logic for 5 new shape types"
```

---

### Task 5: Integrate into WhiteboardCanvas

**Files:**
- Modify: `src/components/WhiteboardCanvas.tsx`

- [ ] **Step 1: Add imports**

Add after the TextShape import:
```tsx
import { LineShape } from '../tools/LineTool'
import { TriangleShape } from '../tools/TriangleTool'
import { StarShape } from '../tools/StarTool'
import { DiamondShape } from '../tools/DiamondTool'
import { PentagonShape } from '../tools/PentagonTool'
```

- [ ] **Step 2: Add 5 cases to renderShape**

In the switch block, add BEFORE `default`:
```tsx
case 'line': return <LineShape key={shape.id} {...props} />
case 'triangle': return <TriangleShape key={shape.id} {...props} />
case 'star': return <StarShape key={shape.id} {...props} />
case 'diamond': return <DiamondShape key={shape.id} {...props} />
case 'pentagon': return <PentagonShape key={shape.id} {...props} />
```

- [ ] **Step 3: Add cases to renderDrawingPreview**

In the drawing preview switch, add the new shapes alongside existing rectangle/circle/arrow pattern:
```tsx
case 'line':
case 'triangle':
case 'star':
case 'diamond':
case 'pentagon': {
  const ShapeMap: Record<string, React.FC<{ shape: Shape }>> = {
    line: LineShape, triangle: TriangleShape, star: StarShape,
    diamond: DiamondShape, pentagon: PentagonShape,
  }
  const Comp = ShapeMap[drawingShape.type]
  return <Comp shape={drawingShape} />
}
```

- [ ] **Step 4: Verify getTransformerConfig covers new shapes**

The `default` branch already returns full anchors + rotation enabled — all 5 new shapes fall into this branch. No code change needed. Confirm by reading.

- [ ] **Step 5: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/WhiteboardCanvas.tsx
git commit -m "feat: integrate 5 new shapes into WhiteboardCanvas render pipeline"
```

---

### Task 6: Register in Toolbar

**Files:**
- Modify: `src/components/Toolbar.tsx:7-13`

- [ ] **Step 1: Add 5 entries to tools array**

Add after the `text` entry:
```tsx
{ type: 'line', label: '直线', icon: '📏' },
{ type: 'triangle', label: '三角', icon: '🔺' },
{ type: 'diamond', label: '菱形', icon: '🔷' },
{ type: 'pentagon', label: '五边', icon: '⬠' },
{ type: 'star', label: '星形', icon: '⭐' },
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat: register 5 new shape types in toolbar"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Start backend and frontend**

Terminal 1: `cd backend && python run.py`
Terminal 2: `npm run dev`

- [ ] **Step 2: Test each new shape**

For each of line/diamond/triangle/pentagon/star:
- Click tool in toolbar → draw on canvas → shape appears ✓
- Select shape → Transformer appears with handles ✓
- Drag to move → position updates ✓
- Resize via corner handles → size updates ✓
- Rotate via rotation anchor → rotation applied ✓
- Delete via keyboard → removed ✓
- Ctrl+Z → undo works ✓
- Open second tab, join same room → shape syncs ✓

- [ ] **Step 3: Verify production build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit if any fixes**

```bash
git add -A && git commit -m "chore: Phase 2A verification complete"
```
