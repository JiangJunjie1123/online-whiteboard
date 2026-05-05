import { useToolStore } from '../stores/useToolStore'
import { TOOLS } from '../config/tools'
import type { ToolType } from '../types'

export function ShapePanel() {
  const { activeTool, setTool } = useToolStore()

  return (
    <div className="px-3 py-3 border-b border-gray-100">
      <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
        工具
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.type
          return (
            <button
              key={tool.type}
              onClick={() => setTool(tool.type as ToolType)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer border transition-all duration-150
                ${isActive
                  ? 'bg-gray-800 text-white shadow-md border-gray-800'
                  : 'bg-white hover:bg-gray-50 border-gray-100 text-gray-600'
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
