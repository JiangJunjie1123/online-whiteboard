# online-whiteboard

基于浏览器的实时协作白板系统，支持多人同时在线绘制、实时同步。

## 功能

- **10 种绘图工具**：画笔、矩形、圆形、箭头、文本、直线、三角形、菱形、五边形、星形
- **Transform**：选中后拖拽移动/缩放/旋转
- **实时协作**：WebSocket 同步，远程光标显示，在线用户列表
- **撤销**：Ctrl+Z 按用户所有权撤销
- **删除**：选中后 Delete/Backspace 删除
- **清空画布**

## 快速开始

### 开发模式

```bash
# 终端1 — 后端
cd backend
pip install -r requirements.txt
python run.py          # → http://localhost:8000

# 终端2 — 前端
npm install
npm run dev            # → http://localhost:5173
```

### 局域网联机

```bash
# 后端同上
# 前端加 --host 绑定所有网络接口
npm run dev -- --host 0.0.0.0

# 查看本机 IP（Windows: ipconfig）
# 其他设备访问 http://你的IP:5173
```

### Docker 部署（需 Docker Desktop）

```bash
docker-compose up --build -d   # → http://localhost:3000
# 局域网设备访问 http://你的IP:3000
```

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18, TypeScript, Konva.js, Zustand, Tailwind CSS, Vite |
| 后端 | Python 3.12+, FastAPI, WebSocket |
| 存储 | 内存（MVP 阶段） |
| 部署 | Docker, Nginx |

## 项目结构

```
whiteboard/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── run.py                   # 开发模式启动
│   └── app/
│       ├── main.py              # FastAPI + WebSocket 服务
│       └── models.py            # Pydantic 模型
├── src/
│   ├── config/tools.ts          # 工具注册中心
│   ├── components/              # Sidebar, WhiteboardCanvas, RoomModal…
│   ├── tools/                   # 10 种绘图工具渲染器 + ToolManager
│   ├── stores/                  # Zustand 状态管理
│   ├── sync/                    # WebSocket 同步客户端
│   └── types/                   # TypeScript 类型定义
├── Dockerfile                   # 前端多阶段构建
├── docker-compose.yml           # 双容器编排
├── nginx.conf                   # SPA + WebSocket 代理
└── docs/superpowers/            # 设计文档 + 实现计划
```

## 版本标签

| 标签 | 说明 |
|------|------|
| `mvp-v1.0` | MVP 版本（5 工具 + 房间 + 同步） |
| `v2.0` | 当前版本（10 工具 + Transform + 侧边栏 + Docker） |

## License

MIT
