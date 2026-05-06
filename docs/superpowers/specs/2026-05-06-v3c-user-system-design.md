# V3C: 用户注册/登录系统 + 好友系统 + 房间号一键复制

> **项目:** whiteboard-collab
> **日期:** 2026-05-06
> **版本:** v3c
> **父设计:** 2026-04-28-whiteboard-collab-design.md

---

## 1. 概述

V3C 为白板协作应用引入完整的用户身份系统（注册/登录/JWT 鉴权）、好友添加与管理、以及房间号一键复制功能。同时重构后端从纯内存存储迁移至 PostgreSQL 持久化。

### 1.1 核心改动

1. **用户注册与登录** —— 邮箱 + 密码注册，JWT 双 token 鉴权
2. **用户数据持久化** —— PostgreSQL users 表，替代当前匿名 UUID 生成
3. **好友系统** —— 添加好友、好友列表、在线状态感知
4. **房间号一键复制** —— Sidebar 房间号旁增加复制按钮，Clipboard API
5. **WebSocket 鉴权集成** —— 连接时验证 JWT，拒绝未认证连接
6. **后端 REST API 扩充** —— 注册/登录/好友 CRUD 端点
7. **匿名用户兼容** —— 保留游客模式，功能受限但可正常绘图协作

### 1.2 动机

- 当前用户仅输入昵称即可进入房间，无身份持久化。刷新页面后 userId 丢失，好友无法识别"同一个人"
- 无用户系统意味着：无法添加好友、无法跨设备同步身份、无法做权限控制
- 房间号展示在 Sidebar 但无复制功能，用户需手动选中文字复制，体验差
- 后端全部内存存储，服务器重启丢失所有数据

---

## 2. 鉴权方案选型

### 2.1 方案对比

| 维度 | 邮箱+密码+JWT | OAuth (Google/GitHub) | Session Cookie |
|------|--------------|----------------------|----------------|
| 实现复杂度 | 中 | 中高（需注册 OAuth App） | 低 |
| 用户体验 | 需记住密码 | 一键登录，体验好 | 同 JWT |
| 部署复杂度 | 低（自包含） | 中（需配置回调 URL） | 低 |
| 跨域支持 | 天然支持 | 天然支持 | 需 SameSite 配置 |
| WebSocket 鉴权 | JWT 在连接时传递 | Token 在连接时传递 | Cookie 自动携带 |
| 扩展性 | 后续可加 OAuth | 取决于第三方 | 需 sticky session |
| 用户规模适应性 | 适合 1-1000 用户 | 适合所有规模 | 适合单实例 |

### 2.2 决策：邮箱 + 密码 + JWT（为主），OAuth 预留

**理由：**
- 当前项目处于 MVP 阶段，用户量小，自包含的邮箱密码方案部署负担最小
- JWT 天然适合 WebSocket 鉴权（连接时传 token），无 Cookie/Session 跨域问题
- 双 token 机制（access 15min + refresh 7d）兼顾安全性和用户体验
- 数据结构预留 `oauth_provider` / `oauth_id` 字段，未来可无缝加入 Google/GitHub OAuth

### 2.3 Token 设计

```
Access Token:
  - 载荷: { sub: user_id, email: email, nickname: nickname, exp, iat }
  - 有效期: 15 分钟
  - 存储: 前端内存（useAuthStore），不持久化

Refresh Token:
  - 载荷: { sub: user_id, token_id: uuid, exp, iat }
  - 有效期: 7 天
  - 存储: 前端 localStorage，后端数据库记录（可撤销）
  - 续期策略: 滑动窗口，每次使用后发布新的 refresh token，旧的立即失效
```

**刷新流程：**
1. 前端 axios/fetch 拦截器检测到 401
2. 自动用 refresh token 调用 `POST /api/auth/refresh`
3. 获得新 access token + 新 refresh token
4. 重试原请求
5. 若 refresh 也失败（过期/被撤销），清除状态跳转登录页

---

## 3. 数据模型设计

### 3.1 PostgreSQL 表结构

```sql
-- ============================================================
-- 用户表
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,       -- bcrypt hash
    nickname    VARCHAR(50)  NOT NULL,
    avatar_url  VARCHAR(500),
    oauth_provider VARCHAR(20),                -- NULL | 'google' | 'github' (预留)
    oauth_id    VARCHAR(255),                  -- 第三方用户 ID (预留)
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_nickname ON users(nickname);

-- ============================================================
-- Refresh Token 表（用于撤销管理）
-- ============================================================
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,         -- SHA-256 of refresh token
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ============================================================
-- 好友关系表
-- ============================================================
CREATE TABLE friendships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | accepted | blocked
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(user_id, status);

-- ============================================================
-- 匿名用户会话表（游客模式兼容）
-- ============================================================
CREATE TABLE anonymous_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code VARCHAR(50) UNIQUE NOT NULL,   -- session_<random>，客户端生成
    nickname    VARCHAR(50) NOT NULL,
    room_id     VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 现有表改造：rooms 表增加字段
-- ============================================================
-- rooms 表从设计文档定义，当前未实际创建（后端用内存 dict）
-- 在实现时需完整创建 rooms / operations / snapshots 表
```

### 3.2 Pydantic Schema 定义

```python
# ---- 注册/登录 ----
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    nickname: str = Field(min_length=1, max_length=50)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # 15 min in seconds
    user: UserPublic

class RefreshRequest(BaseModel):
    refresh_token: str

# ---- 用户公开信息 ----
class UserPublic(BaseModel):
    id: UUID
    nickname: str
    avatar_url: str | None
    is_anonymous: bool
    last_seen_at: datetime | None

# ---- 好友 ----
class FriendAddRequest(BaseModel):
    email: EmailStr  # 通过邮箱搜索添加

class FriendRequest(BaseModel):
    id: UUID
    from_user: UserPublic
    to_user_id: UUID
    status: Literal["pending", "accepted", "blocked"]
    created_at: datetime

class FriendListResponse(BaseModel):
    friends: list[UserPublic]
    pending_sent: list[FriendRequest]     # 我发出的待处理请求
    pending_received: list[FriendRequest] # 我收到的待处理请求
```

### 3.3 TypeScript 类型扩展

```typescript
// 扩展 src/types/index.ts

export interface AuthUser {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  isAnonymous: boolean
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number  // Unix timestamp ms
}

export interface FriendRequest {
  id: string
  fromUser: Pick<AuthUser, 'id' | 'nickname' | 'avatarUrl'>
  status: 'pending' | 'accepted' | 'blocked'
  createdAt: number
}

// User 类型扩展（向后兼容）
export interface User {
  id: string
  name: string
  color: string
  cursor?: { x: number; y: number } | null
  isOnline?: boolean          // 新增：在线状态
  isFriend?: boolean          // 新增：是否为好友
  avatarUrl?: string | null   // 新增
}
```

---

## 4. API 设计

### 4.1 REST API 端点

所有端点前缀 `/api`。除注册/登录外均需 `Authorization: Bearer <access_token>` 头。

#### 认证模块

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册新用户 | 无 |
| POST | `/api/auth/login` | 登录获取 token | 无 |
| POST | `/api/auth/refresh` | 刷新 access token | Refresh Token |
| POST | `/api/auth/logout` | 撤销 refresh token | Access Token |
| GET  | `/api/auth/me` | 获取当前用户信息 | Access Token |
| PATCH | `/api/auth/me` | 更新昵称/头像 | Access Token |

#### 好友模块

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/friends` | 获取好友列表 + 待处理请求 | Access Token |
| POST | `/api/friends/request` | 发送好友申请（传 email） | Access Token |
| POST | `/api/friends/accept` | 接受好友申请（传 request_id） | Access Token |
| POST | `/api/friends/reject` | 拒绝好友申请 | Access Token |
| DELETE | `/api/friends/{friend_id}` | 删除好友 | Access Token |

#### 房间模块（现有 room.py 预留，实现时完善）

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/rooms` | 创建房间 | Access Token |
| GET | `/api/rooms/{room_id}` | 获取房间信息 | Access Token |
| GET | `/api/rooms/{room_id}/shapes` | 获取房间画布历史 | Access Token |

### 4.2 WebSocket 消息协议扩展

#### 连接鉴权

客户端在 WebSocket 连接 URL 上携带 token：

```
ws://localhost:8000/ws?token=<access_token>
```

服务端在 `accept()` 前验证 token。验证失败返回 4001 状态码并关闭连接。

#### 新增消息类型

```typescript
// 客户端 → 服务器
type ClientMessage =
  | { type: "join_room"; roomId?: string; userName?: string }
  // userId 不再由客户端生成，由服务器从 token 提取
  | { type: "operation"; action: string; shape?: Shape; shapeId?: string }
  | { type: "cursor_move"; position: { x: number; y: number } }
  | { type: "request_sync" }
  | { type: "friend_online"; friendId: string }      // 新增（预留，当前用 user_joined 广播）
  | { type: "friend_offline"; friendId: string };    // 新增（预留）

// 服务器 → 客户端
type ServerMessage =
  | { type: "room_state"; roomId: string; userId: string; users: User[]; shapes: Shape[] }
  | { type: "operation"; action: string; shape?: Shape; shapeId?: string }
  | { type: "cursor_update"; userId: string; position: { x: number; y: number } }
  | { type: "user_joined"; user: User }
  | { type: "user_left"; userId: string }
  | { type: "error"; message: string }
  | { type: "friend_status"; friendId: string; online: boolean }; // 新增
```

**关键变更：** `join_room` 消息不再携带 `userId`。服务端从已验证的 JWT token 中提取 user_id，杜绝身份伪造。

### 4.3 匿名用户 WebSocket

匿名用户仍通过旧流程工作，但 userId 改为服务端分配：

```typescript
// 匿名连接：ws://localhost:8000/ws （无 token）
// 服务端检测无 token → 创建 anonymous session → 返回 session_code 作为 userId

// join_room 消息不携带 userId，服务端生成或从 JWT 提取
```

---

## 5. 前端状态管理

### 5.1 新增 `useAuthStore.ts`

```typescript
interface AuthState {
  // 已认证用户信息
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  isAuthenticated: boolean

  // 访客模式
  isAnonymous: boolean
  anonymousNickname: string | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, nickname: string) => Promise<void>
  logout: () => void
  refreshAuth: () => Promise<boolean>
  setAnonymous: (nickname: string) => void
  restoreSession: () => Promise<boolean>  // 从 localStorage 恢复 refresh token
}
```

### 5.2 `useUserStore` 改造

```typescript
// 移除字段：userId（改为从 useAuthStore 获取）
// 保留字段：userName, roomId, users, connected
// 新增字段：userName 自动同步自 useAuthStore.user.nickname
```

### 5.3 Token 刷新拦截器

新增 `src/api/httpClient.ts` —— 封装 fetch，自动附加 Authorization 头并处理 401 刷新逻辑。

```
请求 → 附加 Authorization → 发送
  → 200: 返回数据
  → 401: refreshAuth() → 重试原请求
    → 成功: 返回数据
    → 失败: 清除 auth 状态 → 跳转登录
```

---

## 6. UI 流程设计

### 6.1 启动流程（改造 RoomModal）

```
App 启动
  │
  ├─ localStorage 有 refreshToken
  │   └─ 自动刷新 accessToken
  │       ├─ 成功 → 已登录 → 显示房间选择面板（有登录态 UI）
  │       └─ 失败 → 清除 → 显示欢迎界面
  │
  └─ 无 refreshToken
      └─ 显示欢迎界面
          ├─ [登录] → 邮箱 + 密码 → 获取 token → 进入房间选择
          ├─ [注册] → 邮箱 + 密码 + 昵称 → 获取 token → 进入房间选择
          └─ [游客模式] → 输入昵称 → 匿名 session → 进入房间选择（当前流程）
```

### 6.2 欢迎界面组件 `AuthModal.tsx`

替代当前 `RoomModal` 作为首页入口：

```
┌──────────────────────────────────────┐
│           在线协作白板                 │
│     ┌──────────────────────┐         │
│     │    ✏️ 插图/图标       │         │
│     └──────────────────────┘         │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  邮箱                         │    │
│  │  ┌────────────────────────┐  │    │
│  │  │                        │  │    │
│  │  └────────────────────────┘  │    │
│  │  密码                         │    │
│  │  ┌────────────────────────┐  │    │
│  │  │                        │  │    │
│  │  └────────────────────────┘  │    │
│  │                              │    │
│  │  [        登  录        ]    │    │
│  └──────────────────────────────┘    │
│                                      │
│  没有账号？[注册]    [游客模式进入]    │
└──────────────────────────────────────┘
```

### 6.3 房间选择面板 `RoomPanel.tsx`（已登录态）

在 `AuthModal` 登录成功后或已登录用户直接进入：

```
┌──────────────────────────────────────┐
│  你好，{nickname}          [退出登录] │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [创建新房间]                 │    │
│  │  创建一个新的协作白板房间      │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  房间号                       │    │
│  │  ┌────────────────────────┐  │    │
│  │  │                        │  │    │
│  │  └────────────────────────┘  │    │
│  │  [      加入房间        ]    │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

### 6.4 登录态 Sidebar 增强

登录后在现有 Sidebar 基础上增加：

```
┌─────────────────────────────┐
│  👤 {nickname}    [退出]    │  ← 新增：用户信息行
│─────────────────────────────│
│  房间  a3f8b2c1    📋       │  ← 新增：📋 复制按钮
│  ● 已连接                   │
│─────────────────────────────│
│  ... 形状面板 ...           │
│─────────────────────────────│
│  在线 (3)                   │
│    🟢 用户A (好友)          │  ← 新增：好友标记
│    🟢 用户B                 │
│    🟢 你                    │
│─────────────────────────────│
│  好友 (5)            [＋]   │  ← 新增：好友区域
│    🟢 好友1 (在线)          │
│    ⚪ 好友2 (离线)          │
│    🟢 好友3 (在线)          │
│    ⚪ 好友4 (离线)          │
│    ⚪ 好友5 (离线)          │
└─────────────────────────────┘
```

### 6.5 房间号一键复制

**位置：** Sidebar 房间信息卡片内，房间号右侧

**实现：**
```typescript
const handleCopyRoomId = async () => {
  try {
    await navigator.clipboard.writeText(roomId)
    // 短暂显示 "已复制" toast，2s 后消失
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  } catch {
    // 降级：选中文本手动复制
    setFallbackCopy(true)
  }
}
```

**UI 状态：**
- 默认：📋 图标（中性灰）
- 点击后：✅ "已复制"（绿色，2s 后恢复）
- 降级（非 HTTPS/不支持 Clipboard API）：显示"手动复制"提示

### 6.6 添加好友流程

```
Sidebar 好友区域 [＋]
    │
    ▼
┌─────────────────────────┐
│  添加好友                │
│  输入对方注册邮箱        │
│  ┌─────────────────────┐│
│  │                     ││
│  └─────────────────────┘│
│  [取消]       [发送申请] │
└─────────────────────────┘
    │
    ▼ 发送 POST /api/friends/request
    │
    ▼ 对方收到通知
┌─────────────────────────┐
│  {nickname} 请求添加你   │
│  为好友                 │
│  [拒绝]         [接受]  │
└─────────────────────────┘
```

**好友申请通知：** 使用 WebSocket 推送 `friend_request` 类型消息，在前端以 toast 形式展示。同时在 `GET /api/friends` 的 `pending_received` 列表中持久化。

---

## 7. 后端架构改造

### 7.1 新增文件结构

```
backend/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── websocket.py      # 改造：JWT 鉴权
│   │   │   ├── room.py           # 保留
│   │   │   ├── auth.py           # 新增：注册/登录/刷新/登出
│   │   │   └── friends.py        # 新增：好友 CRUD
│   │   └── deps.py               # 新增：依赖注入（get_current_user）
│   ├── services/
│   │   ├── connection.py         # 改造：JWT 用户绑定
│   │   ├── room.py               # 保留
│   │   ├── broadcast.py          # 保留
│   │   ├── operation.py          # 保留
│   │   ├── persistence.py        # 保留
│   │   ├── auth.py               # 新增：JWT 签发/验证/密码哈希
│   │   └── friend.py             # 新增：好友业务逻辑
│   ├── models/
│   │   ├── database.py           # 改造：异步 SQLAlchemy 引擎
│   │   ├── user.py               # 新增：User ORM
│   │   ├── friendship.py         # 新增：Friendship ORM
│   │   ├── refresh_token.py      # 新增：RefreshToken ORM
│   │   ├── anonymous.py          # 新增：AnonymousSession ORM
│   │   ├── room.py               # 保留
│   │   ├── operation.py          # 保留
│   │   └── snapshot.py           # 保留
│   ├── schemas/
│   │   ├── auth.py               # 新增
│   │   ├── user.py               # 新增
│   │   ├── friend.py             # 新增
│   │   ├── websocket.py          # 保留
│   │   ├── room.py               # 保留
│   │   └── operation.py          # 保留
│   ├── core/
│   │   ├── config.py             # 改造：添加 JWT_SECRET, JWT_ALGORITHM 等
│   │   ├── security.py           # 新增：密码哈希、JWT 工具函数
│   │   └── exceptions.py         # 改造：添加认证异常类
│   └── main.py                   # 改造：注册 auth/friends 路由
├── alembic/
│   └── versions/
│       └── 001_user_system.py    # 新增：初始迁移
```

### 7.2 JWT 鉴权 WebSocket 流程

```python
# websocket.py 改造
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str | None = None):
    if token:
        # 已验证用户
        user = await verify_access_token(token)
        if not user:
            await ws.close(code=4001, reason="Invalid token")
            return
        await ws.accept()
        # user_id 来自数据库，不可伪造
        conn_id = f"auth_{user.id}"
    else:
        # 匿名游客
        await ws.accept()
        conn_id = f"anon_{uuid.uuid4().hex[:8]}"
        # 创建 anonymous session 记录

    # ... 后续处理同现有逻辑，但 conn 中记录 is_authenticated 和 user_id
```

### 7.3 内存存储 → PostgreSQL 迁移

当前后端全部内存存储（`rooms: dict`），V3C 实施时需一并将 rooms/shapes/users 迁移至 PostgreSQL：

| 当前状态 | 迁移后 |
|---------|--------|
| `rooms: dict` | `rooms` 表 (PostgreSQL) |
| `rooms[id]["shapes"]: dict` | `operations` 表，按 `room_id` 查询 |
| `rooms[id]["users"]: dict` | Redis 在线用户缓存 + `users` 表持久化 |
| `connections: dict` | Redis `room:{room_id}:connections` 集合 |

**过渡策略：** 第一版实现可保持内存存储用于 WebSocket 在线状态，仅将用户/好友信息写入 PostgreSQL。画布操作仍通过内存广播，后续版本逐步迁移持久化。

---

## 8. 安全设计

### 8.1 密码安全

- 密码使用 `bcrypt` 哈希，cost factor = 12
- 注册时前端做最低复杂度校验（6 字符），后端做完整校验
- 密码永不在日志中打印
- 登录失败返回模糊错误（"邮箱或密码错误"），不区分是邮箱不存在还是密码错误

### 8.2 JWT 安全

- Access token 使用 HS256，密钥从环境变量 `JWT_SECRET` 读取（至少 32 字节随机字符串）
- 默认开发密钥仅用于本地开发，生产环境必须覆盖
- Refresh token 存储 SHA-256 哈希，数据库不存明文
- Token 黑名单：登出时标记 refresh token 为 revoked

### 8.3 WebSocket 安全

- 连接时验证 JWT，无效 token 拒绝连接（关闭码 4001）
- 服务端验证 `join_room` 中的 userId 是否与 token 中的 user_id 一致（已认证用户）
- 匿名用户限制：每 IP 最多 5 个匿名连接
- 消息大小限制：单条消息最大 64KB（防 DoS）

### 8.4 API 安全

- CORS 限制：生产环境配置允许的 origin 白名单
- Rate limiting：`/api/auth/login` 每 IP 每分钟最多 10 次尝试；`/api/auth/register` 每 IP 每小时最多 5 次
- XSS 防护：所有用户输入（昵称、邮箱）输出时转义
- SQL 注入防护：使用 SQLAlchemy ORM 参数化查询

### 8.5 好友系统安全

- 添加好友需要知道对方邮箱（不是 ID），防止用户被随意搜索
- 好友申请 30 天内未处理自动过期
- 屏蔽用户（status=blocked）后双方互相不可见

---

## 9. 迁移策略：匿名用户兼容

### 9.1 原则

**不破坏现有体验。** 游客模式作为第一优先级保证正常运行。

### 9.2 三阶段迁移

```
Phase A（V3C 实施）:
  ├─ 新增完整注册/登录系统
  ├─ 保留游客模式入口
  ├─ 游客：功能同当前（输入昵称 → 加入房间），但 session 不跨设备
  └─ 注册用户：好友、持久化、跨设备登录

Phase B（V3C+1，未来版本）:
  ├─ 游客升级为注册用户（保留历史房间和操作）
  └─ 游客 session 可转为正式账号

Phase C（V3C+2，未来版本）:
  └─ 可选：所有用户必须登录（去掉游客模式）
```

### 9.3 游客 vs 注册用户功能对比

| 功能 | 游客 | 注册用户 |
|------|------|----------|
| 创建/加入房间 | 是 | 是 |
| 绘图协作 | 是 | 是 |
| 光标同步 | 是 | 是 |
| 撤销/重做 | 是 | 是 |
| 身份跨设备持久化 | 否 | 是 |
| 添加好友 | 否 | 是 |
| 好友在线状态 | 否 | 是 |
| 房间历史列表 | 否 | 是（未来） |
| 个人设置（头像/昵称） | 否 | 是 |

### 9.4 游客数据隔离

- 游客的 `userId` 由服务端生成（`anon_<uuid>`），不再由客户端生成
- 游客创建的房间 1 小时后无用户在线时自动清理
- 注册用户创建的房间持久保留
- 游客不能添加好友，好友区域不显示

---

## 10. 文件改动清单

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/components/AuthModal.tsx` | 登录/注册/游客选择面板 |
| `src/components/RoomPanel.tsx` | 已登录用户创建/加入房间面板 |
| `src/components/FriendList.tsx` | Sidebar 内好友列表组件 |
| `src/components/AddFriendModal.tsx` | 添加好友弹窗 |
| `src/stores/useAuthStore.ts` | 认证状态管理 |
| `src/api/httpClient.ts` | HTTP 请求封装 + token 刷新拦截 |
| `src/api/auth.ts` | 注册/登录/刷新 API 调用 |
| `src/api/friends.ts` | 好友 API 调用 |
| `backend/app/api/routes/auth.py` | 认证 REST 端点 |
| `backend/app/api/routes/friends.py` | 好友 REST 端点 |
| `backend/app/api/deps.py` | 依赖注入（get_current_user） |
| `backend/app/services/auth.py` | JWT 签发/验证/密码哈希 |
| `backend/app/services/friend.py` | 好友业务逻辑 |
| `backend/app/models/user.py` | User ORM |
| `backend/app/models/friendship.py` | Friendship ORM |
| `backend/app/models/refresh_token.py` | RefreshToken ORM |
| `backend/app/models/anonymous.py` | AnonymousSession ORM |
| `backend/app/schemas/auth.py` | 认证 Pydantic schemas |
| `backend/app/schemas/user.py` | 用户 Pydantic schemas |
| `backend/app/schemas/friend.py` | 好友 Pydantic schemas |
| `backend/app/core/security.py` | 安全工具函数 |
| `backend/alembic/versions/001_user_system.py` | 数据库迁移 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/components/Sidebar.tsx` | 添加房间号复制按钮、好友区域、用户信息行、区分登录/游客态 |
| `src/components/RoomModal.tsx` | 保留作为游客入口；登录用户使用 RoomPanel 替代 |
| `src/App.tsx` | 启动时检查登录态，路由到 AuthModal 或 RoomPanel |
| `src/stores/useUserStore.ts` | 移除本地生成 userId，从 useAuthStore 获取身份；新增好友相关状态 |
| `src/sync/SyncManager.ts` | 连接时携带 token，适配新的 join_room 协议 |
| `src/types/index.ts` | 新增 AuthUser, AuthTokens, FriendRequest 类型 |
| `backend/app/main.py` | 注册 auth/friends 路由；添加数据库启动事件 |
| `backend/app/models/database.py` | 异步 SQLAlchemy 引擎配置 |
| `backend/app/api/routes/websocket.py` | WebSocket JWT 鉴权；区分认证用户和游客 |
| `backend/app/core/config.py` | 新增 JWT_SECRET, DATABASE_URL 等环境变量 |
| `backend/app/core/exceptions.py` | 新增认证异常类 |
| `backend/requirements.txt` | 新增 bcrypt, PyJWT, asyncpg, alembic 依赖 |

---

## 11. 验收标准

### 注册与登录
- [ ] 用户可通过邮箱 + 密码 + 昵称注册账号
- [ ] 注册时邮箱格式校验，密码最低 6 字符
- [ ] 重复邮箱注册返回友好错误提示
- [ ] 已注册用户可通过邮箱 + 密码登录
- [ ] 登录成功获取 access token + refresh token
- [ ] 页面刷新后自动恢复登录态（无感知）
- [ ] access token 过期后自动静默刷新
- [ ] 退出登录后清除 token，回到欢迎界面
- [ ] 游客模式完整可用（输入昵称 → 创建/加入房间 → 绘图协作）

### 好友系统
- [ ] 已登录用户可通过邮箱搜索并发送好友申请
- [ ] 收到好友申请时显示 toast 通知
- [ ] 可接受/拒绝好友申请
- [ ] 好友列表显示在线/离线状态（实时更新）
- [ ] 删除好友功能正常
- [ ] 游客不显示好友区域
- [ ] 不能重复添加已存在的好友
- [ ] 不能添加自己为好友

### 房间号一键复制
- [ ] Sidebar 房间号旁显示复制按钮
- [ ] 点击后复制房间号到剪贴板
- [ ] 复制成功后显示 "已复制" 反馈（2s）
- [ ] 非 HTTPS 环境降级为手动复制提示

### 鉴权与安全
- [ ] WebSocket 连接时验证 JWT
- [ ] 无效/过期 token 拒绝 WebSocket 连接
- [ ] join_room 中 userId 从服务端 token 提取，不可伪造
- [ ] bcrypt 哈希存储密码
- [ ] refresh token 可撤销
- [ ] 登录接口有 rate limiting

### 向后兼容
- [ ] 游客模式与当前行为一致
- [ ] 现有绘图、同步、撤销功能不受影响
- [ ] 现有 WebSocket 消息协议向后兼容（未认证用户走旧逻辑）

---

## 12. 不包含（明确排除）

- OAuth 第三方登录（Google/GitHub）—— 预留字段，V3C 不实现
- 用户头像上传 —— 仅支持 URL 形式头像
- 忘记密码 / 邮箱验证 —— 未来版本
- 房间权限控制（owner/editor/viewer）细化 —— 现有 docs 已设计，不在 V3C
- 操作历史持久化到 PostgreSQL —— 已有设计，不在 V3C
- 视口/缩放状态同步（V3A 已排除）

---

## 13. 环境变量

实施时需新增以下环境变量：

```bash
# JWT
JWT_SECRET=<至少32字节随机字符串>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/whiteboard

# Redis （已有，用于在线状态）
REDIS_URL=redis://localhost:6379
```

---

## 14. 依赖新增

### 后端 (requirements.txt)

```
bcrypt==4.1.3          # 密码哈希
PyJWT==2.8.0           # JWT 签发/验证
asyncpg==0.29.0        # 异步 PostgreSQL 驱动
alembic==1.13.2        # 数据库迁移
```

### 前端 (package.json)

无需新增依赖。使用浏览器原生 `fetch`、`navigator.clipboard`、`crypto.randomUUID`。
