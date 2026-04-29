# 开发过程中的 Prompt 汇总

> 全栈协作白板 (online-whiteboard) 开发对话记录

---

## 1. 项目初始化

### 1.1 创建项目框架

```
创建一个全栈协作白板应用，技术栈：
- 前端: React 18 + TypeScript + Vite + TailwindCSS + Konva.js
- 后端: FastAPI + WebSocket
- 状态管理: Zustand
```

### 1.2 设计文档生成

```
为白板协作项目生成详细的设计方案文档，包含：
- 系统架构图
- 技术栈选型
- 核心模块设计
- WebSocket 通信协议
- 数据持久化策略
- 开发阶段规划
```

### 1.3 MVP 功能实现

```
实现 MVP 版本的核心功能：
- 绘图工具: brush, rectangle, circle, arrow, text
- WebSocket 实时协作（广播式同步）
- 房间系统（创建/加入房间）
- 远程光标显示
- 撤销功能
```

---

## 2. 撤销功能重构（undoOwn）

### 2.1 问题发现

```
当前撤销功能使用全局 history 栈，所有用户共享。
A 用户撤销会删除 B 用户刚画的图形，造成协作冲突。
```

### 2.2 实现方案

```
将撤销从全局历史栈改为基于用户所有权的 undoOwn(userId):
1. 移除 useCanvasStore 中的 history/redoStack
2. 新增 undoOwn(userId) 方法 —— 从 shapes 数组倒序遍历，
   找到最后一个属于该 userId 的图形并删除
3. 同步层通过 shapeId 通知服务器删除
4. Toolbar 按钮和 Ctrl+Z 都使用新的 undoOwn 逻辑
```

### 2.3 权限检查增强

```
Delete 键删除选中图形时检查所有权：
- 只有图形创建者（userId 匹配）才能删除
- 无 userId 的图形（兼容旧数据）任何人可删除
```

---

## 3. 关键文件修改记录

| Prompt 主题 | 涉及文件 | 提交 |
|------------|---------|------|
| MVP 版本 | 全部文件 | `6a516cb` |
| undoOwn 重构 | `useCanvasStore.ts`, `Toolbar.tsx`, `WhiteboardCanvas.tsx`, `ToolManager.ts` | `3102a90` |
| 截图与文档 | `测试截图/mvp/`, `docs/` | `d21fd18` |

---

## 4. 常用开发命令

```bash
# 启动前端
npm run dev

# 启动后端
cd backend && python run.py

# TypeScript 类型检查
npx tsc --noEmit
```
