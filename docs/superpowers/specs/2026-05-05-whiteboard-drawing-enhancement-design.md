# Whiteboard 绘图增强 - 设计文档

**日期**: 2026-05-05 | **状态**: 已确认 | **方案**: A（依赖链分阶段）

## 总览

在 MVP 基础上增强绘图编辑能力，分 3 个阶段按依赖关系迭代：

| 阶段 | 内容 | 后端改动 |
|------|------|---------|
| P1 | 选中可视化 + Transform（移动/缩放/旋转） | 无 |
| P2 | 图层排序 + 多选（框选/Shift点击） | shapes dict → OrderedDict + reorder action |
| P3 | 复制粘贴 + 对齐辅助线 | 无 |

## 核心设计决策

**保持 points 数据模型不变**。Shape 继续使用 `points: number[]` 存储坐标。在 `transformend` 时将 Konva 节点属性（x/y/w/h/scale/rotation）转换回 points。理由：笔刷的连续点数组是自然表达，且协议已稳定，零后端改动。

---

## Phase 1: 选中 + Transform

### 架构

```
选中图形 → Transformer 绑定节点 → 用户操作 → transformend
  → 节点属性转 points → updateShape(本地) → sync('update') → 其他客户端
```

利用 Konva 自带的 `Transformer` 组件，自动获得拖拽、缩放手柄、旋转锚点。

### 文件改动

| 文件 | 改动 |
|------|------|
| `src/components/WhiteboardCanvas.tsx` | 添加 Transformer、shapeNodes ref 映射、transformend 处理、选中状态管理 |
| `src/tools/BrushTool.tsx` | 转发 ref、isSelected 显示选中态 |
| `src/tools/RectangleTool.tsx` | 转发 ref、isSelected 显示选中态 |
| `src/tools/CircleTool.tsx` | 转发 ref、isSelected 显示选中态 |
| `src/tools/ArrowTool.tsx` | 转发 ref、isSelected 显示选中态 |
| `src/tools/TextTool.tsx` | 转发 ref、isSelected 显示选中态 |
| 后端 | 零改动（`operation/update` 已支持） |
| 协议 | 零改动 |

### Transform 限制

| 类型 | 移动 | 缩放 | 旋转 | 说明 |
|------|------|------|------|------|
| 笔刷 | ✓ | ✗ | ✗ | 自由路径，缩放产生锯齿。Transformer 配置 enabledAnchors=[] |
| 矩形 | ✓ | ✓ | ✓ | 全支持 |
| 圆形 | ✓ | ✓ | ✓ | 全支持 |
| 箭头 | ✓ | ✓ | ✓ | 全支持 |
| 文本 | ✓ | ✗ | ✓ | 缩放通过改 fontSize，旋转通过 rotation |

### Points 转换规则

**笔刷**（仅移动）：`newPoints[i] += dx; newPoints[i+1] += dy`（每个坐标对加偏移量）

**矩形**：读取 node 的 x/y/w/h/scaleX/scaleY/rotation，计算 4 个角点位置，应用旋转矩阵变换，生成新 points `[x1,y1, x2,y2, x3,y3, x4,y4]`

**圆形**：读取中心点和缩放后的 rx/ry，生成新 points `[cx-rx, cy-ry, cx+rx, cy+ry]`

**箭头**：读取起点终点坐标，应用缩放旋转矩阵，生成新 points `[x1,y1, x2,y2]`

**文本**（移动+旋转）：新 points = 平移后坐标；`fontSize` *= scaleY（近似缩放）

### 选中态

- Transformer 提供蓝色边框 + 8 个控制手柄 + 旋转锚点（Konva 自带）
- 额外给选中图形加轻微阴影

### 协议

使用已有 `operation/update` 消息：

```json
{ "type": "operation", "action": "update", "shape": { "id": "...", "points": [...], ... } }
```

服务端替换对应 shape 并广播。冲突采用 last-write-wins。

---

## Phase 2: 图层排序 + 多选

### 图层排序

- 当前 shapes 数组顺序决定渲染 z-order
- 新 action `reorder`：携带 `shapeId` + `direction`（`up`/`down`/`top`/`bottom`）
- 前端 store 操作数组重排
- 后端 shapes 从 `dict` 改为 `OrderedDict`（Python dict 3.7+ 保持插入顺序，但 `reorder` 需显式移动）
- 广播 reorder 操作给房间其他人

### 多选

- `selectedId: string | null` → `selectedIds: string[]`
- Shift+点击：追加/取消选择
- Ctrl+A：全选
- 框选：mousedown 空白区域 → 拖拽矩形选框 → 碰撞检测选中范围内图形
- 批量 Transform：多个节点同时绑定到 Transformer
- 批量删除自然扩展

---

## Phase 3: 复制粘贴 + 对齐辅助

### 复制粘贴

- Ctrl+C：深拷贝选中图形的 Shape 对象（新 id + 偏移 20px），存入内存剪贴板
- Ctrl+V：`addShape` + sync `draw` 广播
- 跨用户同步：粘贴走普通 draw 通道

### 对齐辅助线

- 拖拽中（handleMouseMove 且 drawingShape/draggingShape 存在）检测对齐
- 检测目标：当前图形边缘/中心 vs 附近所有图形的边缘/中心
- 阈值 5px 内触发吸附 + 红色虚线辅助线渲染
- mouseup 时清除所有辅助线
- 纯前端逻辑，不涉及后端

---

## 冲突处理策略

P1-P3 统一采用 **last-write-wins**：
- 多人同时编辑同一图形时，最后到达服务端的 update 生效
- 不做 OT/CRDT，保持实现简单
- 对于白板协作场景，同时编辑同一图形的概率低，LWU 可接受

## 测试要点

- P1: 5 种图形各自 transform 后 points 正确性；远程同步正确；笔刷仅可移动
- P2: z-order 排序远程同步；多选批量删除；框选碰撞检测
- P3: 复制粘贴跨用户同步；对齐线显示/消失；吸附精度
