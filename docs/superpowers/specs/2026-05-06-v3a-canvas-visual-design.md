# V3A: 画布无限扩展 + 视觉风格升级

> **项目:** whiteboard-collab
> **日期:** 2026-05-06
> **版本:** v3a
> **父设计:** 2026-04-28-whiteboard-collab-design.md

---

## 1. 概述

V3A 包含两个独立改动：(1) 画布从固定窗口升级为可平移/缩放的无限画布，(2) draw.io 风格的网格背景与蓝色专业调色板。

两者改动面重叠（WhiteboardCanvas、useCanvasStore），合并实施效率最高。

### 1.2 动机

- 当前画布局限于浏览器窗口大小，无法绘制大型图表
- 当前 UI 为单调灰色，缺乏品牌识别度和专业感
- 用户偏好 draw.io 的网格背景风格

---

## 2. 画布无限扩展

### 2.1 核心原则

当前所有 shape 坐标已是世界坐标（无边界检查），无限画布是**纯视口层改动**，零数据模型影响。

### 2.2 视口状态

在 `useCanvasStore` 新增：

```typescript
interface ViewportState {
  stageX: number;  // Stage x 偏移 (px)
  stageY: number;  // Stage y 偏移 (px)
  scale: number;   // 缩放因子 (0.1 ~ 5)
}
```

### 2.3 Stage 交互

- **平移**: Stage `draggable` 开启，空白区域拖拽即平移
- **缩放**: `onWheel` 事件，Ctrl+滚轮以鼠标位置为锚点缩放
- **边界**: scale 限制 0.1x ~ 5x，stageX/Y 无限制

### 2.4 坐标转换

```typescript
// 屏幕 → 世界（绘制、点击用）
getPointerPos(): { x: number; y: number } {
  const transform = stage.getAbsoluteTransform().copy().invert();
  return transform.point({ x: evt.evt.layerX, y: evt.evt.layerY });
}

// 世界 → 屏幕（RemoteCursor、TextInput 定位用）
worldToScreen(worldX: number, worldY: number) {
  return {
    x: worldX * scale + stageX,
    y: worldY * scale + stageY,
  };
}
```

### 2.5 transformUtils 适配

烘焙变换时需除以 `stage.scaleX()`，防止缩放下尺寸翻倍：

```typescript
const scaleX = stage.scaleX();
const newWidth = node.width() * node.scaleX() / scaleX;
const newHeight = node.height() * node.scaleY() / scaleX;
```

### 2.6 Transformer 适配

设置 `ignoreStroke: true` 保持锚点视觉大小在缩放时不变。

### 2.7 边界情况

- 文本输入框 HTML overlay 需用 `worldToScreen` 定位
- RemoteCursor 位置需用 `worldToScreen` 转换
- `isClick` 阈值需随缩放调整：`threshold = 5 / scale`
- 缩放锚点公式：`newScale = clamp(oldScale * delta, 0.1, 5); stageX = mouseX - (mouseX - stageX) * (newScale / oldScale)`

---

## 3. 视觉风格升级

### 3.1 调色板

| Token | 值 | 用途 |
|-------|-----|------|
| primary | `#1A73E8` | 默认描边、选中态、按钮 |
| primary-light | `#e8f0fe` | 默认填充 |
| canvas-bg | `#f8f9fa` | 画布底色 |
| grid-dot | `#d0d5dd` | 网格点 |
| surface | `#ffffff` | 侧边栏面板 |
| text-primary | `#1f2937` | 主文字 |
| text-secondary | `#6b7280` | 辅助文字 |

### 3.2 网格背景

- 新技术组件 `GridBackground.tsx`
- 在 shapes Layer 下方放置一个 Konva Layer
- Rect 填充使用 offscreen canvas 生成的 20px 点阵 pattern
- 单个 pattern 图无限平铺，GPU 友好，不随视口变化重绘
- Pattern: 20x20 像素 tile，中心 1.5px 半径灰点 `#d0d5dd`，背景 `#f8f9fa`

### 3.3 形状默认样式

- `strokeColor`: `#1a1a1a` → `#1A73E8`
- `strokeWidth`: `3` → `2`
- `fillColor`: `transparent` → `#e8f0fe`
- 矩形增加 `cornerRadius: 8`

### 3.4 UI 组件颜色迁移

- Sidebar/ShapePanel 中所有 `gray-800` 替换为蓝色系
- 选中态/悬停态使用 primary 色
- Transformer 锚点改为蓝色细线风格：`borderStroke="#1A73E8"` `borderStrokeWidth={1.5}`

---

## 4. 文件改动清单

### 新增

| 文件 | 职责 |
|------|------|
| `src/components/GridBackground.tsx` | Konva 点阵网格背景层 |

### 修改

| 文件 | 改动 |
|------|------|
| `src/stores/useCanvasStore.ts` | 新增 viewport 状态 + setViewport action |
| `src/components/WhiteboardCanvas.tsx` | Stage draggable/缩放、getPointerPos 坐标转换、引入 GridBackground、Transformer ignoreStroke |
| `src/tools/transformUtils.ts` | 烘焙变换除以 stage.scaleX() |
| `src/components/RemoteCursor.tsx` | worldToScreen 坐标反算 |
| `src/stores/useToolStore.ts` | 默认样式改为蓝色系 |
| `tailwind.config.js` | 新增颜色 tokens |
| `src/components/Sidebar.tsx` | 颜色迁移 + Transformer 蓝色样式 |

---

## 5. 验收标准

- [ ] 拖拽空白区域平滑平移画布
- [ ] Ctrl+滚轮以鼠标位置为锚点缩放（0.1x ~ 5x）
- [ ] 缩放后绘制形状位置和尺寸正确
- [ ] 缩放后选中/移动/缩放/旋转形状正常
- [ ] 缩放后撤销功能正常
- [ ] 远程光标在平移/缩放后位置正确
- [ ] 网格背景缩放/平移后跟随自然
- [ ] 用户 A 视口操作不影响用户 B
- [ ] 蓝色调色板全局应用无遗漏
- [ ] 矩形默认圆角 8px
- [ ] 回退：仅影响视口层和样式，shape 数据零影响

---

## 6. 不包含

- 视口同步（分享某用户看到的区域）—— 未来可加
- 缩放手势（触屏 pinch）—— 移动端适配时做
- mini-map 导航 —— 画布极大时考虑
