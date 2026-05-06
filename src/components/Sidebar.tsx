import { useState } from 'react'
import { useToolStore } from '../stores/useToolStore'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useUserStore } from '../stores/useUserStore'
import { getSyncManager } from '../sync/SyncManager'
import { ShapePanel } from './ShapePanel'
import { ExportPopover } from './ExportPopover'

export function Sidebar() {
  const { style, setColor, setStrokeWidth } = useToolStore()
  const { shapes, clearCanvas } = useCanvasStore()
  const { roomId, userId, users, connected } = useUserStore()
  const [usersOpen, setUsersOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const handleCopyInviteLink = async () => {
    if (!roomId) return
    const link = `${window.location.origin}?room=${roomId}`
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = link
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-primary-light/50 rounded-lg">
          <span className="text-xs text-primary/70">房间</span>
          <span className="text-sm font-mono font-medium text-primary font-semibold truncate">
            {roomId || '—'}
          </span>
          {roomId && (
            <button
              onClick={handleCopyInviteLink}
              className="flex-shrink-0 p-1 rounded hover:bg-primary-light/30 transition-colors text-primary/50 hover:text-primary/80"
              title="复制邀请链接"
            >
              {copied ? (
                <span className="text-xs text-green-500 whitespace-nowrap">已复制!</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
          <span className={`w-2 h-2 rounded-full ml-auto ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        </div>
      </div>

      {/* Scrollable tools + style area */}
      <div className="flex-1 overflow-y-auto">
        <ShapePanel />

        <div className="px-4 py-3 border-b border-gray-100 space-y-3">
          <h3 className="text-[10px] font-medium text-primary/50 uppercase tracking-wider">样式</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 w-7">颜色</span>
            {['#1A73E8', '#E53935', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1', '#212121', '#757575'].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${style.strokeColor === c ? 'border-gray-800 scale-110 ring-2 ring-offset-1 ring-gray-400' : 'border-gray-300'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <input
              type="color"
              value={style.strokeColor}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-gray-300"
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
              className="flex-1 h-1 accent-primary cursor-pointer"
            />
            <span className="text-xs text-primary/50 w-5 text-right">{style.strokeWidth}</span>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
          <button
            onClick={handleUndo}
            disabled={ownShapeCount === 0}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-primary/70 hover:bg-primary-light/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

        <div className="px-4 py-3 border-b border-gray-100">
          <ExportPopover />
        </div>
      </div>

      {/* User section — always visible at bottom */}
      <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 max-h-[35%] flex flex-col">
        <button
          onClick={() => setUsersOpen(!usersOpen)}
          className="flex items-center justify-between w-full mb-2 flex-shrink-0"
        >
          <span className="text-xs font-medium text-primary/50 uppercase tracking-wider">
            在线 ({users.length})
          </span>
          <span className="text-xs text-primary/50">{usersOpen ? '▼' : '▶'}</span>
        </button>
        {usersOpen && (
          <div className="space-y-1 overflow-y-auto flex-1">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary-light/20">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: user.color }}
                />
                <span className="text-sm text-primary truncate">
                  {user.name}
                  {user.id === userId && (
                    <span className="text-xs text-primary/50 ml-1">(你)</span>
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
