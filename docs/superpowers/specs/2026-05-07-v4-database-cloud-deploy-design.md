# V4: 数据库全量持久化 + 云服务器部署

> **项目:** whiteboard-collab
> **日期:** 2026-05-07
> **版本:** v4
> **父设计:** 2026-05-06-v3c-user-system-design.md

---

## 1. 概述

V4 在 V3C 用户系统基础上，将画布数据也纳入 PostgreSQL 持久化，并将整个项目部署到阿里云轻量应用服务器。

### 1.1 核心改动

1. **Shapes 持久化** — shapes 表 + operations 表 + snapshots 表，画布内容服务器重启不丢失
2. **操作日志** — 每次 draw/delete/update/clear 写入 operations 表，支持审计和增量同步
3. **定期快照** — shapes_snapshots 表，用户加入房间时快速恢复画布状态
4. **后端模块化拆分** — main.py（670行单文件）拆分为 15+ 模块文件
5. **Docker Compose 升级** — 从双容器升级为四容器（frontend + backend + nginx + postgres）
6. **阿里云部署** — 购买配置教程 + 项目上线全流程

### 1.2 与 V3C 的关系

V4 是 V3C 的扩展，而非替代：
- V3C 的 users / rooms / refresh_tokens / anonymous_sessions / room_participants 五张表保持不变
- V4 在此基础上新增 shapes / operations / shapes_snapshots 三张表
- V3C 的前端用户系统（AuthModal / RoomPanel / Sidebar 增强）不受影响

---

## 2. 双层持久化架构

```
客户端 WebSocket ──► FastAPI ──► 内存 (在线状态 + WebSocket 连接)
                          │
                          ├──► PostgreSQL (持久化层)
                          │    ├── users                 (用户账号)
                          │    ├── refresh_tokens        (JWT 刷新令牌)
                          │    ├── anonymous_sessions     (游客会话)
                          │    ├── rooms                  (房间元数据)
                          │    ├── room_participants      (房间参与者记录)
                          │    ├── shapes                 (画布形状，V4 新增)
                          │    ├── operations             (操作日志，V4 新增)
                          │    └── shapes_snapshots       (画布快照，V4 新增)
                          │
                          └──► 内存 dict (在线用户 + WebSocket 连接)
                               ├── connections: conn_id → {ws, userId, roomId}
                               └── rooms[id]["users"]: 在线用户列表
```

**核心原则：**
- **内存是缓存，PostgreSQL 是真相源** — 在线状态保留在内存，所有可持久化数据落库
- **先写库，再广播** — draw/delete/update/clear 先写入 PostgreSQL，成功后再广播
- **加入时从库恢复** — 用户加入房间时，从 PostgreSQL 加载 shapes 历史

---

## 3. 数据模型设计

### 3.1 V3C 已有表（保持不变）

users, refresh_tokens, anonymous_sessions, rooms, room_participants 五张表见 V3C 设计文档。

### 3.2 shapes 表（V4 新增）

```sql
CREATE TABLE shapes (
    id          VARCHAR(64) PRIMARY KEY,           -- shape.id（前端 UUID）
    room_id     VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL,              -- brush/rectangle/circle/arrow/text/line/triangle/diamond/pentagon/star
    data        JSONB NOT NULL,                    -- 完整 shape 数据
    created_by  VARCHAR(64) NOT NULL,             -- 用户 ID（auth UUID 或 anon_xxx）
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,    -- 软删除
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_shapes_room ON shapes(room_id);
CREATE INDEX idx_shapes_room_type ON shapes(room_id, type) WHERE NOT is_deleted;
```

**JSONB data 字段示例：**

```json
{
  "type": "rectangle",
  "points": [100, 200, 300, 400],
  "style": {
    "strokeColor": "#1a1a1a",
    "strokeWidth": 3,
    "fillColor": "transparent",
    "opacity": 1,
    "fontSize": null
  },
  "text": null,
  "rotation": 0
}
```

### 3.3 operations 表（V4 新增）

```sql
CREATE TABLE operations (
    id          BIGSERIAL PRIMARY KEY,
    room_id     VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id     VARCHAR(64) NOT NULL,             -- 操作者 ID
    action      VARCHAR(20) NOT NULL,              -- draw / delete / update / clear
    shape_id    VARCHAR(64),                       -- 操作的 shape.id
    shape_data  JSONB,                             -- draw/update 时带的完整 shape
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operations_room ON operations(room_id, created_at);
CREATE INDEX idx_operations_room_seq ON operations(room_id, id);
```

**用途：**
- 操作审计 — 记录每次操作的时间、用户、动作
- 未来增量同步 — 按操作序列号同步，而非每次传全量 shapes
- 配合快照恢复 — 加载最新快照 + 快照之后的增量 operations

### 3.4 shapes_snapshots 表（V4 新增）

```sql
CREATE TABLE shapes_snapshots (
    id          BIGSERIAL PRIMARY KEY,
    room_id     VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    shapes_data JSONB NOT NULL,                   -- 所有 active shapes 的全量快照
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_room ON shapes_snapshots(room_id, created_at DESC);
```

**快照策略：**
- 房间每累积 20 个 operations 或每 30 分钟自动创建一次快照
- 用户加入时：加载最新快照 + 快照之后的增量 operations → 重建画布状态
- 避免遍历全部历史操作（性能优化）

### 3.5 数据流

**用户 draw 一个形状：**

```
客户端 ws.send({type:"operation", action:"draw", shape:{...}})
  │
  ▼
FastAPI handle_operation()
  ├── 1. INSERT INTO shapes (...)
  ├── 2. INSERT INTO operations (action='draw', shape_data=...)
  ├── 3. 判断是否需要创建快照（每 20 ops 或 30min）
  │      └── 需要则: INSERT INTO shapes_snapshots (...)
  └── 4. broadcast_to_room(...)
```

**用户加入已有房间：**

```
客户端 ws.send({type:"join_room", roomId:"abc123"})
  │
  ▼
FastAPI handle_join_room()
  ├── 1. SELECT * FROM shapes WHERE room_id='abc123' AND NOT is_deleted
  ├── 2. 返回 room_state {users, shapes}
  └── 3. 将该用户加入 connections dict
```

---

## 4. 后端模块化拆分

### 4.1 目标结构

```
backend/
├── Dockerfile
├── requirements.txt
├── run.py
├── alembic/
│   ├── env.py
│   └── versions/
│       └── 001_initial_schema.py
└── app/
    ├── main.py                    # FastAPI 应用入口 + 路由注册 + 生命周期
    ├── core/
    │   ├── config.py              # 环境变量加载
    │   ├── security.py            # 密码哈希 + JWT 签发/验证
    │   └── exceptions.py          # 自定义异常类
    ├── models/
    │   ├── database.py            # async SQLAlchemy engine + session
    │   ├── user.py                # User ORM
    │   ├── refresh_token.py       # RefreshToken ORM
    │   ├── anonymous.py           # AnonymousSession ORM
    │   ├── room.py                # Room + RoomParticipant ORM
    │   ├── shape.py               # Shape ORM ✨新增
    │   └── operation.py           # Operation ORM ✨新增
    ├── schemas/
    │   ├── auth.py                # RegisterRequest / LoginRequest / TokenResponse
    │   ├── user.py                # UserPublic / RecentCollaborator
    │   ├── room.py                # RoomCreate / RoomInviteResponse
    │   ├── shape.py               # ShapeResponse ✨新增
    │   └── websocket.py           # ClientMessage / ServerMessage
    ├── api/
    │   ├── deps.py                # get_current_user 依赖注入
    │   └── routes/
    │       ├── auth.py            # POST /api/auth/register, login, refresh, logout
    │       ├── rooms.py           # POST /api/rooms, GET /api/rooms/{id}
    │       ├── users.py           # GET /api/users/recent
    │       └── websocket.py       # WebSocket /ws（改造：加入持久化调用）
    └── services/
        ├── auth.py                # 认证业务逻辑
        ├── room_service.py        # 房间创建/加入/清理
        ├── shape_service.py       # Shape CRUD ✨新增
        ├── operation_service.py   # 操作日志写入 ✨新增
        ├── snapshot_service.py    # 快照管理 ✨新增
        └── connection.py          # WebSocket 连接管理
```

### 4.2 关键模块说明

**services/shape_service.py** — 核心方法：

```python
async def create_shape(db, room_id, shape_data, user_id) -> Shape
async def update_shape(db, shape_id, shape_data) -> Shape
async def soft_delete_shape(db, shape_id) -> None
async def clear_room_shapes(db, room_id) -> None           # 批量软删除
async def get_active_shapes(db, room_id) -> list[Shape]     # 获取未删除的 shapes
```

**services/operation_service.py** — 核心方法：

```python
async def log_operation(db, room_id, user_id, action, shape_id, shape_data) -> Operation
async def get_operations_since(db, room_id, since_id) -> list[Operation]  # 增量查询
```

**services/snapshot_service.py** — 核心方法：

```python
async def maybe_create_snapshot(db, room_id, operation_count) -> None  # 判断是否需要快照
async def get_latest_snapshot(db, room_id) -> Snapshot | None
```

**api/routes/websocket.py** 改造要点 — handle_operation 函数：

```python
# 当前（内存）:
room["shapes"][shape.id] = shape
await broadcast_to_room(...)

# 改造后（持久化）:
await shape_service.create_shape(db, room_id, shape.dict(), user_id)
await operation_service.log_operation(db, room_id, user_id, "draw", shape.id, shape.dict())
await snapshot_service.maybe_create_snapshot(db, room_id, op_count[room_id])
await broadcast_to_room(...)
```

### 4.3 文件改动清单

| 操作 | 文件 | 说明 |
|------|------|------|
| ✨新建 | `models/shape.py` | Shape ORM |
| ✨新建 | `models/operation.py` | Operation ORM |
| ✨新建 | `services/shape_service.py` | Shape CRUD |
| ✨新建 | `services/operation_service.py` | 操作日志 |
| ✨新建 | `services/snapshot_service.py` | 快照管理 |
| ✨新建 | `schemas/shape.py` | Shape Pydantic schema |
| ✨新建 | `schemas/auth.py` | 认证 Pydantic schema |
| ✨新建 | `schemas/user.py` | 用户 Pydantic schema |
| ✨新建 | `schemas/room.py` | 房间 Pydantic schema |
| ✨新建 | `api/routes/auth.py` | 认证 REST 端点 |
| ✨新建 | `api/routes/rooms.py` | 房间 REST 端点 |
| ✨新建 | `api/routes/users.py` | 用户 REST 端点 |
| ✨新建 | `api/deps.py` | 依赖注入 |
| ✨新建 | `core/config.py` | 环境变量 |
| ✨新建 | `core/security.py` | JWT + 密码 |
| ✨新建 | `core/exceptions.py` | 异常类 |
| ✨新建 | `alembic/` 目录 | 数据库迁移 |
| ✨新建 | `models/user.py` | User ORM |
| ✨新建 | `models/refresh_token.py` | RefreshToken ORM |
| ✨新建 | `models/anonymous.py` | AnonymousSession ORM |
| ✨新建 | `models/room.py` | Room + RoomParticipant ORM |
| ✨新建 | `services/auth.py` | 认证业务逻辑 |
| ✨新建 | `services/room_service.py` | 房间业务逻辑 |
| 🔧改造 | `app/main.py` | 移除内联函数，改为路由注册 + 生命周期 |
| 🔧改造 | `api/routes/websocket.py` | handle_operation 加入持久化调用 |
| 🔧改造 | `models/database.py` | async SQLAlchemy 引擎配置 |
| 🔧改造 | `services/connection.py` | JWT 用户绑定 |
| 🔧更新 | `requirements.txt` | 添加 asyncpg, alembic, bcrypt, PyJWT |
| 🔧更新 | `docker-compose.yml` | 加入 postgres 容器 + env 变量 |
| 🔧更新 | `backend/Dockerfile` | 确保数据库依赖可用 |

---

## 5. 云服务器部署

### 5.1 推荐配置

| 项目 | 选择 |
|------|------|
| 服务器 | 阿里云轻量应用服务器 2核2G（68-88 元/年，学生优惠） |
| 系统镜像 | Ubuntu 22.04 LTS |
| 数据库 | PostgreSQL 15（Docker 容器内运行） |
| 部署方式 | Docker Compose 四容器编排 |
| 反向代理 | nginx（复用现有 nginx.conf） |
| 访问方式 | 直接使用公网 IP（域名可选） |

### 5.2 部署架构图

```
Internet
    │
    ▼
阿里云轻量应用服务器 (公网 IP: x.x.x.x)
    │
    ├── 防火墙 (22, 80, 443 端口开放)
    │
    ▼
Docker Compose
    ├── nginx (80:80)
    │     ├── /        → frontend:3000（前端静态文件）
    │     ├── /api/*   → backend:8000（FastAPI）
    │     └── /ws      → backend:8000（WebSocket）
    ├── frontend (Vite + React，内部端口 3000)
    ├── backend  (FastAPI，内部端口 8000)
    └── postgres (PostgreSQL 15，内部端口 5432)
          └── pgdata volume（数据持久化）
```

### 5.3 详细部署步骤

#### 第 1 步：购买阿里云轻量应用服务器

1. 打开 [阿里云官网](https://www.aliyun.com)，注册/登录账号
2. 搜索"轻量应用服务器"或访问轻量应用服务器产品页
3. 点击"立即购买"
4. 配置选择：
   - **地域**：选择离你最近的可用区（如华东1 杭州）
   - **镜像类型**：系统镜像 → **Ubuntu 22.04**
   - **套餐**：选择 2核2G（学生优惠套餐，约 68-88 元/年）
   - **数据盘**：默认即可（或不选，用系统盘）
   - **购买时长**：1 年（学生优惠通常限购 1 年）
   - **购买数量**：1 台
5. 如果是第一次购买，可能需要完成实名认证（上传身份证，1-2 小时审核）
6. 点击"立即购买" → 确认订单 → 支付

#### 第 2 步：服务器初始化

购买完成后，在阿里云控制台找到刚买的服务器：

1. 进入轻量应用服务器控制台 → 找到你的实例
2. **设置 root 密码**（如果购买时未设置）：
   - 点击实例 → 远程连接 → 重置密码
   - 设置一个强密码，牢记
3. **配置防火墙**（在控制台"防火墙"标签页中）：
   - 添加规则：端口 `80`，协议 TCP，备注 HTTP
   - 添加规则：端口 `443`，协议 TCP，备注 HTTPS
   - 端口 `22` 默认已开放（SSH，不要关）
4. 记录下**公网 IP 地址**（如 `47.xx.xx.xx`）

#### 第 3 步：SSH 连接

在你的 Windows 电脑上打开 Git Bash（已安装过），执行：

```bash
ssh root@<你的公网IP>
```

首次连接提示 `Are you sure you want to continue connecting?` 输入 `yes` 回车，然后输入你设置的 root 密码。

#### 第 4 步：安装 Docker

```bash
# 1. 更新系统包
apt update && apt upgrade -y

# 2. 安装 Docker 官方脚本
curl -fsSL https://get.docker.com | sh

# 3. 安装 Docker Compose 插件
apt install docker-compose-plugin -y

# 4. 启动 Docker 并设置开机自启
systemctl enable docker && systemctl start docker

# 5. 验证安装
docker --version
docker compose version
```

#### 第 5 步：配置环境变量和项目文件

```bash
# 1. 安装 git
apt install git -y

# 2. 创建项目目录
mkdir -p /opt/whiteboard
cd /opt/whiteboard

# 3. 克隆项目（使用 HTTPS，避免服务器上配置 SSH key）
git clone https://github.com/JiangJunjie1123/online-whiteboard.git .

# 4. 生成随机密钥并创建 .env 文件
JWT_KEY=$(openssl rand -hex 32)
DB_PASS=$(openssl rand -hex 16)

cat > .env << EOF
# JWT 配置
JWT_SECRET=${JWT_KEY}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# 数据库配置
DB_PASSWORD=${DB_PASS}
DATABASE_URL=postgresql+asyncpg://wb_user:${DB_PASS}@postgres:5432/whiteboard
EOF

# 5. 确认 .env 已正确生成
cat .env
```

#### 第 6 步：构建并启动

```bash
# 在 /opt/whiteboard 目录下
docker compose up -d --build
```

首次启动会拉取镜像并构建（约 5-10 分钟）。启动后验证：

```bash
# 查看容器状态
docker compose ps

# 应该看到四个容器都是 Up 状态：
# nginx, backend, frontend, postgres

# 查看日志
docker compose logs backend
docker compose logs postgres
```

#### 第 7 步：运行数据库迁移

```bash
# 进入 backend 容器执行 alembic 迁移
docker compose exec backend alembic upgrade head
```

#### 第 8 步：验证部署

1. 在浏览器打开 `http://<你的公网IP>`
2. 应该能看到白板首页
3. 测试功能：创建房间 → 画几笔 → 关闭页面 → 重新打开 → 加入同一房间 → 画布内容应仍然存在

#### 第 9 步（可选）：后续更新

```bash
cd /opt/whiteboard
git pull
docker compose up -d --build
```

### 5.4 常见问题排查

| 问题 | 可能原因 | 解决 |
|------|---------|------|
| 无法 SSH 连接 | 防火墙没开 22 端口 | 阿里云控制台→防火墙→检查 22 端口规则 |
| 浏览器打不开页面 | 防火墙没开 80 端口 | 阿里云控制台→防火墙→添加 80 端口规则 |
| 数据库连接失败 | .env 中 DB_PASSWORD 不匹配 | 检查 .env 和 docker-compose.yml 中的密码一致 |
| 容器启动失败 | 端口冲突 | `docker compose logs <服务名>` 查看具体错误 |
| 注册/登录不工作 | JWT_SECRET 未设置 | 确认 .env 中 JWT_SECRET 不为空 |

### 5.5 docker-compose.yml（V4 升级版）

```yaml
version: "3.8"

services:
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - ACCESS_TOKEN_EXPIRE_MINUTES=15
      - REFRESH_TOKEN_EXPIRE_DAYS=7
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - whiteboard

  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    networks:
      - whiteboard

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
    networks:
      - whiteboard

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=whiteboard
      - POSTGRES_USER=wb_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wb_user -d whiteboard"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - whiteboard

networks:
  whiteboard:

volumes:
  pgdata:
```

---

## 6. 实施计划

### 实施顺序

| 阶段 | 内容 | 预计工作量 |
|------|------|-----------|
| Phase 1 | 数据库持久化 — 后端模块化拆分 + ORM + shapes/operations/snapshots 表 | 主工作量 |
| Phase 2 | 云服务器部署 — 购买配置 + Docker Compose 升级 + 上线 | 半天 |
| Phase 3 | 验收测试 — 全链路功能验证 | 1-2小时 |

### 与 V3 系列的依赖关系

V4 的数据库层建立后，V3B（50+ 形状/模板）和 V3C（用户系统）需要基于新的模块化后端实现。V3D（导出）无数据库依赖，可独立完成。

推荐调整后的实施顺序：
```
P1: V3D (导出，无数据库依赖)
P2: V4 Phase1-2 (数据库 + 部署)
P3: V3C (用户系统，依赖 V4 数据库)
P4: V3B (形状/模板，依赖 V4 模块化后端)
```

---

## 7. 环境变量汇总

```bash
# JWT
JWT_SECRET=<openssl rand -hex 32>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# PostgreSQL
DATABASE_URL=postgresql+asyncpg://wb_user:${DB_PASSWORD}@postgres:5432/whiteboard
DB_PASSWORD=<openssl rand -hex 16>
```

---

## 8. 依赖新增

### 后端 (requirements.txt)

```
bcrypt==4.1.3
PyJWT==2.8.0
asyncpg==0.29.0
alembic==1.13.2
sqlalchemy[asyncio]==2.0.30
```

### 前端

无需新增依赖。

---

## 9. 验收标准

### 数据库持久化
- [ ] 用户创建房间后，rooms 表有对应记录
- [ ] 用户在画布上绘图后，shapes 表有对应记录
- [ ] 用户删除 shape 后，数据软删除（is_deleted=true）
- [ ] 用户清空画布后，房间内所有 shapes 标记为软删除
- [ ] operations 表记录每次操作（含操作者、时间、类型）
- [ ] 服务器重启后，加入同一房间，画布内容完整恢复
- [ ] 每 20 个操作自动创建一次快照

### 后端模块化
- [ ] main.py 不再包含内联路由和业务逻辑（纯入口文件）
- [ ] 每个服务模块职责单一，可独立测试
- [ ] WebSocket 连接根据 token 区分认证用户和游客

### 云服务器部署
- [ ] 服务器可通 SSH 连接
- [ ] Docker Compose 四容器全部健康运行
- [ ] 公网 IP 可访问白板应用（HTTP）
- [ ] WebSocket 实时同步功能正常
- [ ] PostgreSQL 数据卷持久化（服务重启数据不丢失）
- [ ] 防火墙正确开放 80 端口，屏蔽不必要的端口

### 向后兼容
- [ ] 游客模式正常可用
- [ ] 现有 10 种绘图工具全部可用
- [ ] 房间邀请链接功能正常
- [ ] 现有变换操作（移动/缩放/旋转）不受影响
