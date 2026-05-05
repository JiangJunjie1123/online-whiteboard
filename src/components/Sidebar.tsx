import { useState } from 'react'
import { useToolStore } from '../stores/useToolStore'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useUserStore } from '../stores/useUserStore'
import { getSyncManager } from '../sync/SyncManager'
import { ShapePanel } from './ShapePanel'

export function Sidebar() {
  const { style, setColor, setStrokeWidth } = useToolStore()
  const { shapes, clearCanvas } = useCanvasStore()
  const { roomId, userId, users, connected } = useUserStore()
  const [usersOpen, setUsersOpen] = useState(true)

  const ownShapeCount = shapes.filter((s) => s.userId === userId).length

  const handleUndo = () => {
    if (!userId) return
    const removedId = useCanvasStore.getState().undoOwn(userId)
    if (removedId) {
      const sm = getSyncManager()
      if (sm) sm.send({ type: 'operation', action: 'delete', shapeId: removedId })
    }
  }

  const handleClear = () => {
    clearCanvas()
    const sm = getSyncManager()
    if (sm) sm.send({ type: 'operation', action: 'clear' })
  }

  return (
    <div className="fixed left-0 top-0 h-full w-64 z-40 flex flex-col bg-white/90 backdrop-blur-sm border-r border-gray-200 shadow-lg select-none">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <span className="text-xs text-gray-500">房间</span>
          <span className="text-sm font-mono font-medium text-gray-800 truncate">
            {roomId || '—'}
          </span>
          <span className={`w-2 h-2 rounded-full ml-auto ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        </div>
      </div>

      {/* Shape panel */}
      <ShapePanel />

      {/* Style controls */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-3">
        <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">样式</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-7">颜色</span>
          <input
            type="color"
            value={style.strokeColor}
            onChange={(e) => setColor(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border border-gray-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-7">粗细</span>
          <input
            type="range"
            min={1}
            max={20}
            value={style.strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="flex-1 h-1 accent-gray-800 cursor-pointer"
          />
          <span className="text-xs text-gray-400 w-5 text-right">{style.strokeWidth}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
        <button
          onClick={handleUndo}
          disabled={ownShapeCount === 0}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ↩ 撤销
        </button>
        <button
          onClick={handleClear}
          disabled={shapes.length === 0}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          🗑 清空
        </button>
      </div>

      {/* User section */}
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <button
          onClick={() => setUsersOpen(!usersOpen)}
          className="flex items-center justify-between w-full mb-2"
        >
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            在线 ({users.length})
          </span>
          <span className="text-xs text-gray-400">{usersOpen ? '▼' : '▶'}</span>
        </button>
        {usersOpen && (
          <div className="space-y-1">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: user.color }}
                />
                <span className="text-sm text-gray-700 truncate">
                  {user.name}
                  {user.id === userId && (
                    <span className="text-xs text-gray-400 ml-1">(你)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
