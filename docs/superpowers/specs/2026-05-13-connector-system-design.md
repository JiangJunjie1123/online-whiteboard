# Connector System — 形状联动设计规格

**日期**: 2026-05-13 | **方向**: 组件联动 | **状态**: 设计确认

## 概述

为白板添加形状间连线（Connector）能力，实现拖拽锚点创建连线、形状移动时连线自动跟随。采用 Connection as Shape 方案，复用现有 Shape 体系。

终极目标覆盖：智能连线 → 模板联动 → 组合联动，本次聚焦连线子系统。

## 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 架构方案 | Connection 作为一等 Shape | 复用绘图/同步/撤销/Transform 体系 |
| 锚点模型 | 9 个固定锚点 | 实现简单，行为可预测 |
| 路由方式 | 正交（直角折线） | 专业流程图标配 |
| 连线创建 | 拖拽锚点 | 直观高效，符合 draw.io 习惯 |
| 后端改动 | 零 | extras 字段原样透传 |
| 实施策略 | Phase 1 直线 → Phase 2 正交 | 先验证锚定链路，再加路由复杂度 |

## 数据模型

### 锚点定义

9 个固定锚点：`top`, `bottom`, `left`, `right`, `center`, `top-left`, `top-right`, `bottom-left`, `bottom-right`。

所有形状统一从 4 值 bounds `[x1, y1, x2, y2]` 计算锚点像素坐标：

```typescript
function getAnchorPositions(shape: Shape): Record<Anchor, Point> {
  const [x1, y1, x2, y2] = shape.points
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
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
```

### Connection Shape

`type: "connector"`，核心字段通过 `extras` 存储：

```typescript
interface ConnectorExtras {
  startShapeId: string
  endShapeId: string
  startAnchor: Anchor
  endAnchor: Anchor
  arrowStart: 'none' | 'triangle' | 'circle' | 'diamond'
  arrowEnd: 'none' | 'triangle' | 'circle' | 'diamond'
  lineStyle: 'solid' | 'dashed' | 'dotted'
  waypoints: Point[]  // 用户手动折点，空数组=自动路由
}

// 标签存储在 Shape.text
```

### 锚点索引

维护 `Map<shapeId, Set<connectionId>>`，与 shapes 数组保持同步。形状移动/变换时 O(1) 查找受影响的连线。

## 交互设计

### 创建连线（三步）

1. **悬停显示锚点**：鼠标在形状上停留 200ms → 9 个蓝色锚点浮现，移开即隐藏
2. **拖出连线**：从锚点开始拖拽 → 虚线跟随鼠标，12px 内自动吸附目标锚点
3. **释放完成**：在目标形状锚点上松手 → 连线创建，形状存储到服务器

### 交互规则

- 拖到空白区域释放 → 取消连线
- 一个锚点支持多条连线
- 拖拽连线端点可更换到同形状的其他锚点
- 选中连线后 Delete 删除（不影响两端形状）
- 删除形状时级联删除其所有连线

### 连线跟随

形状变换（移动/缩放/旋转）时：
1. 从 anchorIndex 查询引用此形状的所有 connection
2. 重新计算起止锚点像素位置
3. 重新生成路径 points
4. 更新 connection shape + 同步到服务器

## 正交路由算法

根据起止锚点方向自动选择折弯路径：

- 同侧锚点（如 left→right）：L 形，从边缘出发先直走再折向目标
- 异侧锚点（如 top→right）：Z 形，先竖后横
- 对侧锚点（如 top→bottom）：C 形，从侧面绕过形状

用户可通过 waypoints 手动覆盖自动路由。

## 样式系统

| 属性 | 可选值 | 存储位置 |
|------|--------|----------|
| 箭头方向 | none / start / end / both | extras.arrowStart, extras.arrowEnd |
| 线型 | solid / dashed / dotted | extras.lineStyle |
| 端点样式 | triangle / circle / diamond / none | extras.arrowStart, extras.arrowEnd |
| 颜色/粗细 | 任意 | ShapeStyle.strokeColor / strokeWidth |

## 连线标签

- 标签位置：连线中点，白色背景遮住线段
- 双击标签进入编辑，复用现有 TextTool 编辑逻辑
- 存储在 Shape.text 字段

## 手动调整路径

- 选中连线后折点显示为白色可拖拽方块
- 双击线段中间插入新折点
- 右键折点弹出"删除此折点"
- waypoints 非空时跳过自动路由，使用 waypoints 渲染

## 文件变更

### 新增
- `src/utils/anchorUtils.ts` — 锚点位置计算
- `src/utils/connectorRouter.ts` — 正交路由算法
- `src/tools/ConnectorTool.tsx` — 连线渲染 + 端点拖拽
- `src/components/AnchorOverlay.tsx` — 锚点悬停浮层

### 修改
- `src/types/index.ts` — ConnectorExtras 类型 + Anchor 类型
- `src/stores/useCanvasStore.ts` — anchorIndex 维护 + 级联删除
- `src/components/WhiteboardCanvas.tsx` — 连线跟随逻辑 + 锚点渲染
- `src/config/shapeRegistry.ts` — 注册 connector 类型

### 后端
- 无需修改。connector 作为 Shape 子类型，extras 原样存储/转发。

## 实施阶段

### Phase 1 (P0): 核心连线
- 锚点系统（计算 + 悬停显示）
- 拖拽锚点创建连线（直线路由）
- anchorIndex 维护
- 连线跟随形状移动
- 基本箭头样式

预估：~400 行，4 新文件 + 3 修改文件

### Phase 2 (P1): 正交路由 + 样式 + 标签
- 正交路由算法
- 手动折点调整
- 连线标签编辑
- 完整样式系统（虚线/端点/双向箭头）

预估：~300 行，主要是 connectorRouter.ts

### Phase 3 (P2): 联动体验完善
- 模板系统（预设连接组）
- 组合联动（GroupTool）
- 锚点切换拖拽
- 路由缓存优化

## 兼容性

- 现有箭头形状（ArrowTool 等）保持不变，它们是独立的装饰性箭头
- Connector 是全新的 `type: "connector"`，与现有箭头共存
- 后端协议不变，新旧客户端可互操作（旧客户端忽略 connector 的 extras）
