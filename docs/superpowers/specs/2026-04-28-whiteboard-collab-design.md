# 在线白板协作软件 - 设计方案

> **项目:** whiteboard-collab  
> **日期:** 2026-04-28  
> **版本:** v1.0  
> **作者:** AI Assistant

---

## 1. 项目概述

### 1.1 项目简介

基于浏览器的实时协作白板系统，支持多用户同时在线绘制、标注与沟通，实现低延迟同步与状态一致性，适用于远程会议、教学及团队协作场景。

### 1.2 核心功能

1. **实时多人协作** - WebSocket 同步绘图操作
2. **基础绘图工具** - 画笔、矩形、圆形、箭头、文本
3. **操作同步机制** - 增量更新 + 操作广播
4. **房间系统** - 创建/加入房间，隔离协作空间
5. **撤销/重做** - 操作栈管理
6. **用户光标与在线状态展示**
7. **白板数据持久化** - 保存/加载历史内容
8. **简单权限控制** - 只读/编辑

### 1.3 目标用户

- 远程会议参与者
- 在线教育师生
- 团队协作成员
- 需要临时白板沟通的个人用户

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         客户端层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  React UI   │  │  Konva.js   │  │  WebSocket Client   │  │
│  │  (工具栏/    │  │  (Canvas    │  │  (实时通信/         │  │
│  │   属性面板)  │  │   渲染引擎)  │  │   状态同步)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket
┌─────────────────────────────────────────────────────────────┐
│                         网关层                                │
│              FastAPI WebSocket Endpoint                       │
│         (连接管理 / 消息路由 / 心跳检测)                        │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Redis Pub/Sub  │ │   Redis Cache   │ │  PostgreSQL     │
│  (房间消息广播)   │ │  (房间状态/用户  │ │  (操作历史/白板   │
│                  │ │   在线状态缓存)  │ │   数据持久化)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 2.2 架构说明

- **客户端层**: React 负责 UI 组件（工具栏、属性面板、用户列表），Konva.js 负责 Canvas 渲染，WebSocket Client 负责与后端实时通信
- **网关层**: FastAPI 提供 WebSocket 连接，管理连接生命周期，处理消息路由
- **数据层**: Redis 负责实时状态缓存和跨实例广播，PostgreSQL 负责持久化存储

---

## 3. 技术栈

### 3.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18+ | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Konva.js | 9.x | Canvas 2D 渲染引擎 |
| react-konva | 18.x | React 绑定 |
| Zustand | 4.x | 状态管理 |
| Tailwind CSS | 3.x | 样式框架 |
| shadcn/ui | latest | UI 组件库 |
| Vite | 5.x | 构建工具 |

### 3.2 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.11+ | 编程语言 |
| FastAPI | 0.110+ | Web 框架 |
| websockets | 12.x | WebSocket 原生支持 |
| SQLAlchemy | 2.0+ | ORM |
| asyncpg | 0.29+ | 异步 PostgreSQL 驱动 |
| redis-py | 5.x | Redis 客户端 |
| Pydantic | 2.x | 数据验证 |
| uvicorn | 0.27+ | ASGI 服务器 |

### 3.3 数据存储

| 技术 | 版本 | 用途 |
|------|------|------|
| PostgreSQL | 15+ | 持久化数据库 |
| Redis | 7+ | 实时缓存与消息广播 |

### 3.4 部署与运维

| 技术 | 用途 |
|------|------|
| Docker | 容器化 |
| Docker Compose | 本地/测试环境编排 |
| Nginx | 反向代理、静态资源服务 |

---

## 4. 核心模块设计

### 4.1 前端模块划分

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| `WhiteboardCanvas` | Konva.js 画布初始化、渲染循环、视口变换 | `canvas/WhiteboardCanvas.tsx` |
| `ToolManager` | 工具切换逻辑（画笔/矩形/圆形/箭头/文本） | `tools/ToolManager.ts` |
| `DrawingEngine` | 图形绘制逻辑、鼠标事件处理、Konva 对象创建 | `canvas/DrawingEngine.ts` |
| `SyncManager` | WebSocket 连接管理、消息收发、状态同步 | `sync/SyncManager.ts` |
| `HistoryManager` | 操作栈管理、撤销/重做逻辑 | `history/HistoryManager.ts` |
| `CursorManager` | 远程用户光标渲染、在线状态展示 | `cursor/CursorManager.ts` |
| `RoomManager` | 房间创建/加入、权限校验 | `room/RoomManager.ts` |

### 4.2 后端模块划分

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| `ConnectionManager` | WebSocket 连接池、用户会话管理 | `services/connection.py` |
| `RoomService` | 房间生命周期管理、用户进出、权限控制 | `services/room.py` |
| `BroadcastService` | 消息广播（同房间 / 全量 / 增量） | `services/broadcast.py` |
| `OperationService` | 操作序列化、存储、回放 | `services/operation.py` |
| `PersistenceService` | 数据持久化、快照管理、历史加载 | `services/persistence.py` |
| `AuthService` | 简单权限控制（只读/编辑） | `services/auth.py` |

---

## 5. 数据流与通信协议

### 5.1 操作数据流

```
用户操作（画笔/移动/删除）
    │
    ▼
┌─────────────┐
│ 本地立即渲染  │ ← 乐观更新，保证低延迟交互
└─────────────┘
    │
    ▼
┌─────────────┐
│ 生成 Operation│
│ {            │
│   type: "draw", │
│   tool: "brush",│
│   points: [...],│
│   style: {...}, │
│   timestamp,    │
│   userId,       │
│   operationId   │
│ }            │
└─────────────┘
    │
    ▼
┌─────────────┐
│ 加入本地 History│
│ Stack（撤销用） │
└─────────────┘
    │
    ▼ WebSocket
┌─────────────┐
│ 发送到服务器  │
└─────────────┘
    │
    ▼
┌─────────────┐
│ 服务器校验    │
│（权限/房间存在）│
└─────────────┘
    │
    ├── 校验通过 ──► Redis Pub/Sub 广播到房间所有用户
    │                  │
    │                  ▼
    │              ┌─────────────┐
    │              │ 其他用户接收  │
    │              │ 并应用操作   │
    │              └─────────────┘
    │
    └── 校验失败 ──► 回滚本地操作 / 提示错误
```

### 5.2 WebSocket 消息协议

#### 客户端 → 服务器

```typescript
type ClientMessage =
  | { type: "join_room"; roomId: string; userName: string; role: "editor" | "viewer" }
  | { type: "operation"; operation: Operation }
  | { type: "cursor_move"; position: { x: number; y: number } }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "request_sync" }; // 新用户加入请求全量状态
```

#### 服务器 → 客户端

```typescript
type ServerMessage =
  | { type: "room_state"; users: User[]; operations: Operation[] } // 全量同步
  | { type: "operation"; operation: Operation } // 增量广播
  | { type: "cursor_update"; userId: string; position: { x: number; y: number } }
  | { type: "user_joined"; user: User }
  | { type: "user_left"; userId: string }
  | { type: "error"; message: string };
```

### 5.3 Operation 数据结构

```typescript
interface Operation {
  id: string;           // UUID，全局唯一
  type: "draw" | "move" | "delete" | "clear" | "transform";
  tool?: "brush" | "rectangle" | "circle" | "arrow" | "text";
  targetId?: string;    // 目标图形 ID
  data: unknown;        // 工具特定数据（点坐标、样式等）
  style?: {
    strokeColor: string;
    strokeWidth: number;
    fillColor?: string;
    opacity?: number;
  };
  timestamp: number;    // Unix 时间戳（毫秒）
  userId: string;       // 操作用户 ID
  roomId: string;       // 所属房间 ID
  index: number;        // 操作序号（房间级别单调递增）
}
```

---

## 6. 关键机制设计

### 6.1 撤销/重做机制（操作栈）

```
┌────────────────────────────────────────┐
│           History Stack                │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │ Op1 │ │ Op2 │ │ Op3 │ │ Op4 │ ←── top（当前状态）
│  └─────┘ └─────┘ └─────┘ └─────┘     │
│     │       │       │       │         │
│     ▼       ▼       ▼       ▼         │
│   快照1    快照2    快照3    快照4      │
│  （每N个操作或特定操作创建快照）          │
└────────────────────────────────────────┘

撤销：top 指针左移，应用反向操作或回退到上一个快照 + 重放
重做：top 指针右移，应用正向操作
```

**设计要点：**

- 每个操作包含 `reverseOperation`（反向操作），用于快速撤销
- 每 20 个操作或每次"清除画布"类操作时创建快照，避免撤销链过长
- 新操作会清空 redo 栈
- 本地操作栈与服务器操作历史分离：本地栈用于撤销/重做，服务器历史用于同步和持久化

### 6.2 房间隔离与权限控制

#### 房间数据结构

```typescript
interface Room {
  id: string;           // UUID
  name: string;         // 房间名称
  createdAt: number;    // 创建时间戳
  ownerId: string;      // 创建者用户 ID
  users: RoomUser[];    // 在线用户列表
  settings: {
    maxUsers: number;   // 最大用户数（默认 20）
    isPublic: boolean;  // 是否公开（可被搜索加入）
    defaultRole: "viewer" | "editor"; // 新用户默认角色
  };
}

interface RoomUser {
  userId: string;
  userName: string;
  role: "owner" | "editor" | "viewer";
  joinTime: number;
  cursor: { x: number; y: number } | null;
  connectionId: string; // WebSocket 连接标识
}
```

#### 权限矩阵

| 操作 | owner | editor | viewer |
|------|-------|--------|--------|
| 绘制/编辑图形 | ✅ | ✅ | ❌ |
| 撤销/重做 | ✅ | ✅ | ❌ |
| 移动光标 | ✅ | ✅ | ✅ |
| 查看他人光标 | ✅ | ✅ | ✅ |
| 邀请用户 | ✅ | ❌ | ❌ |
| 踢出用户 | ✅ | ❌ | ❌ |
| 修改房间设置 | ✅ | ❌ | ❌ |
| 提升他人角色 | ✅ | ❌ | ❌ |

### 6.3 数据持久化策略

#### 存储分层

| 层级 | 技术 | 存储内容 | 过期策略 |
|------|------|----------|----------|
| 实时层 | Redis | 房间当前状态、用户在线状态、光标位置 | 房间关闭后 1 小时 |
| 持久层 | PostgreSQL | 操作历史、快照、房间元数据 | 永久 |

#### PostgreSQL 表结构

```sql
-- 房间表
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id VARCHAR(64) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 操作历史表
CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    tool VARCHAR(32),
    target_id VARCHAR(64),
    data JSONB NOT NULL,
    style JSONB,
    user_id VARCHAR(64) NOT NULL,
    op_index BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, op_index)
);

-- 快照表
CREATE TABLE snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    data JSONB NOT NULL,           -- 画布序列化状态
    op_index BIGINT NOT NULL,      -- 对应的操作序号
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_operations_room_id ON operations(room_id);
CREATE INDEX idx_operations_room_index ON operations(room_id, op_index);
CREATE INDEX idx_snapshots_room_id ON snapshots(room_id);
```

#### 持久化策略

1. **操作实时写入 PostgreSQL**（异步批量写入优化，每 100ms 或 50 条操作批量提交）
2. **每 50 个操作或 5 分钟自动生成快照**
3. **房间关闭时保存最终快照**
4. **新用户加入时：加载最近快照 + 重放后续操作**

---

## 7. 项目目录结构

```
whiteboard-collab/
├── frontend/                      # React 前端
│   ├── public/
│   ├── src/
│   │   ├── components/            # UI 组件
│   │   │   ├── ui/               # shadcn/ui 基础组件
│   │   │   ├── toolbar/          # 工具栏组件
│   │   │   ├── property-panel/   # 属性面板
│   │   │   ├── user-list/        # 在线用户列表
│   │   │   └── room-modal/       # 房间创建/加入弹窗
│   │   ├── canvas/               # Konva.js 画布相关
│   │   │   ├── WhiteboardCanvas.tsx
│   │   │   ├── DrawingEngine.ts
│   │   │   └── ViewportManager.ts
│   │   ├── tools/                # 绘图工具实现
│   │   │   ├── ToolManager.ts
│   │   │   ├── BrushTool.ts
│   │   │   ├── RectangleTool.ts
│   │   │   ├── CircleTool.ts
│   │   │   ├── ArrowTool.ts
│   │   │   └── TextTool.ts
│   │   ├── sync/                 # 同步管理
│   │   │   ├── SyncManager.ts
│   │   │   └── WebSocketClient.ts
│   │   ├── history/              # 撤销/重做
│   │   │   ├── HistoryManager.ts
│   │   │   └── OperationStack.ts
│   │   ├── cursor/               # 光标管理
│   │   │   ├── CursorManager.ts
│   │   │   └── RemoteCursor.tsx
│   │   ├── room/                 # 房间管理
│   │   │   ├── RoomManager.ts
│   │   │   └── useRoom.ts
│   │   ├── stores/               # Zustand 状态管理
│   │   │   ├── useCanvasStore.ts
│   │   │   ├── useToolStore.ts
│   │   │   ├── useUserStore.ts
│   │   │   └── useRoomStore.ts
│   │   ├── types/                # TypeScript 类型定义
│   │   │   ├── operation.ts
│   │   │   ├── room.ts
│   │   │   └── user.ts
│   │   ├── utils/                # 工具函数
│   │   │   ├── id.ts
│   │   │   ├── color.ts
│   │   │   └── throttle.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── backend/                       # FastAPI 后端
│   ├── app/
│   │   ├── api/                  # API 路由
│   │   │   ├── routes/
│   │   │   │   ├── websocket.py  # WebSocket 端点
│   │   │   │   └── room.py      # REST API 路由
│   │   │   └── deps.py          # 依赖注入
│   │   ├── services/            # 业务逻辑服务
│   │   │   ├── connection.py    # 连接管理
│   │   │   ├── room.py          # 房间服务
│   │   │   ├── broadcast.py     # 广播服务
│   │   │   ├── operation.py     # 操作服务
│   │   │   ├── persistence.py   # 持久化服务
│   │   │   └── auth.py          # 权限服务
│   │   ├── models/              # 数据模型
│   │   │   ├── database.py      # 数据库连接
│   │   │   ├── room.py          # 房间模型
│   │   │   ├── operation.py     # 操作模型
│   │   │   └── snapshot.py      # 快照模型
│   │   ├── schemas/             # Pydantic 模式
│   │   │   ├── websocket.py
│   │   │   ├── room.py
│   │   │   └── operation.py
│   │   ├── core/                # 核心配置
│   │   │   ├── config.py        # 应用配置
│   │   │   ├── security.py      # 安全相关
│   │   │   └── exceptions.py    # 自定义异常
│   │   └── main.py              # 应用入口
│   ├── tests/                   # 测试
│   ├── alembic/                 # 数据库迁移
│   ├── requirements.txt
│   ├── Dockerfile
│   └── pyproject.toml
├── docker-compose.yml            # 一键启动
├── nginx.conf                    # Nginx 配置
└── README.md                     # 项目文档
```

---

## 8. 非功能需求

### 8.1 性能目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 操作同步延迟 | < 100ms | 本地操作到远程用户看到的延迟 |
| 支持并发房间数 | 100+ | 单实例 |
| 单房间最大用户数 | 20 | 可配置 |
| 画布对象数量 | 5000+ | 无明显卡顿 |
| 首屏加载时间 | < 3s | 包含初始同步 |

### 8.2 可靠性

- WebSocket 断线自动重连（指数退避策略）
- 操作本地缓存，重连后批量同步
- 服务器崩溃后从 PostgreSQL 恢复房间状态

### 8.3 安全性

- WebSocket 连接限速（防 DoS）
- 操作数据校验（防止非法图形数据）
- 房间 ID 使用 UUID，防止暴力枚举

---

## 9. 开发阶段规划

### Phase 1: 基础架构（Week 1）

- [ ] 项目初始化（前端 + 后端 + Docker）
- [ ] 数据库设计与迁移
- [ ] WebSocket 基础连接管理
- [ ] 简单房间创建/加入

### Phase 2: 核心绘图（Week 2）

- [ ] Konva.js 画布集成
- [ ] 画笔工具实现
- [ ] 基础图形工具（矩形/圆形/箭头/文本）
- [ ] 操作序列化与同步

### Phase 3: 协作功能（Week 3）

- [ ] 增量更新广播
- [ ] 远程光标展示
- [ ] 用户在线状态
- [ ] 撤销/重做

### Phase 4: 持久化与优化（Week 4）

- [ ] 操作历史持久化
- [ ] 快照机制
- [ ] 房间状态恢复
- [ ] 权限控制

### Phase 5:  polish（Week 5）

- [ ] UI 美化
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 文档完善

---

## 10. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| WebSocket 大规模并发性能 | 高 | Redis Pub/Sub 支持水平扩展 |
| 画布大量对象渲染卡顿 | 高 | Konva.js 性能优化、分层渲染、对象池 |
| 操作冲突（并发编辑同一对象） | 中 | 乐观锁 + 最后写入胜出（OT 算法未来可引入） |
| 数据丢失（服务器崩溃） | 中 | 定期快照 + 操作日志持久化 |

---

## 11. 附录

### 11.1 参考资源

- [Konva.js 官方文档](https://konvajs.org/)
- [FastAPI WebSocket 文档](https://fastapi.tiangolo.com/advanced/websockets/)
- [Redis Pub/Sub 文档](https://redis.io/docs/manual/pubsub/)
- [Figma 实时协作技术博客](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)

### 11.2 术语表

| 术语 | 说明 |
|------|------|
| OT | Operational Transformation，操作转换算法 |
| CRDT | Conflict-free Replicated Data Type，无冲突复制数据类型 |
| 乐观更新 | 本地先执行操作，再等待服务器确认 |
| 快照 | 某一时刻画布的完整状态记录 |
