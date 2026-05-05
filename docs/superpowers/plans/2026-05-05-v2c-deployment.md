# Phase 2C: 多机器部署 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 通过 Docker Compose + nginx 实现多机器联机协作，一键启动。

**Architecture:** 双容器 — nginx (alpine) 提供 SPA 静态文件 + /ws WebSocket 代理，FastAPI+uvicorn (python:3.12-slim) 纯内存后端。只有 nginx 的 3000 端口暴露给宿主机/局域网。

**Tech Stack:** Docker, Docker Compose, nginx (alpine), Python 3.12-slim — 仅基础设施，零代码改动。

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `Dockerfile` (项目根) | Create | 前端多阶段构建（Node.js 构建 → nginx 运行） |
| `backend/Dockerfile` | Create | 后端容器（Python + uvicorn） |
| `nginx.conf` | Create | nginx SPA 静态文件 + /ws WebSocket 代理 |
| `docker-compose.yml` | Create | 服务编排、网络隔离、健康检查 |
| `.dockerignore` | Create | 排除 node_modules、.git 等 |
| `backend/.dockerignore` | Create | 排除 __pycache__、.venv 等 |

---

### Task 1: Create backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1: Write backend/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Note: Uses CMD to override `reload=True` in run.py. No code changes to run.py needed.

- [ ] **Step 2: Write backend/.dockerignore**

```
__pycache__
*.pyc
.venv
venv
.git
*.md
```

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat: add backend Dockerfile (python:3.12-slim + uvicorn)"
```

---

### Task 2: Create frontend + nginx Dockerfile

**Files:**
- Create: `Dockerfile` (project root)

- [ ] **Step 1: Write Dockerfile (multi-stage)**

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "feat: add frontend multi-stage Dockerfile (vite build + nginx)"
```

---

### Task 3: Create nginx configuration

**Files:**
- Create: `nginx.conf`

- [ ] **Step 1: Write nginx.conf**

```nginx
server {
    listen 3000;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # WebSocket proxy — must come before location /
    location /ws {
        proxy_pass http://backend:8000;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # SPA static files
    location / {
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    client_max_body_size 10m;
    server_tokens off;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
}
```

- [ ] **Step 2: Commit**

```bash
git add nginx.conf
git commit -m "feat: add nginx config for SPA + /ws WebSocket proxy"
```

---

### Task 4: Create docker-compose.yml and .dockerignore

**Files:**
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Write docker-compose.yml**

```yaml
version: "3.8"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: whiteboard-backend
    restart: unless-stopped
    networks:
      - whiteboard-net
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: whiteboard-frontend
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - whiteboard-net

networks:
  whiteboard-net:
    driver: bridge
```

- [ ] **Step 2: Write .dockerignore**

```
node_modules
dist
.git
.gitignore
*.md
.env
.env.*
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .dockerignore
git commit -m "feat: add docker-compose with backend+frontend+network isolation"
```

---

### Task 5: End-to-end deployment verification

- [ ] **Step 1: Build and start**

```bash
docker-compose up --build -d
```

Expected: Both containers start, no errors in `docker-compose ps`.

- [ ] **Step 2: Test local access**

Open `http://localhost:3000` in browser.
Expected: Whiteboard page loads. Create room, draw shapes — all functional.

- [ ] **Step 3: Test WebSocket**

Open two browser tabs to `http://localhost:3000`, join same room.
Expected: Shapes sync between tabs in real-time.

- [ ] **Step 4: Test LAN access**

Find host IP: `ipconfig` (Windows) or `ifconfig` (Linux/Mac).
From another device on same network, open `http://<HOST_IP>:3000`.
Expected: Whiteboard loads and collaboration works.

- [ ] **Step 5: Stop and cleanup**

```bash
docker-compose down
```

- [ ] **Step 6: Commit if any fixes**

```bash
git add -A && git commit -m "chore: Phase 2C deployment verification complete"
```
