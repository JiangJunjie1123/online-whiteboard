import { useToolStore } from '../stores/useToolStore'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useUserStore } from '../stores/useUserStore'
import { getSyncManager } from '../sync/SyncManager'
import type { ToolType } from '../types'

const tools: { type: ToolType; label: string; icon: string }[] = [
  { type: 'brush', label: '画笔', icon: '✏️' },
  { type: 'rectangle', label: '矩形', icon: '⬜' },
  { type: 'circle', label: '圆形', icon: '⭕' },
  { type: 'arrow', label: '箭头', icon: '➡️' },
  { type: 'text', label: '文本', icon: '🔤' },
  { type: 'line', label: '直线', icon: '📏' },
  { type: 'triangle', label: '三角', icon: '🔺' },
  { type: 'diamond', label: '菱形', icon: '🔷' },
  { type: 'pentagon', label: '五边', icon: '⬠' },
  { type: 'star', label: '星形', icon: '⭐' },
]

export function Toolbar() {
  const { activeTool, style, setTool, setColor, setStrokeWidth } = useToolStore()
  const { shapes, clearCanvas } = useCanvasStore()
  const { roomId, userId } = useUserStore()

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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 px-4 py-2.5 select-none">
      {/* Room badge */}
      {roomId && (
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
          <span className="text-xs text-gray-500">房间</span>
          <span className="text-xs font-mono text-gray-700">{roomId}</span>
        </div>
      )}

      {roomId && <div className="w-px h-6 bg-gray-200 mx-1" />}

      {/* Tools */}
      <div className="flex items-center gap-1">
        {tools.map((t) => (
          <button
            key={t.type}
            onClick={() => setTool(t.type)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${activeTool === t.type
                ? 'bg-gray-800 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Color */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">颜色</label>
        <input
          type="color"
          value={style.strokeColor}
          onChange={(e) => setColor(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-gray-300"
        />
      </div>

      {/* Stroke Width */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">粗细</label>
        <input
          type="range"
          min={1}
          max={20}
          value={style.strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-16 h-1 accent-gray-800 cursor-pointer"
        />
        <span className="text-xs text-gray-400 w-4">{style.strokeWidth}</span>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Actions */}
      <button
        onClick={handleUndo}
        disabled={ownShapeCount === 0}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ↩ 撤销
      </button>
      <button
        onClick={handleClear}
        disabled={shapes.length === 0}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        🗑 清空
      </button>
    </div>
  )
}
