import { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Line } from 'react-konva'
import type Konva from 'konva'
import { useToolStore } from '../stores/useToolStore'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useUserStore } from '../stores/useUserStore'
import { createShape, updateShapePoints, isClick } from '../tools/ToolManager'
import { BrushShape } from '../tools/BrushTool'
import { RectangleShape } from '../tools/RectangleTool'
import { CircleShape } from '../tools/CircleTool'
import { ArrowShape } from '../tools/ArrowTool'
import { TextShape } from '../tools/TextTool'
import { getSyncManager } from '../sync/SyncManager'
import type { Shape, Point } from '../types'

export function WhiteboardCanvas() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [drawingShape, setDrawingShape] = useState<Shape | null>(null)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textPos, setTextPos] = useState<Point>({ x: 0, y: 0 })
  const [textValue, setTextValue] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const cursorThrottle = useRef(0)

  const { activeTool, style } = useToolStore()
  const { shapes, addShape, removeShape } = useCanvasStore()
  const { userId } = useUserStore()

  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const getPointerPos = useCallback((): Point => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const pos = stage.getPointerPosition()
    return pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 }
  }, [])

  const syncSend = useCallback((action: string, shape?: Shape, shapeId?: string) => {
    const sm = getSyncManager()
    if (!sm) return
    sm.send({ type: 'operation', action, shape, shapeId })
  }, [])

  const handleMouseDown = useCallback(() => {
    const pos = getPointerPos()

    if (activeTool === 'text') {
      setTextPos(pos)
      setTextValue('')
      setShowTextInput(true)
      return
    }

    const shape = createShape(activeTool, pos, style)
    setDrawingShape(shape)
  }, [activeTool, style, getPointerPos])

  const handleMouseMove = useCallback(() => {
    // Update drawing preview
    if (drawingShape) {
      const pos = getPointerPos()
      const points = updateShapePoints(drawingShape, pos)
      setDrawingShape({ ...drawingShape, points })
    }

    // Send cursor position (throttled to ~30fps)
    const now = Date.now()
    if (now - cursorThrottle.current > 33) {
      cursorThrottle.current = now
      const pos = getPointerPos()
      const sm = getSyncManager()
      if (sm) {
        sm.send({ type: 'cursor_move', position: pos })
      }
    }
  }, [drawingShape, getPointerPos])

  const handleMouseUp = useCallback(() => {
    if (!drawingShape) return
    if (!isClick(drawingShape.points)) {
      addShape(drawingShape)
      syncSend('draw', drawingShape)
    }
    setDrawingShape(null)
  }, [drawingShape, addShape, syncSend])

  const handleTextConfirm = useCallback(() => {
    if (textValue.trim()) {
      const shape: Shape = {
        id: `shape_${Date.now()}`,
        type: 'text',
        points: [textPos.x, textPos.y],
        style: { ...style },
        text: textValue,
      }
      addShape(shape)
      syncSend('draw', shape)
    }
    setShowTextInput(false)
    setTextValue('')
  }, [textValue, textPos, style, addShape, syncSend])

  const handleSelectShape = useCallback((shapeId: string) => {
    setSelectedId(shapeId === selectedId ? null : shapeId)
  }, [selectedId])

  const renderShape = (shape: Shape) => {
    const props = {
      shape,
      isSelected: shape.id === selectedId,
      onSelect: () => handleSelectShape(shape.id),
    }
    switch (shape.type) {
      case 'brush': return <BrushShape key={shape.id} {...props} />
      case 'rectangle': return <RectangleShape key={shape.id} {...props} />
      case 'circle': return <CircleShape key={shape.id} {...props} />
      case 'arrow': return <ArrowShape key={shape.id} {...props} />
      case 'text': return <TextShape key={shape.id} {...props} />
      default: return null
    }
  }

  const renderDrawingPreview = () => {
    if (!drawingShape) return null
    switch (drawingShape.type) {
      case 'brush':
        return (
          <Line
            points={drawingShape.points}
            stroke={drawingShape.style.strokeColor}
            strokeWidth={drawingShape.style.strokeWidth}
            opacity={drawingShape.style.opacity}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
          />
        )
      case 'rectangle':
      case 'circle':
      case 'arrow': {
        const ShapeComp = drawingShape.type === 'rectangle' ? RectangleShape
          : drawingShape.type === 'circle' ? CircleShape : ArrowShape
        return <ShapeComp shape={drawingShape} />
      }
      default:
        return null
    }
  }

  // Keyboard: delete selected, Ctrl+Z undo
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const shape = shapes.find((s) => s.id === selectedId)
        if (shape) {
          // Only allow deleting own shapes or if no userId set
          if (!shape.userId || shape.userId === userId) {
            removeShape(selectedId)
            syncSend('delete', undefined, selectedId)
          }
        }
        setSelectedId(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        useCanvasStore.getState().undo()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedId, shapes, userId, removeShape, syncSend])

  return (
    <div className="w-full h-full relative">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
      >
        <Layer>
          {shapes.map(renderShape)}
          {renderDrawingPreview()}
        </Layer>
      </Stage>

      {/* Text Input */}
      {showTextInput && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={() => setShowTextInput(false)}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gray-700 mb-3">输入文本</h3>
            <input
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTextConfirm()
                if (e.key === 'Escape') setShowTextInput(false)
              }}
              placeholder="在此输入文字..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500 mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTextInput(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleTextConfirm} className="px-3 py-1.5 text-sm text-white bg-gray-800 hover:bg-gray-700 rounded-lg">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 text-xs text-gray-400 bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full">
        形状: {shapes.length} · Ctrl+Z 撤销 · Delete 删除
      </div>
    </div>
  )
}
