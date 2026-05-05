# Whiteboard v2 统一设计规格

**日期**: 2026-05-05 | **状态**: 待审阅 | **设计来源**: 三子系统并行构思

## 总览

基于 MVP + Phase 1（Transform）的基础上，分三个子系统迭代：

| 阶段 | 子系统 | 内容 | 涉及端 |
|------|--------|------|--------|
| 2A | 新图形类型 | 增加 5 种新形状（line/diamond/triangle/pentagon/star） | 前端为主，后端零改动 |
| 2B | UI 重构 | 工具栏 → 左侧边栏 + 图形面板 + 工具注册中心 | 纯前端 |
| 2C | 部署 | Docker Compose + nginx 多机器联机 | 基础设施 |

**执行顺序**: 2A → 2B → 2C（B 扩展类型基础 → A 构建 UI → C 基于稳定代码部署）

---

## 阶段 2A: 新图形类型

### 新增形状

| 类型标识 | 中文名 | Konva 组件 | 顶点数 | points 长度 | 难度 |
|---------|--------|-----------|--------|------------|------|
| `line` | 直线 | `<Line>` | 2 | 4 | 最低 |
| `diamond` | 菱形 | `<Line closed>` | 4 | 8 | 低 |
| `triangle` | 三角形 | `<Line closed>` | 3 | 6 | 低 |
| `pentagon` | 五边形 | `<Line closed>` | 5 | 10 | 中 |
| `star` | 星形 | `<Line closed>` | 10 | 20 | 中 |

### 统一设计原则

**渲染**: 所有新形状使用 `<Line closed={true}>`（line 除外）。每个形状定位于几何重心，顶点存储为相对于重心的局部坐标。rotation 通过 `shape.rotation` 字段应用。

**绘制交互**: 全部采用 click-drag 模式（与 rectangle 一致）。`updateShapePoints` 中从边界框计算顶点坐标。

**Transform**: 全部归入 default 配置（8 锚点 + 旋转使能）。所有新形状共用 `computePolygonTransform` 通用函数——缩放局部坐标、应用旋转矩阵、转换到世界坐标。

**points 编码** (以 triangle 为例):
```
v1 = 顶点居中上方, v2 = 左下角, v3 = 右下角
points = [v1x, v1y, v2x, v2y, v3x, v3y]  // 6 值
```

**同步**: 后端零改动。Shape.type 是 str 字段无校验。新形状通过现有 `operation/draw` 和 `operation/update` 消息透传。

### 文件变更

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/types/index.ts` | 扩展 ToolType 联合 5 个字面量 |
| 修改 | `src/tools/ToolManager.ts` | updateShapePoints 新增 5 个 case |
| 新建 | `src/tools/LineTool.tsx` | LineShape 渲染组件 |
| 新建 | `src/tools/TriangleTool.tsx` | TriangleShape 渲染组件 |
| 新建 | `src/tools/StarTool.tsx` | StarShape 渲染组件 |
| 新建 | `src/tools/DiamondTool.tsx` | DiamondShape 渲染组件 |
| 新建 | `src/tools/PentagonTool.tsx` | PentagonShape 渲染组件 |
| 修改 | `src/tools/transformUtils.ts` | 新增 5 个 case + computePolygonTransform 通用函数 |
| 修改 | `src/components/WhiteboardCanvas.tsx` | renderShape + renderDrawingPreview 各加 5 case |
| 修改 | `src/components/Toolbar.tsx` | tools 数组新增 5 条目 |

### 后端影响: 零改动

---

## 阶段 2B: UI 重构（左侧边栏）

### 布局方案

```
┌─ Sidebar (w-64, 256px) ─┬──────────────────────────┐
│ 🏠 房间: ABC123  ●在线   │                          │
│ ─────────────────────── │                          │
│ 工具                     │      Konva 画布           │
│ ┌────────┐ ┌────────┐   │                          │
│ │ ✏️ 画笔 │ │ ⬜ 矩形 │   │                          │
│ └────────┘ └────────┘   │                          │
│ ┌────────┐ ┌────────┐   │                          │
│ │ 📏 直线 │ │ 🔷 菱形 │   │                          │
│ └────────┘ └────────┘   │                          │
│ ─────────────────────── │                          │
│ 🎨 颜色  [■]  📏 粗细   │                          │
│ ─────────────────────── │                          │
│ ↩ 撤销    🗑 清空       │                          │
│ ─────────────────────── │                          │
│ 👥 在线用户 (3)          │                          │
└─────────────────────────┴──────────────────────────┘
```

### 组件树

```
App
├── Sidebar (NEW — 替代 Toolbar + UserList)
│   ├── SidebarHeader   (房间ID + 连接状态)
│   ├── ShapePanel      (工具卡片网格, 2列)
│   ├── StyleControls   (颜色/粗细)
│   ├── ActionButtons   (撤销/清空)
│   └── UserSection     (在线用户列表, 从 UserList 迁入)
├── WhiteboardCanvas
└── RemoteCursors
```

### 关键设计决策

**Sidebar 采用 `fixed` 定位**（与当前 Toolbar/UserList 一致），不需要改 WhiteboardCanvas 的尺寸计算。

**工具注册中心** `src/config/tools.ts` 作为 A 和 B 的共享契约:

```typescript
export interface ToolConfig {
  type: ToolType
  label: string
  icon: string
}

export const TOOLS: ToolConfig[] = [
  // 由 ToolType 类型确保完整性
]
```

Toolbar.tsx 中的硬编码 `tools` 数组迁移到此，ShapePanel 动态读取。新增形状只需在此数组加条目。

### 文件变更

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `src/config/tools.ts` | 工具注册中心，ToolConfig 接口 + TOOLS 数组 |
| 新建 | `src/components/Sidebar.tsx` | 侧边栏容器 |
| 新建 | `src/components/ShapePanel.tsx` | 工具卡片网格 |
| 修改 | `src/App.tsx` | 引入 Sidebar 替代 Toolbar + UserList |
| 删除 | `src/components/Toolbar.tsx` | 功能迁移至 Sidebar |
| 可选 | `src/components/UserList.tsx` | 保留或迁入 Sidebar |

### WhiteboardCanvas 改动原则

仅动外层结构（text input 弹窗、status bar），**不动三个 switch 语句**（renderShape / renderDrawingPreview / getTransformerConfig）。

---

## 阶段 2C: 多机器部署

### 架构

```
浏览器 A (本机)     浏览器 B (局域网手机)
    │                      │
    └──────────┬───────────┘
               ▼
    http://192.168.x.x:3000
               │
    ┌──────────▼──────────────────────┐
    │  nginx (端口 3000)               │
    │  /      → SPA 静态文件           │
    │  /ws    → proxy_pass backend:8000│
    └──────────┬──────────────────────┘
               │ Docker bridge 网络
    ┌──────────▼──────────────────────┐
    │  FastAPI + uvicorn (端口 8000)   │
    │  内存存储 (rooms/connections)    │
    └─────────────────────────────────┘
```

### 核心原理: 零代码改动

`App.tsx` 中 WebSocket URL 使用 `window.location.host` 动态构造，天然适配所有部署场景：

| 部署场景 | 浏览器访问 | WebSocket | 代理者 |
|---------|-----------|-----------|--------|
| 开发 | `localhost:5173` | `/ws` | Vite |
| Docker 本机 | `localhost:3000` | `/ws` | nginx |
| 局域网 | `192.168.1.100:3000` | `/ws` | nginx |

### 新增文件

| 文件 | 用途 |
|------|------|
| `Dockerfile`（项目根） | 前端构建 + nginx 运行（多阶段） |
| `backend/Dockerfile` | 后端容器 |
| `nginx.conf` | SPA 静态文件 + /ws WebSocket 代理 |
| `docker-compose.yml` | 服务编排（backend 不暴露端口，仅 nginx 暴露 3000） |
| `.dockerignore` | 排除 node_modules、.git |
| `backend/.dockerignore` | 排除 __pycache__、.venv |

### nginx 核心配置要点

- `/ws` location 必须在 `/` 之前
- WebSocket 升级头: `proxy_set_header Upgrade $http_upgrade`
- 超时: `proxy_read_timeout 86400s`（24h，适配长连接）
- SPA 回退: `try_files $uri $uri/ /index.html`

### 用户部署流程

```bash
cd whiteboard
docker-compose up --build -d
# 本机: http://localhost:3000
# 其他设备: http://<本机局域网IP>:3000
```

---

## 冲突点及解决

| 冲突文件 | 2A 新形状 | 2B 侧边栏 | 解决方式 |
|---------|----------|----------|---------|
| `types/index.ts` | 扩展 ToolType | 读取 ToolType | 2A 先扩展，2B 从类型推导 |
| `Toolbar.tsx` | 加工具条目 | 整体替换 | 抽取 config/tools.ts 共享 |
| `WhiteboardCanvas.tsx` | switch 加分支 | 布局适配 | 2A 动 switch，2B 动外层 |
| `App.tsx` | — | 改布局 | 2B 单独改动 |

## 验证要点

- 所有 switch(shape.type) 无遗漏分支
- 新形状 draw/update/delete 远程同步正确
- Sidebar 工具卡片涵盖所有 ToolType
- Docker Compose 多浏览器窗口协作正常
