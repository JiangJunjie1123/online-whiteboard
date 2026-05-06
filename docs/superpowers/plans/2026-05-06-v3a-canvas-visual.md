# V3A: 画布无限扩展 + 视觉风格升级 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现无限画布（平移/缩放）+ draw.io 风格网格背景与蓝色调色板

**Architecture:** Stage 视口层增加平移/缩放状态，坐标转换函数改屏幕→世界坐标；新增 GridBackground 组件用 Konva Layer + offscreen canvas pattern 渲染点阵背景；全局默认样式和 Tailwind 配色迁移至蓝色系

**Tech Stack:** React 18, Konva.js (react-konva), Zustand, Tailwind CSS, TypeScript

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/GridBackground.tsx` | 新建 | Konva 点阵网格背景层 |
| `src/stores/useCanvasStore.ts` | 修改 | 新增 viewport 状态 |
| `src/components/WhiteboardCanvas.tsx` | 修改 | Stage 拖拽/缩放、坐标转换、网格层 |
| `src/tools/transformUtils.ts` | 修改 | 烘焙变换除以 stage scale |
| `src/tools/ToolManager.ts` | 修改 | isClick 阈值缩放感知 |
| `src/components/RemoteCursor.tsx` | 修改 | 世界→屏幕坐标反算 |
| `src/stores/useToolStore.ts` | 修改 | 默认蓝色样式 |
| `tailwind.config.js` | 修改 | 颜色 tokens |
| `src/components/Sidebar.tsx` | 修改 | 蓝色系迁移 |
| `src/components/ShapePanel.tsx` | 修改 | 蓝色系迁移 |
| `src/tools/RectangleTool.tsx` | 修改 | 默认 cornerRadius |

---

### Task 1: Tailwind 颜色 Tokens

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: 添加颜色 tokens 到 tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A73E8',
          light: '#e8f0fe',
          hover: '#1557b0',
        },
        canvas: {
          bg: '#f8f9fa',
          dot: '#d0d5dd',
        },
        surface: '#ffffff',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tailwindcss -i src/index.css -o /dev/null --dry-run 2>&1 | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: 添加 primary/canvas/surface 颜色 tokens"
```

---

### Task 2: 默认样式改为蓝色系

**Files:**
- Modify: `src/stores/useToolStore.ts`

- [ ] **Step 1: 更新 useToolStore 默认样式**

修改 `src/stores/useToolStore.ts` line 16-21:

```typescript
export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'brush',
  style: {
    strokeColor: '#1A73E8',
    strokeWidth: 2,
    fillColor: '#e8f0fe',
    opacity: 1,
  },
  setTool: (tool) => set({ activeTool: tool }),
  setColor: (color) => set((s) => ({ style: { ...s.style, strokeColor: color } })),
  setStrokeWidth: (width) => set((s) => ({ style: { ...s.style, strokeWidth: width } })),
  setFillColor: (color) => set((s) => ({ style: { ...s.style, fillColor: color } })),
  setOpacity: (opacity) => set((s) => ({ style: { ...s.style, opacity: opacity } })),
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/useToolStore.ts
git commit -m "feat: 默认样式改为蓝色系 (#1A73E8, strokeWidth 2, 浅蓝填充)"
```

---

### Task 3: useCanvasStore 增加 viewport 状态

**Files:**
- Modify: `src/stores/useCanvasStore.ts`

- [ ] **Step 1: 在 CanvasState interface 中增加 viewport 字段**

在 `src/stores/useCanvasStore.ts` 中，interface 增加：

```typescript
interface CanvasState {
  shapes: Shape[]
  stageX: number
  stageY: number
  scale: number
  setShapes: (shapes: Shape[]) => void
  addShape: (shape: Shape, remote?: boolean) => void
  updateShape: (id: string, partial: Partial<Shape>, remote?: boolean) => void
  removeShape: (id: string, remote?: boolean) => void
  clearCanvas: (remote?: boolean) => void
  setViewport: (x: number, y: number, scale: number) => void
  undoOwn: (userId: string) => string | null
}
```

- [ ] **Step 2: 在 store 实现中增加初始值和 setViewport**

修改 `create<CanvasState>` 调用，增加初始值 (after `shapes: [],`) 和 action：

```typescript
export const useCanvasStore = create<CanvasState>((set, get) => ({
  shapes: [],
  stageX: 0,
  stageY: 0,
  scale: 1,

  setShapes: (shapes) => set({ shapes }),

  setViewport: (x, y, scale) => set({ stageX: x, stageY: y, scale }),
  // ... rest unchanged
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No new errors related to useCanvasStore.

- [ ] **Step 4: Commit**

```bash
git add src/stores/useCanvasStore.ts
git commit -m "feat: useCanvasStore 增加 viewport 状态 (stageX/Y, scale)"
```

---

### Task 4: GridBackground 组件

**Files:**
- Create: `src/components/GridBackground.tsx`

- [ ] **Step 1: 创建 GridBackground 组件**

```typescript
import { Layer, Rect } from 'react-konva'
import { useMemo } from 'react'

export function GridBackground() {
  const patternImage = useMemo(() => {
    const size = 20
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, size, size)
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = '#d0d5dd'
    ctx.fill()
    return canvas
  }, [])

  return (
    <Layer listening={false}>
      <Rect
        x={-10000}
        y={-10000}
        width={20000}
        height={20000}
        fillPatternImage={patternImage}
        listening={false}
      />
    </Layer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GridBackground.tsx
git commit -m "feat: 添加 GridBackground — Konva 点阵网格层"
```

---

### Task 5: WhiteboardCanvas — 视口控制 + 坐标转换

**Files:**
- Modify: `src/components/WhiteboardCanvas.tsx`

- [ ] **Step 1: 导入 GridBackground 和 useCanvasStore viewport**

在文件顶部导入区，`import { useToolStore }` 之后添加：

```typescript
import { GridBackground } from './GridBackground'
```

从 useCanvasStore 解构中取出 viewport 相关值。将 line 36:

```typescript
const { shapes, addShape, removeShape } = useCanvasStore()
```

改为:

```typescript
const { shapes, addShape, removeShape, stageX, stageY, scale } = useCanvasStore()
```

- [ ] **Step 2: 重写 getPointerPos 为世界坐标转换**

将 line 44-49 的 `getPointerPos` 替换为:

```typescript
const getPointerPos = useCallback((): Point => {
  const stage = stageRef.current
  if (!stage) return { x: 0, y: 0 }
  const pointer = stage.getPointerPosition()
  if (!pointer) return { x: 0, y: 0 }
  const transform = stage.getAbsoluteTransform().copy().invert()
  const worldPos = transform.point({ x: pointer.x, y: pointer.y })
  return { x: worldPos.x, y: worldPos.y }
}, [])
```

- [ ] **Step 3: 替换 isClick 调用，传入缩放阈值**

将 line 188 的 `isClick(drawingShape.points)` 改为:

```typescript
if (!isClick(drawingShape.points, scale)) {
```

- [ ] **Step 4: Stage 增加 draggable 和 onWheel 缩放**

将 line 310-318 的 `<Stage` 标签替换为:

```tsx
<Stage
  ref={stageRef}
  width={size.width}
  height={size.height}
  x={stageX}
  y={stageY}
  scaleX={scale}
  scaleY={scale}
  draggable
  onDragEnd={(e) => {
    const node = e.currentTarget
    useCanvasStore.getState().setViewport(node.x(), node.y(), scale)
  }}
  onWheel={(e) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const oldScale = scale
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const factor = 1.05
    const newScale = Math.min(Math.max(oldScale * (direction > 0 ? factor : 1 / factor), 0.1), 5)
    const mousePointTo = {
      x: (pointer.x - stageX) / oldScale,
      y: (pointer.y - stageY) / oldScale,
    }
    const newX = pointer.x - mousePointTo.x * newScale
    const newY = pointer.y - mousePointTo.y * newScale
    useCanvasStore.getState().setViewport(newX, newY, newScale)
  }}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseUp}
  style={{ cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
>
```

- [ ] **Step 5: 将 GridBackground 插入 Layer 栈**

在 `<Layer>` (shapes 层) 之前插入:

```tsx
<GridBackground />
```

- [ ] **Step 6: Transformer boundBoxFunc 缩放感知**

将 line 331-336 的 `boundBoxFunc` 替换为:

```typescript
boundBoxFunc={(oldBox, newBox) => {
  const s = scale || 1
  const minSize = 5 / s
  if (newBox.width < minSize || newBox.height < minSize) {
    return oldBox
  }
  return newBox
}}
```

- [ ] **Step 7: 底部状态栏显示缩放百分比**

将 line 371-373 的 status div 文本改为:

```tsx
形状: {shapes.length} · {Math.round(scale * 100)}% · Ctrl+Z 撤销 · Delete 删除
```

- [ ] **Step 8: Commit**

```bash
git add src/components/WhiteboardCanvas.tsx
git commit -m "feat: Stage 视口控制 — 拖拽平移、滚轮缩放、坐标转换、网格层"
```

---

### Task 6: isClick 缩放感知阈值

**Files:**
- Modify: `src/tools/ToolManager.ts`

- [ ] **Step 1: isClick 增加 scale 参数**

将 line 48-57 的 `isClick` 函数替换为:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/ToolManager.ts
git commit -m "fix: isClick 阈值缩放感知 — threshold = 5/scale"
```

---

### Task 7: transformUtils — 烘焙时除以 stage scale

**Files:**
- Modify: `src/tools/transformUtils.ts`

- [ ] **Step 1: computeTransformedPoints 增加 scale 参数**

将 line 10-13 的函数签名改为:

```typescript
export function computeTransformedPoints(
  shape: Shape,
  node: Konva.Node,
  stageScale = 1
): TransformResult {
```

在 switch 的每个 case 中传递 `stageScale`。将 line 16-39 的 switch 改为:

```typescript
  switch (shape.type) {
    case 'brush':
      return computeBrushTransform(shape, node as Konva.Line, stageScale)

    case 'rectangle':
      return computeRectTransform(shape, node as Konva.Rect, stageScale)

    case 'circle':
      return computeCircleTransform(shape, node as Konva.Ellipse, stageScale)

    case 'arrow':
      return computeArrowTransform(shape, node as Konva.Arrow, stageScale)

    case 'text':
      return computeTextTransform(shape, node as Konva.Text, stageScale)

    case 'line':
      return computePolygonTransform(shape, node as Konva.Line, stageScale)
    case 'triangle':
      return computePolygonTransform(shape, node as Konva.Line, stageScale)
    case 'star':
      return computePolygonTransform(shape, node as Konva.Line, stageScale)
    case 'diamond':
      return computePolygonTransform(shape, node as Konva.Line, stageScale)
    case 'pentagon':
      return computePolygonTransform(shape, node as Konva.Line, stageScale)

    default:
      return { points: shape.points }
  }
```

- [ ] **Step 2: 各 transform 函数增加 stageScale 参数并除以它**

`computeBrushTransform` (line 74):

```typescript
function computeBrushTransform(shape: Shape, node: Konva.Line, stageScale = 1): TransformResult {
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
```

`computeRectTransform` (line 88):

```typescript
function computeRectTransform(shape: Shape, node: Konva.Rect, stageScale = 1): TransformResult {
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
```

`computeCircleTransform` (line 101):

```typescript
function computeCircleTransform(shape: Shape, node: Konva.Ellipse, stageScale = 1): TransformResult {
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
```

`computeArrowTransform` (line 117):

```typescript
function computeArrowTransform(shape: Shape, node: Konva.Arrow, stageScale = 1): TransformResult {
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
```

`computeTextTransform` (line 145):

```typescript
function computeTextTransform(shape: Shape, node: Konva.Text, stageScale = 1): TransformResult {
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
```

`computePolygonTransform` (line 49):

```typescript
function computePolygonTransform(shape: Shape, node: Konva.Line, stageScale = 1): TransformResult {
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
```

- [ ] **Step 3: 在 WhiteboardCanvas 调用时传入 scale**

回到 `src/components/WhiteboardCanvas.tsx`，修改 line 121 的 `computeTransformedPoints` 调用:

```typescript
const result = computeTransformedPoints(shape, node, scale)
```

需要从 store 解构中已有 `scale`（Step 1 已加）。

- [ ] **Step 4: Commit**

```bash
git add src/tools/transformUtils.ts src/components/WhiteboardCanvas.tsx
git commit -m "fix: transformUtils 烘焙时除以 stageScale，防止缩放后尺寸翻倍"
```

---

### Task 8: RemoteCursor 世界→屏幕坐标转换

**Files:**
- Modify: `src/components/RemoteCursor.tsx`

- [ ] **Step 1: 从 useCanvasStore 读取 viewport，做世界→屏幕反算**

```typescript
import { useUserStore } from '../stores/useUserStore'
import { useCanvasStore } from '../stores/useCanvasStore'

export function RemoteCursors() {
  const { users, userId } = useUserStore()
  const { stageX, stageY, scale } = useCanvasStore()

  return (
    <>
      {users
        .filter((u) => u.id !== userId && u.cursor)
        .map((user) => {
          const screenX = user.cursor!.x * scale + stageX
          const screenY = user.cursor!.y * scale + stageY
          return (
            <div
              key={user.id}
              className="pointer-events-none absolute z-30"
              style={{
                left: screenX,
                top: screenY,
                transform: 'translate(-2px, -2px)',
              }}
            >
              {/* Cursor arrow */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 2L6 14L8 10L12 12L14 4L2 2Z"
                  fill={user.color}
                  opacity={0.8}
                />
              </svg>
              {/* Name label */}
              <div
                className="absolute left-4 -top-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.name}
              </div>
            </div>
          )
        })}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RemoteCursor.tsx
git commit -m "fix: RemoteCursor 世界→屏幕坐标反算，适配视口平移/缩放"
```

---

### Task 9: Rectangle 默认 cornerRadius

**Files:**
- Modify: `src/tools/RectangleTool.tsx`

- [ ] **Step 1: Rect 增加 cornerRadius**

将 `<Rect` 标签改为增加 `cornerRadius={8}`:

```tsx
<Rect
  id={shape.id}
  ref={shapeRef}
  x={x}
  y={y}
  width={width || 1}
  height={height || 1}
  rotation={shape.rotation || 0}
  cornerRadius={8}
  stroke={shape.style.strokeColor}
  strokeWidth={shape.style.strokeWidth}
  fill={shape.style.fillColor}
  opacity={shape.style.opacity}
  onClick={onSelect}
  onTap={onSelect}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/RectangleTool.tsx
git commit -m "feat: RectangleShape 默认 cornerRadius=8"
```

---

### Task 10: Sidebar + ShapePanel 蓝色系迁移

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/ShapePanel.tsx`

- [ ] **Step 1: Sidebar 颜色迁移**

将颜色值从 gray 系迁移：

| 原来 | 改为 |
|------|------|
| `bg-gray-100` (房间标签行) | `bg-primary-light/50` |
| `text-gray-800` (房间号) | `text-primary` |
| `text-gray-500` (标签) | `text-primary/70` |
| `accent-gray-800` (range slider) | `accent-primary` |
| `bg-gray-800` (确认按钮) | `bg-primary` |

修改 Sidebar.tsx:

- Line 35: `bg-gray-100` → `bg-primary-light/50`
- Line 37: `text-gray-800` → `text-primary font-semibold`
- Line 49: `text-gray-400` → `text-primary/50`
- Line 51: `text-gray-500` → `text-primary/70`
- Line 60: `text-gray-500` → `text-primary/70`
- Line 67: `accent-gray-800` → `accent-primary`
- Line 69: `text-gray-400` → `text-primary/50`
- Line 78: `text-gray-600 hover:bg-gray-100` → `text-primary/70 hover:bg-primary-light/30`
- Line 97: `text-gray-500` → `text-primary/70`
- Line 100: `text-gray-400` → `text-primary/50`
- Line 105: `bg-gray-50` → `bg-primary-light/20`
- Line 110: `text-gray-700` → `text-primary`
- Line 113: `text-gray-400` → `text-primary/50`

- [ ] **Step 2: ShapePanel 颜色迁移**

`src/components/ShapePanel.tsx`:

- Line 10: `text-gray-400` → `text-primary/50`
- Line 22: `bg-gray-800 text-white shadow-md border-gray-800` → `bg-primary text-white shadow-md border-primary`
- Line 23: `bg-white hover:bg-gray-50 border-gray-100 text-gray-600` → `bg-surface hover:bg-primary-light/30 border-gray-100 text-primary/70`

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx src/components/ShapePanel.tsx
git commit -m "feat: Sidebar/ShapePanel 颜色迁移至蓝色系"
```

---

### Task 11: CSS 全局背景色调整

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: App 容器背景色**

`src/App.tsx` line 29: `bg-gray-50` → `bg-canvas-bg`:

```tsx
<div className="w-screen h-screen bg-canvas-bg relative overflow-hidden">
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App 背景色改为 canvas-bg (#f8f9fa)"
```

---

### Task 12: 验证与集成测试

- [ ] **Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit 2>&1`
Expected: No errors.

- [ ] **Step 2: Vite 构建检查**

Run: `npm run build 2>&1`
Expected: Build succeeds.

- [ ] **Step 3: 手动验证清单**

启动前后端后逐项验证:

| # | 场景 | 预期 |
|---|------|------|
| 1 | 拖拽空白区域 | 画布平滑平移，不触发绘制 |
| 2 | Ctrl+滚轮缩放 | 以鼠标为锚点缩放，0.1x~5x 限幅 |
| 3 | 缩放后绘制矩形 | 形状出现在鼠标位置，尺寸正确 |
| 4 | 缩放后选中+移动/缩放形状 | Transformer 操作后形状数据正确 |
| 5 | 缩放后撤销 (Ctrl+Z) | 正确还原 |
| 6 | 网格背景 | 缩放/平移后跟随自然，无抖动 |
| 7 | 远程光标 | 本地缩放后远程光标位置正确 |
| 8 | 默认蓝色样式 | 新绘制的形状为蓝色描边+浅蓝填充 |
| 9 | 矩形圆角 | 新绘制的矩形有 8px 圆角 |
| 10 | 蓝色 UI | Sidebar/ShapePanel 按钮为蓝色系 |

- [ ] **Step 4: Commit (如有微调)**

```bash
git add -A
git commit -m "chore: V3A 最终验证与微调"
```

---

## 回退策略

画布扩展仅改动视口层（store + canvas + transform），不影响 shape 数据。如出问题：
- 回退 `useCanvasStore`、`WhiteboardCanvas`、`transformUtils` 三个文件
- shape 数据和 WebSocket 同步零影响

视觉升级纯 CSS/样式修改，随时可调整。
