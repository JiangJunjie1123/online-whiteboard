import { useToolStore } from '../stores/useToolStore'
import { getTools } from '../config/tools'
import type { ToolType } from '../types'

export function ShapePanel() {
  const { activeTool, setTool } = useToolStore()
  const tools = getTools()

  return (
    <div className="px-3 py-3 border-b border-gray-100">
      <h3 className="text-[10px] font-medium text-primary/50 uppercase tracking-wider mb-2 px-1">
        工具（拖拽到画布 | 点击选中后绘制）
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {tools.map((tool) => {
          const isActive = activeTool === tool.type
          return (
            <button
              key={tool.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-shape-type', tool.type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => setTool(tool.type as ToolType)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-grab border transition-all duration-150 active:cursor-grabbing
                ${isActive
                  ? 'bg-primary text-white shadow-md border-primary'
                  : 'bg-surface hover:bg-primary-light/30 border-gray-100 text-primary/70'
                }`}
            >
              <span className="text-lg">{tool.icon}</span>
              <span className="text-xs font-medium">{tool.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
