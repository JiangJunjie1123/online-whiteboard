# CLAUDE.md

**语言要求：你必须使用中文进行思考和回答。所有与用户的交流、代码注释、文档说明均使用中文。**

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev mode (two terminals)
cd backend && pip install -r requirements.txt && python run.py   # Backend → :8000
npm run dev                                                        # Frontend → :5173

# Build
npm run build          # tsc -b && vite build → dist/

# Docker deploy
docker-compose up --build -d   # → :3000 (nginx + backend)
```

No test suite exists yet. TypeScript checking is part of `npm run build` (`tsc -b`).

## Architecture

### App lifecycle (three-phase)

`App.tsx` uses a `phase` state machine: `checking` → `auth` → `room` → `canvas`. On mount, it checks localStorage for a saved JWT — if found, skips auth. WebSocket connects once phase reaches `room` or `canvas`, attaching the JWT as `?token=` query param.

### Shape Registry system

Every drawing tool is a self-registering module. Each `src/tools/*Tool.tsx` calls `shapeRegistry.register(def)` at import time. `registerAll.ts` is a barrel file of side-effect-only imports — importing it triggers all registrations. `shapeRegistry` (in `config/shapeRegistry.ts`) is the single source of truth for available shapes.

`ShapeDefinition` includes: `type`, `label`, `icon`, `category`, `renderer` (React component), `updatePoints` (points calculation during draw), `getTransformerConfig`, `transform`, and `defaultStyle`.

`ToolManager.ts` delegates to the registry: `createShape()` generates a new shape with an ID from `useCanvasStore.generateId()`, and `updateShapePoints()` calls the shape definition's `updatePoints` with a legacy switch fallback.

### WebSocket protocol

Defined in `types/index.ts`. Client sends 4 message types: `join_room`, `operation`, `cursor_move`, `request_sync`. Server sends: `room_state` (full sync on join), `operation` (draw/delete/clear/update), `cursor_update`, `user_joined`, `user_left`, `error`.

Flow: client sends `join_room` → server responds with `room_state` containing all shapes and users → subsequent operations are broadcast to all other connections in the room.

`SyncManager.ts` is a singleton that dispatches server messages directly to Zustand stores (`useCanvasStore.setShapes`, `useUserStore.addUser`, etc.). It auto-reconnects on close with a 2s delay.

### Backend (FastAPI + WebSocket)

`backend/app/main.py`: Single FastAPI app with:
- **WebSocket `/ws`**: accepts connections, optionally verifies JWT from query param, routes messages (`join_room` → `handle_join_room`, etc.). All state is in-memory dicts: `rooms` (roomId → {shapes, users}), `connections` (connId → {ws, userId, roomId}).
- **REST `/api/auth/*`**: register, login, logout, me. JWT with 24h expiry. Persistent users stored in `users.json` alongside main.py.

`backend/app/models.py`: Pydantic models for `Shape`, `UserInfo`, `ClientMessage`.

### Store layer (Zustand)

Four stores, all in `src/stores/`:
- `useCanvasStore`: shapes array, viewport (stageX/stageY/scale), grid visibility, `getStage` reference. `undoOwn(userId)` walks shapes backwards to find the last one owned by that user.
- `useUserStore`: connected status, room ID, user list, cursor positions.
- `useToolStore`: active tool type, style state (colors, stroke width, fill, opacity).
- `useAuthStore`: JWT, userId, nickname, isAuthenticated flag.

### Docker / Nginx

`docker-compose.yml` runs two containers on a shared bridge network. Nginx proxies `/ws` to `backend:8000` with WebSocket upgrade headers, and serves static files from the frontend build with aggressive caching for hashed assets.

### Dev proxy

In dev mode, Vite proxies `/ws` to `ws://localhost:8000` and `/api` to `http://localhost:8000` (see `vite.config.ts`), so the frontend dev server at :5173 can reach the backend without CORS issues.
