# V3D: 画布一键导出下载（PNG / JPG）

> **项目:** whiteboard-collab
> **日期:** 2026-05-06
> **版本:** v3d
> **父设计:** 2026-05-06-v3a-canvas-visual-design.md

---

## 1. 概述

V3D 为白板增加一键导出功能，用户可将当前画布视口内容下载为 PNG 或 JPG 图片文件。纯客户端实现，利用 Konva.js 内置的 `stage.toBlob()` API 完成渲染和下载，无需后端参与。

### 1.2 动机

- 当前白板无任何导出/保存功能，用户无法将绘制成果保存到本地
- 用户需要在 PowerPoint、文档、聊天工具中分享白板内容
- Konva.js 原生支持 toDataURL/toBlob，实现成本极低

---

## 2. 方案选型

### 2.1 三种候选方案

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A: stage.toBlob()** | 导出当前视口所见内容 | 实现极简，无需额外 Stage | 仅导出屏幕可见区域 |
| **B: 全量画布渲染** | 创建临时 Stage，渲染所有 shapes 到完整坐标空间再导出 | 可导出整个画布 | 大画布内存爆炸，实现复杂，需计算包围盒 |
| **C: 服务端渲染** | 后端用 headless 渲染引擎生成图片 | 大画布无压力 | 需引入 Puppeteer/Canvas，部署重量级 |

### 2.2 推荐方案: A

选择方案 A，理由：

- **零额外复杂度**: Konva Stage 已就绪，一句 `stage.toBlob()` 即可导出
- **与用户心智匹配**: 用户看到什么就导出什么，无需额外裁剪步骤
- **无限画布友好**: 用户可通过平移/缩放在导出前自行构图
- **无性能风险**: 视口即屏幕分辨率，不存在超大画布 OOM 问题
- **导出范围**: 所有 shapes（含视口内可见的）+ 可选的网格背景

---

## 3. 导出能力

### 3.1 格式

| 格式 | MIME | 扩展名 | 透明背景 | 备注 |
|------|------|--------|----------|------|
| PNG | `image/png` | `.png` | 支持 | 默认格式，无损，推荐 |
| JPG | `image/jpeg` | `.jpg` | 不支持 | 有损压缩，quality=0.92 |

默认导出 PNG。JPG 选择时自动切换到白色背景（不支持透明）。

### 3.2 背景处理

三种背景模式，用户可切换：

| 模式 | 名称 | 实现方式 | 适用格式 |
|------|------|----------|----------|
| 网格 | 保留网格 | 直接调用 toBlob，网格层保留 | PNG / JPG |
| 白色 | 纯白底 | 导入前隐藏网格层，Stage 下方垫白色 | PNG / JPG |
| 透明 | 无背景 | 导入前隐藏网格层，PNG alpha 通道 | 仅 PNG |

默认模式: **网格**（与画布编辑时视觉一致）。

切换逻辑：
- 选择 JPG 格式时，透明模式自动禁用（JPG 无 alpha）
- 选择透明模式时，格式自动锁定为 PNG

### 3.3 导出范围

导出范围为**当前 Stage 视口区域**（即用户屏幕上所见内容）：

- 包含视口内所有已绘制 shapes（含其他协作者的 shapes）
- 不包含 Transformer 选择框（导出前自动取消选中）
- 不包含 RemoteCursor 远程光标指示器
- 不包含 Sidebar、状态栏等 UI 元素
- 不包含文本输入弹窗 overlay

### 3.4 文件命名

```
whiteboard-{YYYYMMDD}-{HHmmss}.{ext}

示例: whiteboard-20260506-143052.png
```

时间戳取浏览器本地时间，与导出时刻对应。

---

## 4. 导出流程

```
用户点击导出按钮
    │
    ▼
弹出格式/背景选择菜单（Popover）
    │
    ├── PNG + 网格 ──▶ (默认，直接导出)
    ├── PNG + 白色 ──▶
    ├── PNG + 透明 ──▶
    └── JPG + 白色 ──▶
    │
    ▼
取消当前选中 (setSelectedId(null))  ← 隐藏 Transformer
    │
    ▼
按背景模式调整: 有网格？ ──是──▶ 什么都不做
                  ──否──▶ 隐藏 GridBackground Layer
    │
    ▼
stage.toBlob({ mimeType, quality })
    │
    ▼
创建 <a download="whiteboard-..."> 触发浏览器下载
    │
    ▼
恢复导出前状态: 重新显示 GridBackground（如果隐藏了）
    │
    ▼
完成 — Toast 提示 "画布已导出为 whiteboard-20260506-143052.png"
```

### 4.1 Stage 引用获取

Sidebar 中的导出按钮需要访问 Konva Stage 实例。由于 Stage 在 `WhiteboardCanvas` 内部（`stageRef`），通过以下方式暴露：

```typescript
// src/stores/useCanvasStore.ts — 新增字段
interface CanvasState {
  // ... 现有字段
  getStage: () => Konva.Stage | null  // 获取 Konva Stage 实例
}
```

`WhiteboardCanvas` 组件挂载后调用 `useCanvasStore.getState().setStageGetter(() => stageRef.current)` 注册 getter。

### 4.2 实现模块

新建 `src/utils/exportCanvas.ts`，封装导出逻辑：

```typescript
export type ExportFormat = 'png' | 'jpg'
export type BackgroundMode = 'grid' | 'white' | 'transparent'

export interface ExportOptions {
  format: ExportFormat
  background: BackgroundMode
}

export function exportCanvas(options: ExportOptions): Promise<void>
```

该函数：
1. 从 store 获取 Stage
2. 保存当前背景层可见性状态
3. 按需切换背景层可见性
4. 调用 `stage.toBlob()`
5. 触发浏览器下载
6. 恢复背景层状态
7. 返回 void（成功）或 throw（失败时 toast 报错）

### 4.3 依赖: Konva API

```typescript
// Konva Stage 导出 API（v9+）
stage.toBlob({
  mimeType: 'image/png',          // 或 'image/jpeg'
  quality: 0.92,                   // 仅 jpeg 有效
  pixelRatio: 2,                   // 2x 高清导出
  callback: (blob: Blob) => { ... }
})
```

- `pixelRatio: 2` 确保导出的图片在高分屏上清晰（如需节省文件大小可降为 1）
- quality 仅对 `image/jpeg` 生效
- toBlob 是异步操作，返回 Promise 的版本取决于 Konva 版本，保险起见使用 callback 模式

---

## 5. UI 设计

### 5.1 按钮位置

导出按钮放置在 **Sidebar > Actions 区域**，与撤销/清空按钮同行：

```
┌──────────────────────┐
│ [↩ 撤销]  [🗑 清空]   │  ← 现有
│ [📥 导出]             │  ← 新增
└──────────────────────┘
```

导出按钮为独立一行，全宽，避免与危险操作（清空）挤在一起。样式：白色底 + 灰色边框，hover 时 highlight。

### 5.2 弹出菜单（Popover）

点击导出按钮后，在按钮上方/右侧弹出一个小型 Popover，内容：

```
┌──────────────────────────┐
│ 导出格式                  │
│  ○ PNG (推荐)  ○ JPG     │
│                          │
│ 背景                      │
│  ○ 网格  ○ 白色  ○ 透明   │  ← 透明在 JPG 时灰掉
│                          │
│      [导出]  [取消]       │
└──────────────────────────┘
```

- 选择格式后背景选项自动联动（JPG 禁用透明）
- 默认选中 PNG + 网格
- 点击"导出"执行下载并关闭 Popover
- 点击"取消"或点击 Popover 外部关闭
- 不保留上次选择（每次打开恢复默认），避免用户混淆

### 5.3 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+E` | 直接以默认设置（PNG + 网格）导出，不弹出菜单 |

`Ctrl+Shift+E` 的 event handler 注册在 WhiteboardCanvas 的现有 keyboard `useEffect` 中，与 Delete/Backspace/Ctrl+Z 并列。

### 5.4 Toast 反馈

导出成功或失败后，在屏幕右下角显示 2 秒 Toast：

- 成功: "已导出 whiteboard-20260506-143052.png"（绿色）
- 失败: "导出失败，请重试"（红色）

Toast 为简单的绝对定位 div，不引入额外依赖库。放置在 WhiteboardCanvas 或 App 层级。

---

## 6. 边界情况与约束

### 6.1 空画布

画布无任何 shape 时仍允许导出，得到纯网格/白色/透明背景图。不做空画布拦截，用户可能有只导出背景的需求。

### 6.2 超大坐标空间

方案 A 仅导出视口区域，不受 shape 坐标范围影响。即使有 shape 在坐标 (50000, 50000)（视口外），导出结果不含该 shape，与用户屏幕上看到的一致。

### 6.3 导出期间交互

`stage.toBlob()` 是同步快照 + 异步回调模式。导出期间用户可继续绘制，但导出的图像是调用时刻的快照。渲染速度通常 < 100ms，无明显感知延迟。

### 6.4 移动端

移动端浏览器同样支持以 Blob + `<a>` download 触发下载。部分移动端浏览器可能将图片在新标签页打开而非下载，这是浏览器自身行为限制，不做额外处理。

### 6.5 协作场景

导出仅影响本地浏览器，不发送任何网络请求。其他协作者不受影响。导出时使用"当前本地看到的 shapes 列表"（来自 Zustand store），包含已同步的所有 shapes。

---

## 7. 文件改动清单

### 新增

| 文件 | 职责 |
|------|------|
| `src/utils/exportCanvas.ts` | 导出核心逻辑: `exportCanvas(options)` → 调用 toBlob + 触发下载 |
| `src/components/ExportPopover.tsx` | 导出格式/背景选择弹出菜单组件 |

### 修改

| 文件 | 改动 |
|------|------|
| `src/stores/useCanvasStore.ts` | 新增 `getStage: () => Konva.Stage \| null` 字段 + `setStageGetter` action |
| `src/components/WhiteboardCanvas.tsx` | ① `useEffect` 中调用 `setStageGetter(() => stageRef.current)` ② keyboard handler 新增 `Ctrl+Shift+E` 快捷键分支 |
| `src/components/Sidebar.tsx` | Actions 区域新增导出按钮 + ExportPopover 集成 |
| `src/components/GridBackground.tsx` | 可选: 暴露 Layer 的 `visible` 控制（通过 ref 或 store），供导出时临时隐藏 |

### 非改动

| 文件 | 说明 |
|------|------|
| `backend/` | 零改动 — 纯客户端功能 |
| `src/types/index.ts` | 零改动 — 无需新增类型 |
| `src/App.tsx` | 零改动 — Sidebar/Canvas 已是兄弟组件，通过 store 通信 |

---

## 8. 验收标准

- [ ] 点击 Sidebar 导出按钮弹出格式/背景选择菜单
- [ ] PNG + 网格: 导出图片与画布所见完全一致，含网格背景
- [ ] PNG + 白色: 导出图片为白底，无网格
- [ ] PNG + 透明: 导出图片背景透明（alpha 通道），拖入设计工具可验证
- [ ] JPG + 白色: 导出白色背景 JPG，文件扩展名为 .jpg
- [ ] JPG 时透明选项自动灰掉不可选
- [ ] 导出文件名格式: `whiteboard-YYYYMMDD-HHmmss.{png|jpg}`
- [ ] 导出图片中不含 Transformer 选择框
- [ ] 导出图片中不含 Sidebar、状态栏等 UI 元素
- [ ] `Ctrl+Shift+E` 快捷键直接导出 PNG+网格，无弹出菜单
- [ ] 空画布导出仍成功（纯背景图）
- [ ] 导出完成后有 Toast 成功/失败提示
- [ ] 导出不发送任何网络请求
- [ ] 导出后画布编辑状态无损（grid 可见、选中态恢复可接受的丢失）

---

## 9. 不包含

- **SVG 格式导出** — SVG 对复杂混合形状（brush + text + 图形）的保真度差，且 Konva 无原生 SVG 导出，需自建转换器。留待后续评估。
- **选区导出** — 当前仅支持全视口导出，不支持选中部分 shapes 后仅导出选中内容。可后续增强。
- **PDF 导出** — 多页文档场景不适用当前白板形态。
- **导出历史/云端存储** — 仅本地下载，不持久化到服务器。
- **导出进度条** — 当前画布尺寸下导出 < 1s，无需进度指示。未来若引入方案 B 全量导出可再加。
- **定制分辨率/尺寸** — 导出尺寸固定为当前视口，不支持用户指定宽高像素值。
