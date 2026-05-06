# V3 三方向设计审查总结

> **日期:** 2026-05-06
> **审查范围:** V3A (画布视觉) / V3B (形状模板) / V3C (用户系统) / V3D (导出)
> **父架构:** 2026-04-28-whiteboard-collab-design.md

---

## 1. 各设计摘要

### V3A: 画布无限扩展 + 视觉风格升级

将固定窗口画布升级为可平移/缩放的无限画布，新增视口状态管理（stageX/stageY/scale）和坐标转换工具函数（screenToWorld/worldToScreen）。同时引入 draw.io 风格的点阵网格背景和蓝色专业调色板（primary #1A73E8），统一形状默认样式。改动面集中在 WhiteboardCanvas、useCanvasStore、transformUtils 和 RemoteCursor，零数据模型影响。

### V3B: 50+ 形状扩展 + 一键模板系统

将绘图工具从 10 种扩展到 60 种（6 个分类），引入 Shape Registry 模式消除现有代码中 6 处 switch 语句。工具栏重构为分类折叠+搜索+收藏/最近使用的三层导航。新增四种一键模板（思维导图、类图、时序图、流程图），点击后在当前视口中心生成预布局的形状组。Shape 数据模型新增 extras/connectionData/templateId/groupId 四个可选字段。连接器自动联动推迟到 Phase 2。后端声明零 Schema 改动。

### V3C: 用户注册/登录系统 + 好友系统 + 房间号一键复制

为白板引入完整的用户身份系统：邮箱+密码注册、JWT 双 token 鉴权（access 15min + refresh 7d）、bcrypt 密码哈希。新增 PostgreSQL users/refresh_tokens/friendships/anonymous_sessions 四张表。好友系统支持通过邮箱搜索添加、接受/拒绝申请、在线状态感知。Sidebar 房间号旁新增一键复制按钮。WebSocket 连接集成 JWT 验证，join_room 的 userId 改为服务端从 token 提取。保留游客模式，功能受限但可正常绘图协作。后端从纯内存存储部分迁移至 PostgreSQL。

### V3D: 画布一键导出下载（PNG/JPG）

纯客户端导出功能，利用 Konva stage.toBlob() API。支持 PNG/JPG 两种格式和网格/白色/透明三种背景模式。导出范围为当前视口所见内容，Transformer 选择框和 RemoteCursor 自动排除。通过 ExportPopover 提供格式/背景选择，Ctrl+Shift+E 快捷键直接默认导出。文件命名 whiteboard-YYYYMMDD-HHmmss.ext。零后端改动。

---

## 2. 一致性问题

### 2.1 文件修改冲突（高）

多个设计文档修改相同的文件，合并时会产生冲突。以下是冲突热点：

| 文件 | 冲突来源 | 冲突描述 |
|------|---------|----------|
| `src/components/Sidebar.tsx` | V3A + V3B + V3C + V3D | **四个设计全部修改此文件**。V3A 改颜色+Transformer 样式，V3B 加模板面板，V3C 加用户信息行+房间号复制+好友区域，V3D 加导出按钮。需要明确定义 Sidebar 的最终布局顺序，否则各方向独立实施后合并成本极高。 |
| `src/stores/useCanvasStore.ts` | V3A + V3B + V3D | V3A 加 viewport 状态和 setViewport，V3B 加批量 addShape，V3D 加 getStage/setStageGetter。三个接口互不冲突但需合并到一个 store 定义中。 |
| `src/components/WhiteboardCanvas.tsx` | V3A + V3B + V3D | V3A 改 Stage draggable/缩放/坐标转换/GridBackground/Transformer ignoreStroke；V3B 改 renderShape/renderDrawingPreview/getTransformerConfig 三个函数从 switch 到 Registry；V3D 加 setStageGetter 注册和 Ctrl+Shift+E 快捷键。改动密集，合并风险最高。 |
| `src/stores/useToolStore.ts` | V3A + V3B | V3A 改默认样式为蓝色系；V3B 加 favorites/recentlyUsed 持久化字段。需协调默认样式的来源（store 默认值 vs Registry defaultStyle）。 |
| `src/types/index.ts` | V3B + V3C | V3B 将 ToolType 放宽为 ShapeType=string，新增 ConnectionAnchor/ConnectionData/ShapeDefinition 等类型；V3C 新增 AuthUser/AuthTokens/FriendRequest 类型。无逻辑冲突但需注意合并顺序。 |

**建议**: 各设计中的 Sidebar 改动应汇总到一个统一的 Sidebar 布局规范中（定义区域顺序：用户信息行 > 房间信息行 > 动作按钮行 > 形状面板 > 模板面板 > 在线用户 > 好友列表）。WhiteboardCanvas 的改造应以 V3A 为基础，V3B 和 V3D 在其上增量修改。

### 2.2 V3A 与 V3D: GridBackground 可见性控制缺失（中）

V3A 设计的 GridBackground.tsx 没有暴露可见性控制接口。V3D 需要在导出时临时隐藏网格背景（白色/透明模式），但将其列为"可选"改动。**这不是可选的** -- 如果用户选择白色或透明背景导出，网格必须被隐藏，否则导出结果不符合用户预期。

**建议**: V3A 实施时 GridBackground 组件应通过 Zustand store 或 forwardRef 暴露 `visible` 控制。V3D 的 exportCanvas.ts 通过 store 切换可见性，导出完成后恢复。

### 2.3 V3B ShapeType 放宽与类型安全（中）

V3B 将 `ToolType` 从字面量联合类型 (`'brush' | 'rectangle' | ...`) 改为 `ShapeType = string`。这消除了编译时穷举检查，依赖 Registry 的运行时校验。这一决策在 60 种形状下是合理的（联合类型会变得难以维护），但需要注意：

- 所有现有代码中对 `shape.type` 的 switch/case 必须迁移干净，否则遗留的 switch 在遇到新 type 时会落入 default 分支
- 序列化/反序列化时不再有类型守卫，需确保后端返回的 type 值不被随意篡改

**建议**: 在 Registry 中实现 `shapeRegistry.isValid(type)` 校验方法，在形状渲染/编辑的入口处调用并 warn 未知类型，防止静默失败。

### 2.4 V3C WebSocket 协议演进与匿名用户兼容（中）

V3C 修改了 `join_room` 消息：userId 不再由客户端生成，由服务端从 JWT 提取。对于匿名用户，服务端生成 `anon_<uuid>` 格式的 userId。这一变更需要：

- 前端 SyncManager 在 `join_room` 时不再发送 userId/userName（已认证用户）或仅发送 userName（匿名用户）
- 服务端 WebSocket handler 需要区分"有 token 无 userId 字段"和"无 token 也无 userId 字段"两种情况
- 现有的 room_state 消息中 users 数组的 userId 来源发生变化（从客户端自报变为服务端分配）

原架构设计中 `join_room` 消息格式为 `{ type: "join_room"; roomId: string; userName: string; role: "editor" | "viewer" }`，本身没有 userId 字段。V3C 文档中写"不再携带 userId"与原始设计一致，但需要明确 userName 的来源（已认证用户从数据库读取 nickname，匿名用户从客户端传入）。

**建议**: 在 V3C 实施时明确定义 `join_room` 消息的最终格式，区分认证用户和匿名用户的字段差异。

### 2.5 V3B 与 V3C: 后端 Shape 模型 extras 字段（低）

V3B 建议在后端 Pydantic Shape 模型中添加 `extras: Optional[dict] = None` 和 `connectionData` 字段。V3C 也涉及后端模型改造但主要关注用户系统。两者不冲突，但需协调数据库迁移的顺序 -- V3C 创建用户相关表，V3B 的可选 Shape 字段扩展可在任意时机单独添加。

---

## 3. 完整性问题

### 3.1 V3B: 模板撤销粒度未定义（高）

验收标准 13.3 写道："一次 Ctrl+Z 撤销一个 shape，或批量撤销整个模板"。这两种行为互斥，文档未明确选择哪种，也未说明如何实现"批量撤销整个模板"。如果逐 shape 撤销（~15 次 Ctrl+Z），用户体验差；如果批量撤销，需要实现操作分组（将模板生成的多个 draw operation 标记为一个原子操作组），这在当前 HistoryManager 设计中不存在。

**建议**: Phase 1 采用逐 shape 撤销（简单），同时在 Operation 数据模型中预留 `groupId` 字段（与 Shape.groupId 对应），为未来的批量撤销做准备。

### 3.2 V3B: 模板静态连接线大幅降低实用价值（高）

Phase 1 模板生成的连接线是静态坐标。用户移动任何一个节点后，连接线不会跟随，图表立即"断裂"。对于思维导图和流程图这种以连接关系为核心的图表类型，这严重限制了模板的实用价值。文档将连接器联动推迟到 Phase 2，但 Phase 2 的实现复杂度很高（锚点系统、正交路由、循环依赖处理）。

**建议**: 在 V3B 文档中明确标注 Phase 1 模板的已知限制，并在模板 UI 卡片上添加提示（如"移动节点后需手动调整连线"）。如果可能，至少为最简单的直线连接（arrow/bent-arrow 两节点间直连）实现 Phase 1 联动，因为其实现相对简单（只需在 onShapeUpdated 时重新计算起止点坐标）。

### 3.3 V3C: 好友在线状态的技术实现缺失（中）

文档在 UI 部分展示了"好友在线状态（实时更新）"，验收标准 11 也要求"好友列表显示在线/离线状态（实时更新）"。但文档未描述在线状态的技术实现：

- 是通过 Redis 记录在线用户集合，好友列表轮询？
- 是通过 WebSocket 推送 `friend_status` 消息（消息类型已定义但未描述何时触发）？
- 好友上线/下线事件如何检测（WebSocket 连接/断开 vs. 心跳超时）？
- 一个用户可能有多个 WebSocket 连接（多标签页），如何判断"真正离线"？

**建议**: 补充在线状态的技术方案。推荐方案：Redis 维护 `user:{user_id}:connections` 集合（记录所有连接 ID），用户的所有连接断开后才广播 `friend_status: offline`。好友列表在 Sidebar 打开时通过 `GET /api/friends` 获取列表，在线状态通过 WebSocket `friend_status` 消息增量更新。

### 3.4 V3C: PostgreSQL 迁移不完整（中）

V3C 文档第 7.3 节明确说明"第一版实现可保持内存存储用于 WebSocket 在线状态，仅将用户/好友信息写入 PostgreSQL。画布操作仍通过内存广播"。这意味着：

- 服务器重启后 rooms/shapes 仍然丢失（与父架构的持久化目标矛盾）
- rooms/operations/snapshots 三张表在原架构设计中已定义但未创建，V3C 也未承诺创建它们
- "后续版本逐步迁移持久化"没有时间线

**建议**: 至少创建 rooms 表并在房间创建/关闭时写入 PostgreSQL。operations 和 snapshots 的持久化可以后续补充，但 rooms 元数据的持久化是用户系统的基础（注册用户期望自己创建的房间不丢失）。

### 3.5 V3C: 缺少密码重置流程（中）

对于邮箱+密码的注册系统，密码重置是基本需求。文档将其列为"未来版本"，但建议至少在设计层面预留：

- 密码重置需要发送邮件（引入邮件服务依赖）
- 或者采用更简单的方案：安全提示问题（降低依赖但安全性弱）

**建议**: 在 users 表中预留 `password_reset_token` 和 `password_reset_expires` 字段，为后续实现做准备。V3C 文档中可加一句说明。

### 3.6 V3D: Stage getter 模式缺乏错误处理（低）

exportCanvas.ts 通过 `useCanvasStore.getState().getStage()` 获取 Stage 实例。如果 getStage 返回 null（Stage 尚未挂载或被卸载），导出会静默失败。文档未定义此场景的错误处理。

**建议**: exportCanvas 函数中检查 getStage() 返回值，为 null 时显示 Toast 错误"画布未就绪，请稍后重试"。

### 3.7 V3B: 60 种形状中存在功能重复（低）

流程图分类中的 `flow-decision`（菱形）与基本形状中的 `diamond` 功能完全相同；`flow-data-io`（平行四边形）与 `parallelogram` 相同；`flow-terminator` 可以用 `rectangle` + cornerRadius 实现。文档未明确这些是独立实现还是别名复用。

**建议**: 在形状清单中标注哪些形状是别名（共享同一渲染器和工具逻辑，仅 label/icon 不同），哪些是独立实现。别名形状可显著减少工具文件数量和维护成本。

---

## 4. 可行性评估

### 4.1 技术栈兼容性

所有四个设计均基于已确定的技术栈（React 18 + Konva.js 9.x + FastAPI + WebSocket + Zustand + Tailwind），无兼容性风险。

### 4.2 V3B: Shape Registry 架构（可行）

Registry 模式是解决 60 种形状管理问题的正确方案。消除了 switch 语句膨胀，提供了统一的形状注册、查询、分类机制。每个工具文件通过 `registerShape()` 自注册，导入即生效，无需中央配置。Konva.js 的 Group/Shape/Line/Arrow/Text/Rect/Ellipse 等组件足以覆盖全部 60 种形状的渲染需求。

**风险点**: UML 类框等复合形状使用 `<Group>` 包裹多个 Konva 子元素时，Transformer 的缩放/旋转行为需要充分测试。Konva Transformer 对 Group 的处理与单 Shape 不同（包围盒计算、锚点位置）。

### 4.3 V3C: JWT + WebSocket 鉴权（可行，需注意并发刷新）

JWT 在 WebSocket 连接 URL 参数中传递是业界常见做法。需要注意：
- 前端需要实现请求队列：当多个 API 请求同时收到 401 时，只触发一次 token 刷新，其他请求等待刷新完成后重试
- WebSocket 连接建立后 token 过期不影响已建立的连接（仅在连接时验证），这是合理的

### 4.4 V3C: Async SQLAlchemy 与 WebSocket 并发（可行）

FastAPI 的 WebSocket 端点本身是 async 的，SQLAlchemy 2.0+ 支持 async session。每个 WebSocket 连接的生命周期内需要管理独立的 DB session。使用 `async with AsyncSession()` 上下文管理器即可。

### 4.5 V3D: stage.toBlob() 可行性（可行，已验证）

Konva.js v9+ 的 `stage.toBlob()` 是成熟 API。pixelRatio=2 在 2560x1440 屏幕上生成 5120x2880 的图像，内存占用约 56MB（RGBA），在现代浏览器中完全可承受。如果担心内存，可将 pixelRatio 降为 1 或限制最大尺寸。

---

## 5. 范围蔓延评估

### 5.1 V3B: 60 种形状数量偏多（中）

从 10 种扩展到 60 种是一次性 6 倍增长。部分形状的应用场景有限（月牙/crescent、闪电/lightning、齿轮/gear 在协作白板中极少使用）。建议考虑分两批交付：第一批 35-40 种高价值形状（覆盖流程图、UML、基本标注），第二批补充剩余形状。

### 5.2 V3B: 模板系统可作为独立版本（低）

模板系统（含 TemplateRegistry、4 个模板生成器、模板 UI）是 V3B 中最复杂的部分。如果时间紧张，可以考虑将模板系统拆分为 V4 独立迭代，V3B 仅交付形状扩展和工具栏重构。但模板与形状紧密相关（模板使用形状），一起交付有协同价值。

### 5.3 V3C: 好友系统功能偏重（高）

对于一个白板协作工具，完整的好友系统（申请/接受/拒绝/屏蔽/在线状态）属于社交功能范畴，超出了"协作白板"的核心价值定位。更符合白板场景的做法是：

- **房间邀请链接**: 生成带房间 ID 的可分享链接（URL 复制即分享），比"通过邮箱添加好友"更简单直接
- **简化联系人**: 仅保留"最近协作过的用户"列表，无需正式的好友关系管理

当前设计的好友系统增加了 users/friendships 两张表、5 个 API 端点、4 个前端组件和在线状态推送机制。对于 1 人项目，这个范围偏高。

**建议**: 评估是否可将好友系统降级为"房间邀请链接分享"+"最近协作用户列表"以降低实现复杂度。如果保留完整好友系统，应将其标记为 V3C 中优先级最低的部分。

### 5.4 V3D: 三种背景模式可简化（低）

导出功能的核心价值是"保存画布为图片"。网格/白色/透明三种背景模式中，透明模式的适用场景有限（需要将白板图形叠加到其他设计稿上）。可以先交付 PNG+网格（默认）和 PNG+白色两种模式，JPG 和透明模式作为后续增强。

---

## 6. 集成依赖分析

### 6.1 实施顺序依赖

```
V3A (画布视口 + 视觉)
 ├─→ V3B (形状模板) — 需要 V3A 的视口状态和坐标转换
 ├─→ V3D (导出)     — 需要 V3A 的 Stage ref 和 GridBackground
 └─→ V3C (用户系统) — 无架构依赖，但共享 Sidebar/App 文件
```

V3C 与 V3A/V3B/V3D 在架构层面独立，但在文件层面共享 Sidebar.tsx、App.tsx、useCanvasStore.ts 等。V3C 的后端改造不影响前端绘图功能。

### 6.2 共享后端模型

V3B 的 Shape.extras 字段（可选）和 V3C 的用户表不冲突。如果两者都需要修改 Pydantic Shape 模型，需协调 PR 顺序：
- V3B 加 `extras: Optional[dict]` 和 `connectionData: Optional[dict]`
- V3C 不需要修改 Shape 模型（主要改用户相关模型）

### 6.3 共享前端 Store

三个设计都扩展了 Zustand store：

| Store | V3A | V3B | V3C | V3D |
|-------|-----|-----|-----|-----|
| `useCanvasStore` | viewport state + setViewport | batch addShape | -- | getStage + setStageGetter |
| `useToolStore` | 默认样式蓝色系 | favorites + recentlyUsed | -- | -- |
| `useUserStore` | -- | -- | 移除本地 userId，从 useAuthStore 获取 | -- |
| `useAuthStore` (新) | -- | -- | 认证状态 + token 管理 | -- |
| `useShapePanelStore` (新) | -- | 收藏/最近/展开状态 | -- | -- |

无循环依赖或状态冲突，但需注意 useUserStore 在 V3C 中去掉 userId 后，V3B 的 shape.userId 需要从 useAuthStore 获取。

---

## 7. 推荐实施优先级

综合考虑依赖关系、复杂度和用户价值，推荐以下实施顺序：

| 优先级 | 设计 | 理由 |
|--------|------|------|
| **P0** | V3A | 画布视口和视觉是所有后续工作的基础。V3B 和 V3D 都依赖 V3A。视口改造也解除了"无法绘制大型图表"的核心限制。 |
| **P1** | V3D | 改动量极小（2 新文件 + 4 处修改），纯客户端，零后端风险。在 V3A 基础上快速交付一个用户可感知的功能。 |
| **P2** | V3B Phase 1-3 | Registry 重构 + 形状扩展 + 工具栏改造。这是 V3B 的核心价值部分。模板（Phase 4）可视时间决定是否纳入本迭代。 |
| **P3** | V3C（不含好友系统） | 用户注册/登录/JWT 是最基础的身份需求。好友系统建议降级或推迟，优先交付：注册登录 + 房间号复制 + 匿名兼容。 |
| **P4** | V3B Phase 4-5 | 模板系统 + 连接器联动。在核心形状可用后再交付高级功能。 |
| **P5** | V3C 好友系统 | 好友申请/接受/在线状态。在白板核心功能稳定后再补充社交功能。 |

### 推荐的最小可行交付（MVP for V3）

如果时间极度有限，建议只做以下三项：

1. **V3A 完整** -- 无限画布 + 蓝色风格
2. **V3D 简化版** -- 仅 PNG+网格导出 + Ctrl+Shift+E 快捷键（去掉 Popover）
3. **V3C 核心** -- 注册/登录 + 房间号复制 + 游客兼容（去掉好友系统）

这三项覆盖了"画布体验升级""内容导出""用户身份"三个最核心的缺失功能。

---

## 8. 交叉关注点

### 8.1 TypeScript 类型安全

V3B 将 ShapeType 从字面量联合改为 string，是一种务实的权衡。但团队需要在代码审查中确保：
- 所有 `shape.type` 的使用点都通过 Registry（而非直接字符串比较）
- 新增形状时 `registerShape({ type: '...' })` 的 type 拼写正确（建议用 `as const` 或定义常量）

### 8.2 测试策略

当前所有设计文档都缺少测试要求。考虑到改动面广（尤其是 V3B 的 60 个工具文件和 V3C 的认证流程），建议至少覆盖：

- **V3A**: 坐标转换函数单元测试（screenToWorld/worldToScreen 往返一致性）
- **V3B**: Registry 注册/查询单元测试；5-10 个代表性形状的 points 更新正确性测试
- **V3C**: JWT 签发/验证/过期流程集成测试；注册/登录 API 端到端测试
- **V3D**: exportCanvas 函数单元测试（mock stage.toBlob）；背景模式切换逻辑测试

### 8.3 错误边界

V3B 的 Registry 查找失败（未知 shape type）应在渲染时优雅降级（画一个占位矩形 + console.warn），而不是白屏崩溃。建议在 renderShape 的 Registry.get() 返回 undefined 时渲染一个带警告图标的默认矩形。

### 8.4 性能注意事项

- **V3A**: 缩放锚点公式中的 `clamp` 应在 requestAnimationFrame 级别节流，避免滚轮事件高频触发 re-render
- **V3B**: 60 种形状的工具栏使用折叠分类，默认只渲染展开分类的 DOM 节点（~14 个按钮），性能无虞
- **V3C**: JWT 验证在 WebSocket 连接时仅执行一次，不影响运行时性能
- **V3D**: stage.toBlob() 的 pixelRatio=2 在 4K 屏幕上可能生成 ~33MP 图像，建议设置上限 4096px

### 8.5 文档版本依赖

V3B 和 V3D 均声明父设计为 V3A（`2026-05-06-v3a-canvas-visual-design.md`），V3C 声明父设计为原始架构（`2026-04-28-whiteboard-collab-design.md`）。这种依赖关系是正确的 -- V3C 的用户系统不依赖 V3A 的视口改造。

---

## 9. 审查结论

四个 V3 设计文档整体质量良好，架构合理，技术方案可行。**无阻塞性问题**，可以在解决上述一致性冲突后开始实施。

核心建议：
1. **统一 Sidebar 布局规范** -- 在开始编码前明确定义四个设计在 Sidebar 中的最终区域划分
2. **V3C 好友系统范围重新评估** -- 考虑降级为房间邀请链接 + 最近协作用户
3. **V3B 模板撤销粒度明确化** -- 选择逐 shape 撤销方案并记录批量撤销的设计预留
4. **GridBackground 可见性控制提前实现** -- 在 V3A 中加 store 字段，V3D 直接复用
5. **按推荐优先级顺序实施** -- V3A -> V3D -> V3B(Phase1-3) -> V3C(核心) -> V3B(Phase4-5) -> V3C(好友)
