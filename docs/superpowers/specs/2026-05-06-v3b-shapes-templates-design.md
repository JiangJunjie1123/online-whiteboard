# V3B: 50+ 形状扩展 + 一键模板系统

> **项目:** whiteboard-collab
> **日期:** 2026-05-06
> **版本:** v3b
> **父设计:** 2026-05-06-v3a-canvas-visual-design.md

---

## 1. 概述

V3B 将白板绘图工具从当前 10 种扩展到 60 种，覆盖多领域图表绘制需求，并增加四种一键模板（思维导图、类图、时序图、流程图）以大幅降低复杂图表的创建门槛。

### 1.1 背景

当前工具集仅有 brush、rectangle、circle、arrow、text、line、triangle、diamond、pentagon、star 十种，刷了大量白板"快速绘制 50+ 形状 + 点击出模板"的需求。用户需要手动拼装形状才能画出流程图、UML 图、思维导图等，体验门槛高。

### 1.2 目标

1. 形状数量从 10 扩展到 60，覆盖基本形状、箭头连接线、流程图符号、UML 符号、标注注释等
2. 工具栏可在海量选项中高效定位目标形状（分类、搜索、收藏/最近使用）
3. 一键模板：点击"思维导图"直接生成一组已布局好的形状+连接线
4. 数据模型与渲染架构可支撑 60+ 形状而不膨胀 switch 语句
5. 后端零数据结构改动（当前 Shape.model_dump() 透传已满足）

---

## 2. 动机

### 2.1 为什么需要 50+ 形状

- **流程图绘制**：缺少 Document、Database、Delay、Manual Input、Predefined Process 等专业节点形状，用户只能手画或用 rectangle 代替，识别度差
- **UML 建模**：无 Class Box（三栏类框）、Actor、Lifeline、Activation Box 等核心 UML 元素
- **思维导图/组织图**：无预置连线+节点布局，缺乏信息层次展示能力
- **标注与注释**：无 Callout、Bracket、Note/Sticky Note，审阅场景乏力

### 2.2 为什么需要模板

当前创建流程图/类图/思维导图需要逐个拖放形状并手动连线，用户体验等价于早期 Visio 的手工绘图模式。一键模板可在点击后直接生成完整布局的图表骨架，用户仅需编辑文本内容。

### 2.3 设计约束

- **向后兼容**：现有 10 种形状及已持久化的 shape 数据不受影响
- **后端零 Schema 改动**：Shape.type 为 str 字段，后端仅透传 JSON，天然支持新类型
- **不引入全量 OT/CRDT 改动**：连接器自动更新策略采用订阅式，不修改现有同步协议
- **分阶段交付**：Phase 1 形状扩展（60 种），Phase 2 模板感知连接器，Phase 3 智能模板布局

---

## 3. 架构总览

### 3.1 从 switch 驱动到 Registry 驱动

当前架构的核心痛点：每加一种形状需手动修改 6 处 switch 语句。

```
现状（10 种形状已膨胀到临界点）：
  WhiteboardCanvas.tsx   → renderShape() switch 10 分支
                        → renderDrawingPreview() switch 10 分支
                        → getTransformerConfig() switch 3-4 分支
  ToolManager.ts        → updateShapePoints() switch 10 分支
  transformUtils.ts     → computeTransformedPoints() switch 10 分支
  types/index.ts        → ToolType 联合 10 个字面量
```

**目标架构：Shape Registry 模式**

每种形状自描述（渲染器、变换器、绘制规则、分类、图标），注册到一个全局 Registry。运行时代码通过 Registry 查找，不写死 switch。

```
┌─────────────────────────────────────────────────────┐
│  ShapeRegistry (单例)                                │
│  ┌─────────────────────────────────────────────────┐│
│  │ Map<ShapeType, ShapeDefinition>                 ││
│  │  - renderComponent: FC<ShapeProps>              ││
│  │  - transformer: TransformFn                    ││
│  │  - pointUpdater: PointUpdateFn                 ││
│  │  - config: { category, icon, label, ... }      ││
│  │  - defaultStyle: Partial<ShapeStyle>           ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  get(type) → ShapeDefinition                        │
│  getByCategory(cat) → ShapeDefinition[]              │
│  getAll() → ShapeDefinition[]                        │
│  search(query) → ShapeDefinition[]                   │
└─────────────────────────────────────────────────────┘
```

### 3.2 代码热图变化

```
						V3B 前                          V3B 后
WhiteboardCanvas.tsx  400+ 行 switch                ~250 行（仅遍历渲染）
ToolManager.ts        60 行  switch                  ~30 行（委托 Registry）
transformUtils.ts     160 行 switch                  ~50 行（委托 Registry）
types/index.ts        1 个 ToolType = 'a'|'b'|...    ShapeType = string + 形状定义接口
tools/*.tsx           12 个独立文件                  60 个独立文件（每形状一个）
config/tools.ts       10 个条目                      60 个条目（按分类组织）
                          NEW ↓
config/shape-registry.ts                             Registry 单例
config/template-registry.ts                          Template 注册中心
config/categories.ts                                 分类定义
```

---

## 4. 数据模型

### 4.1 Shape 扩展

在现有 Shape 基础上增加 3 个可选字段，零破坏性。

```typescript
// src/types/index.ts

export type ShapeType = string  // 从字面量联合改为 string，Registry 提供运行时校验

export interface ConnectionAnchor {
  shapeId: string       // 连接的源/目标形状 ID
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  offset?: { x: number; y: number }  // 锚点微调
}

export interface ConnectionData {
  source: ConnectionAnchor
  target: ConnectionAnchor
  routing?: 'straight' | 'curved' | 'orthogonal'  // 路线风格
  label?: string        // 连线上的文字标签
}

export interface Shape {
  id: string
  type: ShapeType        // 从 ToolType 放宽为 string
  points: number[]       // 保持通用 points 数组，语义由各形状自行解释
  style: ShapeStyle
  text?: string
  rotation?: number
  userId?: string

  // --- V3B 新增 ---
  /** 形状特定属性，JSON-serializable */
  extras?: Record<string, unknown>
  /** 连接器专属：定义两端的源/目标形状 */
  connectionData?: ConnectionData
  /** 模板实例 ID，标记该形状由哪个模板创建 */
  templateId?: string
  /** 属于哪个形状组（用于批量操作） */
  groupId?: string
}
```

### 4.2 points: number[] 的通用性验证

当前所有 10 种形状均使用 `points: number[]`，验证了此设计的普适性：

| 形状类别 | points 语义 | 示例 |
|---------|------------|------|
| 边界框形状 | `[x1, y1, x2, y2]` — 包围盒对角 | rectangle, circle, triangle, diamond, pentagon, star, hexagon, octagon, heart, cloud, cylinder, shield, gear... |
| 自由绘制 | `[x1,y1, x2,y2, x3,y3, ...]` — 连续路径点 | brush |
| 线段/箭头 | `[x1, y1, x2, y2]` — 起点和终点 | arrow, line, double-arrow, dashed-line, dotted-line, curved-arrow |
| 位置锚定 | `[x, y]` — 单一锚点 | text, note/sticky |
| **新增：多节盒** | `[x1,y1, x2,y2]` + extras.sections | class-box, interface-box, abstract-class（三栏矩形，sections 存文本数组）|
| **新增：正交连线** | `[x1,y1, x2,y2, mx1,my1, ...]` — 含中间拐点 | orthogonal-connector |
| **新增：弧形** | `[x1,y1, x2,y2]` + extras.radius | curved-arrow（二次贝塞尔控制点）|

**结论**: `points: number[]` 完全能覆盖 60 种形状。用 `extras` 承载形状特定属性（如 UML 类框的 sections、圆角矩形的 cornerRadius、星形的 pointsCount 等）。

### 4.3 ShapeDefinition 接口

```typescript
// src/types/index.ts 或 config/shape-registry.ts

export interface ShapeDefinition {
  type: ShapeType
  label: string
  icon: string
  category: ShapeCategory

  /** Konva 渲染组件 */
  renderer: React.FC<ShapeProps>

  /** 鼠标拖拽过程中如何更新 points */
  updatePoints: (shape: Shape, currentPoint: Point) => number[]

  /** Konva transform 结束后如何将变换烤回 points/rotation */
  transform: (shape: Shape, node: Konva.Node, stageScale: number) => TransformResult

  /** 默认样式覆盖 */
  defaultStyle?: Partial<ShapeStyle>

  /** 是否支持 transformer 八锚点缩放 */
  supportsTransform?: boolean

  /** 是否支持旋转 */
  supportsRotation?: boolean

  /** 鼠标拖拽时的最小尺寸（用于 isClick 判定，覆盖全局默认） */
  minDragThreshold?: number
}

export interface ShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Node | null) => void
}
```

### 4.4 分类定义

```typescript
export type ShapeCategory =
  | 'basic'        // 基本形状
  | 'arrows'       // 箭头与连接线
  | 'flowchart'    // 流程图符号
  | 'uml'          // UML 图形
  | 'annotation'   // 标注与注释
  | 'misc'         // 其他

export interface CategoryDefinition {
  id: ShapeCategory
  label: string
  icon: string
  order: number
}
```

---

## 5. 完整的 60 种形状清单

### 5.1 基本形状 (Basic) — 14 种

| # | type | 中文名 | Konva 组件 | points 语义 | extras |
|---|------|--------|-----------|------------|--------|
| 1 | `brush` | 画笔 | `<Line>` | 连续点 | — |
| 2 | `rectangle` | 矩形 | `<Rect>` | 包围盒 | cornerRadius (已有) |
| 3 | `circle` | 圆形/椭圆 | `<Ellipse>` | 包围盒 | — |
| 4 | `triangle` | 三角形 | `<Line closed>` | 包围盒 | — |
| 5 | `diamond` | 菱形 | `<Line closed>` | 包围盒 | — |
| 6 | `pentagon` | 五边形 | `<Line closed>` | 包围盒 | — |
| 7 | `star` | 五角星 | `<Line closed>` | 包围盒 | — |
| 8 | `hexagon` | 六边形 | `<Line closed>` | 包围盒 | — |
| 9 | `octagon` | 八边形 | `<Line closed>` | 包围盒 | — |
| 10 | `parallelogram` | 平行四边形 | `<Line closed>` | 包围盒 | skew |
| 11 | `trapezoid` | 梯形 | `<Line closed>` | 包围盒 | — |
| 12 | `cross` | 十字/加号 | `<Line>` | 包围盒 | — |
| 13 | `heart` | 心形 | `<Shape>` (SVG path) | 包围盒 | — |
| 14 | `line` | 直线 | `<Line>` | 起止点 | — |

### 5.2 箭头与连接线 (Arrows) — 10 种

| # | type | 中文名 | Konva 组件 | points 语义 | extras |
|---|------|--------|-----------|------------|--------|
| 15 | `arrow` | 单箭头 | `<Arrow>` | 起止点 | — |
| 16 | `double-arrow` | 双箭头 | `<Arrow>` | 起止点 | doubleEnded: true |
| 17 | `dashed-line` | 虚线 | `<Line>` | 起止点 | dash array |
| 18 | `dotted-line` | 点线 | `<Line>` | 起止点 | dash array |
| 19 | `curved-arrow` | 曲线箭头 | `<Arrow>` + bezier | 起止点 + 控制点 | curveStrength |
| 20 | `orthogonal-connector` | 正交连线 | `<Line>` | 起止点 + 中间拐点 | routing: 'orthogonal' |
| 21 | `bent-arrow` | 弯折箭头 | `<Arrow>` | 起止点 + 中间拐点 | — |
| 22 | `self-loop-connector` | 自环连线 | `<Ellipse>` | 包围盒 | — |
| 23 | `connector-with-label` | 带标签连线 | `<Arrow>` + overlay | 起止点 | label, labelPos |
| 24 | `line-with-arrowhead` | 一端带箭头直线 | `<Arrow>` | 起止点 | — |

### 5.3 流程图符号 (Flowchart) — 12 种

| # | type | 中文名 | Konva 组件 | 描述 |
|---|------|--------|-----------|------|
| 25 | `flow-process` | 处理/过程 | `<Rect>` | 标准矩形框 **[别名: rectangle]** |
| 26 | `flow-decision` | 判断/分支 | `<Line closed>` | 菱形 **[别名: diamond]** |
| 27 | `flow-terminator` | 开始/结束 | `<Rect cornerRadius>` | 圆角矩形 **[别名: rectangle+cornerRadius]** |
| 28 | `flow-document` | 文档 | `<Line closed>` | 波浪底边矩形 |
| 29 | `flow-data-io` | 数据/输入输出 | `<Line closed>` | 平行四边形 **[别名: parallelogram]** |
| 30 | `flow-manual-input` | 手动输入 | `<Line closed>` | 梯形（顶边斜） **[别名: trapezoid]** |
| 31 | `flow-predefined-process` | 预定义过程 | `<Rect>` + 两条侧线 | 双竖线矩形 |
| 32 | `flow-database` | 数据库 | `<Line closed>` | 圆柱体 **[别名: cylinder]** |
| 33 | `flow-delay` | 延迟 | `<Line closed>` | 半圆两端 |
| 34 | `flow-cloud` | 云/注释 | `<Shape>` (SVG) | 云形图案 |
| 35 | `flow-connector` | 连接点 | `<Circle>` | 小圆点 **[别名: circle]** |
| 36 | `flow-off-page` | 离页引用 | `<Line closed>` | 五边形（下三角） **[别名: pentagon]** |

### 5.4 UML 类图符号 (UML) — 9 种

| # | type | 中文名 | Konva 组件 | 说明 |
|---|------|--------|-----------|------|
| 37 | `class-box` | 类 | `<Group>` (3 `<Rect>`) | 三栏：类名、属性、方法 |
| 38 | `interface-box` | 接口 | `<Group>` (3 `<Rect>`) | 含 <<interface> |
| 39 | `abstract-class` | 抽象类 | `<Group>` (3 `<Rect>`) | 斜体类名 |
| 40 | `enum-box` | 枚举 | `<Group>` (3 `<Rect>`) | 含 <<enumeration> |
| 41 | `actor` | 参与者 | `<Shape>` (SVG) | 火柴人 |
| 42 | `lifeline` | 生命线 | `<Line>` + dash | 垂直虚线 |
| 43 | `activation-box` | 激活框 | `<Rect>` | 生命线上的窄矩形 **[别名: rectangle]** |
| 44 | `sync-message` | 同步消息 | `<Arrow>` | 实心箭头 **[别名: arrow]** |
| 45 | `return-message` | 返回消息 | `<Arrow>` + dash | 虚线箭头 **[别名: dashed-line]** |

### 5.5 标注与注释 (Annotation) — 8 种

| # | type | 中文名 | Konva 组件 | 说明 |
|---|------|--------|-----------|------|
| 46 | `text` | 文本 | `<Text>` | 已有 |
| 47 | `note-sticky` | 便签 | `<Rect fillColor>` | 黄色便签纸 **[别名: rectangle+fillColor]** |
| 48 | `callout-rounded` | 圆角标注框 | `<Rect cornerRadius>` | 气泡对话框 **[别名: rectangle+cornerRadius]** |
| 49 | `callout-ellipse` | 椭圆标注框 | `<Ellipse>` | 椭圆形气泡 **[别名: circle/ellipse]** |
| 50 | `bracket` | 方括号 | `<Line>` | [ 形 |
| 51 | `curly-brace` | 花括号 | `<Shape>` (SVG) | { 形 |
| 52 | `highlight-rect` | 高亮区域 | `<Rect fillOpacity>` | 半透明背景块 **[别名: rectangle+fillOpacity]** |
| 53 | `watermark` | 水印文本 | `<Text>` | 大号低透明文本 **[别名: text]** |

### 5.6 其他图形 (Misc) — 7 种

| # | type | 中文名 | Konva 组件 | 说明 |
|---|------|--------|-----------|------|
| 54 | `cylinder` | 圆柱体 | `<Line closed>` + `<Ellipse>` | 3D 圆柱 |
| 55 | `shield` | 盾牌 | `<Line closed>` | 安全/保护节点 |
| 56 | `gear` | 齿轮 | `<Star numPoints>` | 设置/配置 |
| 57 | `lightning` | 闪电 | `<Line>` | 快速操作 |
| 58 | `block-arrow` | 块状箭头 | `<Line closed>` | 宽体箭头 |
| 59 | `crescent` | 月牙/扇形 | `<Shape>` (SVG) | 饼图部位 |
| 60 | `table-grid` | 表格/网格 | `<Group>` (N个Rect) | NxM 单元格 |

### 5.7 形状别名策略

部分流程图/标注/UML 形状与基础形状共享完全相同的渲染器和工具逻辑，仅在 label、icon、category 和默认样式上存在差异。此类形状标注为 **[别名]**，采用如下策略：

| 别名形状 | 基形状 | 差异点 |
|----------|--------|--------|
| `flow-process` | `rectangle` | 分类为 flowchart，不同 icon/label |
| `flow-decision` | `diamond` | 同上 |
| `flow-terminator` | `rectangle` (cornerRadius) | 同上，默认圆角 |
| `flow-data-io` | `parallelogram` | 同上 |
| `flow-manual-input` | `trapezoid` | 同上 |
| `flow-database` | `cylinder` | 同上 |
| `flow-connector` | `circle` | 同上，更小的默认尺寸 |
| `flow-off-page` | `pentagon` | 同上 |
| `activation-box` | `rectangle` | 同上，更窄的默认尺寸 |
| `sync-message` | `arrow` | 同上 |
| `return-message` | `dashed-line` | 同上 |
| `note-sticky` | `rectangle` | 同上，默认黄色填充 |
| `callout-rounded` | `rectangle` (cornerRadius) | 同上 |
| `callout-ellipse` | `circle`/`ellipse` | 同上 |
| `highlight-rect` | `rectangle` | 同上，默认半透明 |
| `watermark` | `text` | 同上，默认大号低透明度 |

**别名实现方式：**
- 别名形状在其工具文件中不创建独立的渲染器/transform/updatePoints 函数
- 通过 `registerShape` 直接引用基形状的 renderer、updatePoints、transform
- 仅覆盖 `label`、`icon`、`category`、`defaultStyle` 字段
- 显著减少有效代码文件数量：60 个工具条目中约 16 个为别名，实际独立文件约 44 个

```typescript
// 示例: FlowDecisionTool.tsx — 别名形状，无需重复实现
import { shapeRegistry } from '../config/shape-registry'

registerShape({
  type: 'flow-decision',
  label: '判断/分支',
  icon: '💎',
  category: 'flowchart',
  renderer: shapeRegistry.get('diamond')!.renderer,        // 复用
  updatePoints: shapeRegistry.get('diamond')!.updatePoints, // 复用
  transform: shapeRegistry.get('diamond')!.transform,       // 复用
  defaultStyle: { fill: '#EBF5FB', stroke: '#2980B9' },
})
```

---

## 6. Shape Registry 设计

### 6.1 注册方式

每种形状通过工厂函数注册自身：

```typescript
// src/tools/TriangleTool.tsx

import { registerShape } from '../config/shape-registry'

registerShape({
  type: 'triangle',
  label: '三角',
  icon: '🔺',
  category: 'basic',
  renderer: TriangleShape,
  updatePoints: (shape, pt) => {
    const [sx, sy] = [shape.points[0], shape.points[1]]
    return [sx, sy, pt.x, pt.y]
  },
  transform: computePolygonTransform,
  supportsTransform: true,
  supportsRotation: true,
})
```

### 6.2 Registry API

```typescript
// src/config/shape-registry.ts

class ShapeRegistry {
  private shapes = new Map<ShapeType, ShapeDefinition>()

  register(def: ShapeDefinition): void
  get(type: ShapeType): ShapeDefinition | undefined
  getByCategory(category: ShapeCategory): ShapeDefinition[]
  getAll(): ShapeDefinition[]
  search(query: string): ShapeDefinition[]  // 按 label/type 模糊搜索
  getCategories(): CategoryDefinition[]
}

export const shapeRegistry = new ShapeRegistry()
```

### 6.3 消除 switch 语句

所有 switch 语句改为 Registry 委托：

**renderShape — WhiteboardCanvas.tsx**
```typescript
// 旧: switch (shape.type) { case 'brush': ... case 'rectangle': ... }
// 新:
const renderShape = (shape: Shape) => {
  const def = shapeRegistry.get(shape.type)
  if (!def) return null
  const Comp = def.renderer
  return (
    <Comp
      key={shape.id}
      shape={shape}
      isSelected={shape.id === selectedId}
      onSelect={() => handleSelectShape(shape.id)}
      shapeRef={getShapeRef(shape.id)}
    />
  )
}
```

**updateShapePoints — ToolManager.ts**
```typescript
export function updateShapePoints(shape: Shape, currentPoint: Point): number[] {
  const def = shapeRegistry.get(shape.type)
  return def ? def.updatePoints(shape, currentPoint) : shape.points
}
```

**computeTransformedPoints — transformUtils.ts**
```typescript
export function computeTransformedPoints(shape, node, stageScale) {
  const def = shapeRegistry.get(shape.type)
  return def ? def.transform(shape, node, stageScale) : { points: shape.points }
}
```

**getTransformerConfig — WhiteboardCanvas.tsx**
```typescript
const getTransformerConfig = useCallback((shape: Shape) => {
  const def = shapeRegistry.get(shape.type)
  if (!def?.supportsTransform) {
    return { enabledAnchors: [], rotateEnabled: false, keepRatio: false }
  }
  return {
    enabledAnchors: ['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'],
    rotateEnabled: def.supportsRotation ?? true,
    keepRatio: false,
  }
}, [])
```

---

## 7. 工具栏 UI 设计

### 7.1 问题：60 个按钮的 2 列网格不可用

当前 `ShapePanel.tsx` 采用 `grid-cols-2` 渲染所有 TOOLS 条目。60 个条目的结果是 30 行、需要大量滚动。

### 7.2 解决方案：分层分类 + 搜索 + 收藏

```
┌─ Sidebar ──────────────────┐
│ 🔍 搜索形状...              │  ← 即时过滤
│ ─────────────────────────── │
│ 📐 基本形状    (14)    ▼    │  ← 可折叠分类
│ ┌────────┐ ┌────────┐      │
│ │ ⬜ 矩形 │ │ ⭕ 圆形 │      │
│ └────────┘ └────────┘      │
│ ┌────────┐ ┌────────┐      │
│ │ 🔺 三角 │ │ 🔷 菱形 │      │
│ └────────┘ └────────┘      │
│ ...                         │
│ ➡️ 箭头连线    (10)    ▶    │  ← 折叠状态
│ 🔄 流程图      (12)    ▶    │
│ 📊 UML         (9)     ▶    │
│ 💬 标注注释    (8)     ▶    │
│ 🔧 其他        (7)     ▶    │
│ ─────────────────────────── │
│ ⭐ 收藏: 矩形 类框 箭头     │  ← 常驻收藏栏
│ ─────────────────────────── │
│ 🕐 最近: 类框 菱形 文本     │  ← 最近5个使用
└─────────────────────────────┘
```

### 7.3 交互细节

**分类展开/折叠**：
- 默认展开"基本形状"，其余折叠
- 点击分类标题切换展开/折叠
- 每个分类最多显示 8 个（2 列 x 4 行），更多时出现"展开更多"按钮

**搜索**：
- 输入框在分类列表上方
- 输入时实时过滤所有形状（按中文名、英文 type、拼音首字母）
- 搜索结果平铺显示（不限分类），不匹配时隐藏分类标题

**收藏与最近使用**：
- 后台存 localStorage: `favorites: ShapeType[]` 和 `recentlyUsed: ShapeType[]`
- 收藏操作：右键工具卡片 → "添加到收藏"，或工具卡片上的小星标图标
- 最近使用自动维护最近 5 个

### 7.4 文件变更

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/components/ShapePanel.tsx` | 重构为分类折叠 + 搜索 + 收藏 |
| 新建 | `src/components/ShapeSearch.tsx` | 搜索输入框组件 |
| 新建 | `src/components/CategorySection.tsx` | 单个分类折叠面板 |
| 新建 | `src/stores/useShapePanelStore.ts` | 收藏/最近/展开状态的 Zustand store |
| 新建 | `src/config/categories.ts` | 分类定义 + 默认顺序 |

---

## 8. 模板系统设计

### 8.1 模板定义

一个 Template 是一个函数：给定画布放置原点 (x, y)，返回一组 Shape 对象数组。

```typescript
// src/config/template-registry.ts

export interface TemplateDefinition {
  id: string
  name: string
  icon: string
  description: string
  /** 生成模板形状。@param origin 放置原点（画布坐标） */
  generate: (origin: Point, options?: TemplateOptions) => Shape[]
}

export interface TemplateOptions {
  /** 连接器是否随形状联动（Phase 2） */
  smartConnectors?: boolean
  /** 自定义标签文本映射 */
  labels?: Record<string, string>
}
```

### 8.2 四种模板详解

#### 8.2.1 思维导图 (Mind Map)

```
              ┌──────────┐
              │  中心主题  │
              └─────┬────┘
         ┌──────────┼──────────┐
    ┌────▼────┐ ┌───▼───┐ ┌───▼────┐
    │  子主题1  │ │子主题2│ │ 子主题3 │
    └────┬────┘ └───┬───┘ └───┬────┘
    ┌───┐│   ┌──┐┌──┘    ┌──┐└───┐
    │...││   │..││...    │..│    │...│
```

**生成逻辑**：
1. 中心节点：`rectangle` (120x50) at origin
2. 第二层：3 个 `rectangle` (100x40) 放射排列在左右（120度扇区）
3. 第三层：每个二级节点下 2 个 `rectangle` (80x35)
4. 所有连接线：`orthogonal-connector` 从父节点底部连到子节点顶部
5. 总计：~10 个 shapes（1 中心 + 3 二级 + 6 三级 + 若干连接线）

#### 8.2.2 类图 (Class Diagram)

```
┌─────────────────────┐
│      Order          │
├─────────────────────┤
│ - id: int           │
│ - amount: float     │
│ - status: string    │
├─────────────────────┤
│ + calculateTotal()  │
│ + updateStatus()    │
└─────────────────────┘
        △
        │ (继承)
┌───────┴─────────────┐
│   SpecialOrder      │
├─────────────────────┤
│ - discount: float   │
├─────────────────────┤
│ + applyDiscount()   │
└─────────────────────┘
```

**生成逻辑**：
1. 2 个 `class-box`（三栏矩形）100x120，一上一下，间距 60px
2. 1 条 `arrow`（空心三角箭头）从下方类框顶部连到上方类框底部（表示继承）
3. 1 个 `text` "inheritance" 标注在箭头旁
4. 总计：~4 个 shapes

#### 8.2.3 时序图 (Sequence Diagram)

```
 ┌──────┐          ┌──────┐          ┌──────┐
 │ Client │          │Server │          │  DB   │
 └──┬───┘          └──┬───┘          └──┬───┘
    │                 │                 │
    │  ───────────────▶                 │
    │   POST /api/data                  │
    │                 │                 │
    │                 │  ───────────────▶
    │                 │   SELECT * FROM  │
    │                 │                 │
    │                 │  ◀───────────────
    │                 │   result set    │
    │                 │                 │
    │  ◀───────────────                 │
    │   200 OK {data}                   │
    │                 │                 │
```

**生成逻辑**：
1. 3 个 `actor`（火柴人）+ 下方 `text` 标签
2. 3 条 `lifeline`（垂直虚线）从每个参与者下方延伸
3. 3-4 个 `activation-box` 在生命线上
4. 3 条 `sync-message`（实心箭头，从左到右）
5. 2 条 `return-message`（虚线箭头，从右到左）
6. 总计：~15 个 shapes

#### 8.2.4 流程图 (Flowchart)

```
     ┌─────────┐
     │  开始    │
     └────┬────┘
          │
    ┌─────▼─────┐
    │  输入数据  │
    └─────┬─────┘
          │
    ┌─────▼─────┐         ┌──────────┐
    │  条件判断? │────────▶│  处理异常  │
    └──┬─────┬──┘   No    └─────┬────┘
  Yes  │     No                 │
  ┌────▼──┐ ┌─▼──────────┐    │
  │处理流程│ │  替代流程   │    │
  └───┬───┘ └──┬─────────┘    │
      │        │              │
      └───┬────┘              │
          │                   │
    ┌─────▼─────┐             │
    │   结束     │◀────────────┘
    └───────────┘
```

**生成逻辑**：
1. `flow-terminator` (开始/结束) x 2
2. `flow-process` (过程) x 3
3. `flow-decision` (判断) x 1
4. `flow-data-io` (数据输入) x 1
5. 6 条 `arrow` 或 `orthogonal-connector`
6. 总计：~13 个 shapes

### 8.3 模板 UI

在 Sidebar 底部或工具栏顶部新增"模板"按钮：

```
┌─ 模板面板 ────────────────────┐
│ 🧠 思维导图                   │
│   中心主题 + 3层级 10+节点     │
│ 📊 类图                       │
│   2个类 + 继承关系             │
│ ⏱ 时序图                      │
│   3个参与者 + 消息序列         │
│ 🔄 流程图                      │
│   决策+处理+开始/结束          │
└───────────────────────────────┘
```

点击模板后：
1. 所有模板形状以当前视口中心为原点生成
2. 所有形状被自动选中（`groupId` 统一），方便整体移动
3. 用户可立即编辑标签文本、拖拽调整位置
4. 使用 `addShape` 逐个添加并同步到远程用户

### 8.4 模板渲染流程

```
用户点击模板 "思维导图"
       │
       ▼
TemplateDefinition.generate(origin)
       │
       ▼
返回 Shape[] (含 groupId = template_v4_mindmap_xxx)
       │
       ▼
forEach shape → canvasStore.addShape(shape)
       │         └→ syncSend('draw', shape)  // 逐条广播
       │
       ▼
画布渲染所有模板形状 ✓
```

### 8.5 模板撤销粒度

Phase 1 采用**逐 shape 撤销**策略：每次 Ctrl+Z 撤销模板中的一个形状，用户需要多次撤销才能完全移除模板。此决策基于以下考量：

- **简单可靠**：复用现有单 shape 撤销机制，无需新增批量撤销事务
- **渐进式**：用户可以在模板生成后按需撤销部分节点，保留有用的部分
- **未来扩展**：Shape 模型已预留 `groupId` 字段（所有模板生成形状共享同一个 groupId）。Phase 2 可基于此字段实现"一键撤销整个模板"，同时保留逐 shape 撤销的细粒度

### 8.6 已知限制

**模板连接线为静态坐标。** Phase 1 模板生成的连接线（箭头、正交连线等）的端点坐标在生成时固定。移动所连接的节点后，连接线不会自动跟随。

| 限制 | 影响 | 缓解 |
|------|------|------|
| 连接线不跟随节点移动 | 移动节点后需手动调整连线端点 | 模板卡片 UI 显示提示文字：**"移动节点后需手动调整连线"** |
| 仅模板生成的连接线受影响 | 用户手动绘制的连接线行为不变 | 无额外操作 |

> **Phase 1 vs Phase 2 范围边界：** Phase 1 不做连接线联动（见第 9 节的连接器自动更新规划）。Phase 2 引入 `connectionData` 锚点系统后，连接线可跟随节点自动更新。当前阶段用户在模板卡片上看到明确提示，设定期望。

---

## 9. 连接器自动更新（Phase 2 规划）

Phase 1 模板生成的连接线是静态的（固定坐标），移动形状后连接线不会跟随。

### 9.1 连接器联动机制

当形状携带 `connectionData` 时，`updateShape` 操作会触发连接线重新计算：

```typescript
// 伪代码 — Phase 2 实现
function onShapeUpdated(updatedShape: Shape) {
  // 查找所有以此为端点的连接器
  const connectedArrows = shapes.filter(s =>
    s.connectionData?.source.shapeId === updatedShape.id ||
    s.connectionData?.target.shapeId === updatedShape.id
  )
  // 重新计算每个连接器的端点
  connectedArrows.forEach(arrow => {
    const srcShape = shapes.find(s => s.id === arrow.connectionData.source.shapeId)
    const tgtShape = shapes.find(s => s.id === arrow.connectionData.target.shapeId)
    if (srcShape && tgtShape) {
      const newPoints = computeConnectionEndpoints(srcShape, tgtShape, arrow.connectionData)
      updateShape(arrow.id, { points: newPoints })
    }
  })
}
```

### 9.2 为什么 Phase 2

- 需要锚点系统（形状边界上的固定连接点）
- 需要路径避障/路由算法（正交连线绕过中间形状）
- 需要处理循环依赖（A 更新 → B 更新 → A 再更新）
- 这些是实现复杂度较高的独立功能

Phase 1 模板的连接线是静态但正确的；用户可以在调整节点后手动调整连线。Phase 2 再引入自动联动。

---

## 10. 后端变更

### 10.1 零 Schema 改动

后端 `Shape` Pydantic 模型已经使用 `type: str`（非枚举），完全无需修改即可支持任意 shape type。

```python
# backend/app/models.py — 当前定义已经兼容
class Shape(BaseModel):
    id: str
    type: str       # ✅ 已经是 str，新 type 直接透传
    points: list[float]
    style: ShapeStyle
    text: Optional[str] = None
    rotation: Optional[float] = None
    userId: Optional[str] = None
```

### 10.2 推荐的可选增强（非必需）

| 增强项 | 影响范围 | 建议 |
|--------|---------|------|
| Shape.extras 字段 | Pydantic model 加 `extras: Optional[dict] = None` | V3B 同期加，`model_dump(exclude_none=True)` 自动兼容旧 shape |
| Shape.connectionData | 同上 | 同上 |
| 大画布快照优化 | `snapshots.data` JSONB 在大量形状下增大 | 暂不处理，事后再优化 |

### 10.3 同步影响

模板生成是一系列 `draw` 操作，每个 shape 单独发出 WebSocket 消息。对于 ~15 个 shape 的模板，这会产生 15 条 WebSocket 消息（~10ms 内到达对端）。如果后续发现性能瓶颈，可引入批量操作消息 `action: "batch_draw"`，将多个 shape 合并为一条消息。

---

## 11. 文件变更清单

### 11.1 新建文件

| 文件 | 职责 |
|------|------|
| `src/config/shape-registry.ts` | ShapeRegistry 单例 + ShapeDefinition 接口 |
| `src/config/categories.ts` | ShapeCategory + CategoryDefinition + CATEGORIES 数组 |
| `src/config/template-registry.ts` | TemplateDefinition 接口 + 4 个模板实现 |
| `src/components/ShapeSearch.tsx` | 搜索输入框 |
| `src/components/CategorySection.tsx` | 分类折叠面板 |
| `src/stores/useShapePanelStore.ts` | 收藏/最近/展开状态的 Zustand store |

**60 个工具渲染文件** (已在 `src/tools/` 中列出，以下为新增的 50 个)：

| 文件 | 对应 type |
|------|----------|
| `src/tools/HexagonTool.tsx` | hexagon |
| `src/tools/OctagonTool.tsx` | octagon |
| `src/tools/ParallelogramTool.tsx` | parallelogram |
| `src/tools/TrapezoidTool.tsx` | trapezoid |
| `src/tools/CrossTool.tsx` | cross |
| `src/tools/HeartTool.tsx` | heart |
| `src/tools/DoubleArrowTool.tsx` | double-arrow |
| `src/tools/DashedLineTool.tsx` | dashed-line |
| `src/tools/DottedLineTool.tsx` | dotted-line |
| `src/tools/CurvedArrowTool.tsx` | curved-arrow |
| `src/tools/OrthogonalConnectorTool.tsx` | orthogonal-connector |
| `src/tools/BentArrowTool.tsx` | bent-arrow |
| `src/tools/SelfLoopTool.tsx` | self-loop-connector |
| `src/tools/ConnectorWithLabelTool.tsx` | connector-with-label |
| `src/tools/LineWithArrowheadTool.tsx` | line-with-arrowhead |
| `src/tools/FlowProcessTool.tsx` | flow-process |
| `src/tools/FlowDecisionTool.tsx` | flow-decision |
| `src/tools/FlowTerminatorTool.tsx` | flow-terminator |
| `src/tools/FlowDocumentTool.tsx` | flow-document |
| `src/tools/FlowDataIOTool.tsx` | flow-data-io |
| `src/tools/FlowManualInputTool.tsx` | flow-manual-input |
| `src/tools/FlowPredefinedProcessTool.tsx` | flow-predefined-process |
| `src/tools/FlowDatabaseTool.tsx` | flow-database |
| `src/tools/FlowDelayTool.tsx` | flow-delay |
| `src/tools/FlowCloudTool.tsx` | flow-cloud |
| `src/tools/FlowConnectorTool.tsx` | flow-connector |
| `src/tools/FlowOffPageTool.tsx` | flow-off-page |
| `src/tools/ClassBoxTool.tsx` | class-box |
| `src/tools/InterfaceBoxTool.tsx` | interface-box |
| `src/tools/AbstractClassTool.tsx` | abstract-class |
| `src/tools/EnumBoxTool.tsx` | enum-box |
| `src/tools/ActorTool.tsx` | actor |
| `src/tools/LifelineTool.tsx` | lifeline |
| `src/tools/ActivationBoxTool.tsx` | activation-box |
| `src/tools/SyncMessageTool.tsx` | sync-message |
| `src/tools/ReturnMessageTool.tsx` | return-message |
| `src/tools/NoteStickyTool.tsx` | note-sticky |
| `src/tools/CalloutRoundedTool.tsx` | callout-rounded |
| `src/tools/CalloutEllipseTool.tsx` | callout-ellipse |
| `src/tools/BracketTool.tsx` | bracket |
| `src/tools/CurlyBraceTool.tsx` | curly-brace |
| `src/tools/HighlightRectTool.tsx` | highlight-rect |
| `src/tools/WatermarkTool.tsx` | watermark |
| `src/tools/CylinderTool.tsx` | cylinder |
| `src/tools/ShieldTool.tsx` | shield |
| `src/tools/GearTool.tsx` | gear |
| `src/tools/LightningTool.tsx` | lightning |
| `src/tools/BlockArrowTool.tsx` | block-arrow |
| `src/tools/CrescentTool.tsx` | crescent |
| `src/tools/TableGridTool.tsx` | table-grid |

### 11.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | ToolType 放宽为 ShapeType = string；新增 ConnectionAnchor、ConnectionData 类型；Shape 加 extras/connectionData/templateId/groupId 可选字段；新增 ShapeDefinition 接口 |
| `src/config/tools.ts` | TOOLS 数组扩展到 60 条目，每项加 category 字段 |
| `src/tools/ToolManager.ts` | updateShapePoints 由 switch 改为 Registry 委托；createShape 不变 |
| `src/tools/transformUtils.ts` | computeTransformedPoints 由 switch 改为 Registry 委托；保留通用 transform 函数给各形状调用 |
| `src/components/WhiteboardCanvas.tsx` | renderShape / renderDrawingPreview 由 switch 改为 Registry 委托；getTransformerConfig 由 switch 改为 Registry 查询 |
| `src/components/ShapePanel.tsx` | 重构为分类折叠 + 搜索过滤 + 收藏/最近 |
| `src/components/Sidebar.tsx` | 新增模板面板区域 |
| `src/stores/useCanvasStore.ts` | addShape 支持批量添加（避免模板生成时的多次 re-render）|
| `src/stores/useToolStore.ts` | 新增 `favorites: ShapeType[]`、`recentlyUsed: ShapeType[]` 持久化字段 |

### 11.3 不修改的文件

| 文件 | 原因 |
|------|------|
| `backend/app/main.py` | Shape type 已为 str，透传无感知 |
| `backend/app/models.py` | 结构已兼容（可选加 extras 字段） |
| `src/sync/SyncManager.ts` | operation/draw/update/delete 协议不变 |
| `src/components/GridBackground.tsx` | 无关联 |
| `src/components/UserList.tsx` | 无关联 |
| `src/components/RemoteCursor.tsx` | 无关联 |

---

## 12. 实施顺序

### Phase 1：Registry + 形状批量注册（估计 2-3 天）

1. 创建 `shape-registry.ts`，定义 `ShapeDefinition` 和 `ShapeRegistry`
2. 将现有 10 种形状迁移到 Registry 模式（每个文件末尾加 `registerShape({...})`）
3. 重构 `WhiteboardCanvas` / `ToolManager` / `transformUtils` 的 switch 语句为 Registry 委托
4. 验证：现有所有功能（绘制、选择、变换、撤销、同步）不受影响

### Phase 2：新增 50 种形状（估计 3-4 天）

1. 按分类批量创建 50 个工具文件（每个约 30-80 行）
2. 每个文件：渲染组件 + registerShape 调用
3. 大部分"包围盒 → 计算顶点"的形状可复用 `computePolygonTransform`
4. UML 类框、表格等复合形状使用 `<Group>` 包裹多个 Konva 子元素
5. 更新 `config/tools.ts` 的 TOOLS 数组

### Phase 3：工具栏重构（估计 1-2 天）

1. 创建分类定义 `categories.ts`
2. 创建 `ShapeSearch` / `CategorySection` 组件
3. 重构 `ShapePanel` 为折叠分类布局
4. 实现搜索过滤（中文名 + type 匹配）
5. 实现收藏/最近使用的 localStorage 持久化

### Phase 4：模板系统（估计 2-3 天）

1. 创建 `template-registry.ts` + `TemplateDefinition` 接口
2. 实现 4 个模板的 `generate()` 函数
3. Sidebar 新增模板面板 UI
4. 模板生成后的批量 addShape 优化
5. 验证：模板生成的形状可正常编辑、移动、同步

### Phase 5：连接器联动（Phase 2 — 后续版本）

1. 锚点系统：`computeAnchors(shape)` 返回形状边缘 4 方位连接点
2. `onShapeUpdated` 触发连接线重算
3. 正交路由算法
4. 撤销/重做时连接器一致性

---

## 13. 验收标准

### 13.1 形状扩展

- [ ] 可以绘制全部 60 种形状
- [ ] 新形状支持选择、移动、缩放、旋转（通过 Transformer）
- [ ] 新形状支持撤销/重做
- [ ] 新形状支持远程同步（多用户同时绘制）
- [ ] 新形状在缩放/平移画布后渲染正确
- [ ] 所有形状遵守蓝色调色板默认样式
- [ ] `isClick` 判定对新形状有效（拖拽距离过小不创建形状）

### 13.2 工具栏

- [ ] 分类折叠/展开正常
- [ ] 搜索输入实时过滤形状列表
- [ ] 搜索结果不限分类显示
- [ ] 收藏/取消收藏后 localStorage 持久化
- [ ] 最近使用自动更新并显示在收藏栏下方
- [ ] 点击工具卡片可正确激活工具

### 13.3 模板系统

- [ ] 思维导图模板：1 中心节点 + 3 二级节点 + 6 三级节点 + 连接线
- [ ] 类图模板：2 个类框 + 1 继承箭头
- [ ] 时序图模板：3 个参与者 + 生命线 + 激活框 + 5 条消息
- [ ] 流程图模板：开始+过程+判断+结束+多条连线
- [ ] 模板生成后所有形状可独立选中/编辑/移动
- [ ] 模板生成操作能同步到其他协作用户
- [ ] 模板生成后可撤销：Phase 1 采用逐 shape 撤销（每次 Ctrl+Z 撤销一个 shape）。Shape 模型已预留 `groupId` 字段，未来可通过匹配 groupId 实现批量撤销整个模板

### 13.4 兼容性

- [ ] 现有 10 种形状绘制/变换/同步行为无退化
- [ ] 现有已持久化 shape 数据加载正常
- [ ] WebSocket 协议未改动，新旧客户端可在同一房间协作
- [ ] 后端未修改代码即可支持新形状和模板

---

## 14. 不包含

- 触屏手势支持（移动端适配 — 未来需求）
- 视口同步分享 — 已在 V3A 列为未来
- mini-map 导航 — 已在 V3A 列为未来
- 连接器正交路由自动避障 — 列入 Phase 2
- 模板参数化配置面板（生成前调整节点数、标签等） — 可后续加
- 自定义模板保存/分享 — 未来需求
- SVG 导入/导出 — 未来需求
- 形状自定义样式预设 — 未来需求

---

## 15. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 60 个工具文件维护成本高 | 中 | Registry 模式统一接口；大多数形状复用通用 `computePolygonTransform`；文件自带 registerShape 自注册 |
| 工具栏性能（60 个按钮的 DOM） | 低 | 分类折叠默认只渲染一个分类（~14 个按钮）；搜索结果是虚拟过滤，不重新创建 DOM |
| 模板生成大量同步消息 | 低 | Phase 1 逐条发送（~15 条，10ms 内到达），后续可引入批量消息合并 |
| 形状过多导致用户选择困难 | 中 | 分类折叠 + 搜索过滤 + 收藏/最近使用三重手段降低认知负荷 |
| UML 类框等多节形状与当前 Transformer 兼容 | 中 | `<Group>` 包裹可让 Transformer 正确操作复合节点，需充分测试 |

---

## 16. 分阶段交付建议

为降低单次交付风险并尽早验证核心架构，建议将 V3B 拆分为两个 Batch 分阶段交付。

### 16.1 Batch 1: V3B Core（~35 形状）

**范围：** 基础形状 + 箭头连线 + 流程图 + 标注注释 + Registry 架构重构 + 工具栏分类/搜索

| 类别 | 形状数 | 形状 |
|------|--------|------|
| Basic | 14 | brush, rectangle, circle, triangle, diamond, pentagon, star, hexagon, octagon, parallelogram, trapezoid, cross, heart, line |
| Arrows & Connectors | 10 | arrow, double-arrow, dashed-line, dotted-line, curved-arrow, orthogonal-connector, bent-arrow, self-loop-connector, connector-with-label, line-with-arrowhead |
| Flowchart | 12 | flow-process, flow-decision, flow-terminator, flow-document, flow-data-io, flow-manual-input, flow-predefined-process, flow-database, flow-delay, flow-cloud, flow-connector, flow-off-page |
| Annotation | (包含 text) | text (已有), note-sticky, callout-rounded, callout-ellipse, bracket, curly-brace, highlight-rect, watermark |

**Batch 1 关键交付物：**
- ShapeRegistry 架构 + 现有 10 形状迁移
- 工具栏分层分类 + 搜索 + 收藏/最近使用
- Basic + Arrows + Flowchart + Annotation 四类形状可绘制
- 流程图包含大量别名形状，实现成本低

### 16.2 Batch 2: V3B Extended（~25 形状 + 模板系统）

**范围：** UML + Misc + 模板系统（4 个模板）

| 类别 | 形状数 | 形状 |
|------|--------|------|
| UML | 9 | class-box, interface-box, abstract-class, enum-box, actor, lifeline, activation-box, sync-message, return-message |
| Misc | 7 | cylinder, shield, gear, lightning, block-arrow, crescent, table-grid |
| 模板系统 | — | 思维导图、类图、时序图、流程图 四个模板 |

**Batch 2 关键交付物：**
- UML 复合形状（class-box 等 Group 包裹的多节矩形）
- Misc 装饰性形状（cylinder, shield, gear 等）
- 模板注册中心 + 4 个模板生成函数
- 模板面板 UI + 批量 addShape + groupId 预留

### 16.3 拆分理由

| 考量 | 说明 |
|------|------|
| **风险隔离** | Batch 1 验证 Registry 架构 + 工具栏重构的正确性，不依赖复合形状或模板系统 |
| **快速反馈** | Batch 1 交付后用户即可绘制专业流程图（含 12 种流程图符号），提前获得使用反馈 |
| **复用效应** | Batch 1 的别名形状积累了大量复用模式（renderer/transform 共享），Batch 2 的 UML/Misc 可直接沿用 |
| **模板依赖** | 模板系统需要 UML (类图/时序图) 和 Flowchart 形状作为素材，放在 Batch 2 在形状完备后实现更自然 |
| **并行开发** | Batch 1 和 Batch 2 的工具文件无依赖冲突，可在 Batch 1 稳定后并行推进
