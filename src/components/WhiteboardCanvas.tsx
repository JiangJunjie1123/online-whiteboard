import { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Line, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useToolStore } from '../stores/useToolStore'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useUserStore } from '../stores/useUserStore'
import { createShape, updateShapePoints, isClick } from '../tools/ToolManager'
import { computeTransformedPoints } from '../tools/transformUtils'
import { exportCanvas } from '../utils/exportCanvas'
import { GridBackground } from './GridBackground'
import { shapeRegistry } from '../config/shapeRegistry'
import '../tools/registerAll' // side-effect: triggers shapeRegistry.register() for all shapes
import { getSyncManager } from '../sync/SyncManager'
import type { Shape, Point } from '../types'

export function WhiteboardCanvas() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [drawingShape, setDrawingShape] = useState<Shape | null>(null)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textPos, setTextPos] = useState<Point>({ x: 0, y: 0 })
  const [textValue, setTextValue] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)
  const stageRef = useRef<Konva.Stage>(null)
  const cursorThrottle = useRef(0)
  const panStart = useRef({ x: 0, y: 0, stageX: 0, stageY: 0 })
  const transformerRef = useRef<Konva.Transformer>(null)
  const shapeNodesRef = useRef<Map<string, Konva.Node>>(new Map())

  const { activeTool, style } = useToolStore()
  const { shapes, addShape, removeShape, stageX, stageY, scale } = useCanvasStore()
  const { userId } = useUserStore()

  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    useCanvasStore.getState().setStageGetter(() => stageRef.current)
  }, [])

  const getPointerPos = useCallback((): Point => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const pointer = stage.getPointerPosition()
    if (!pointer) return { x: 0, y: 0 }
    const transform = stage.getAbsoluteTransform().copy().invert()
    const worldPos = transform.point({ x: pointer.x, y: pointer.y })
    return { x: worldPos.x, y: worldPos.y }
  }, [])

  const syncSend = useCallback((action: string, shape?: Shape, shapeId?: string) => {
    const sm = getSyncManager()
    if (!sm) return
    sm.send({ type: 'operation', action, shape, shapeId })
  }, [])

  const getShapeRef = useCallback((id: string) => (node: Konva.Node | null) => {
    if (node) {
      shapeNodesRef.current.set(id, node)
    } else {
      shapeNodesRef.current.delete(id)
    }
  }, [])

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return

    if (selectedId) {
      const node = shapeNodesRef.current.get(selectedId)
      if (node) {
        transformer.nodes([node])
        transformer.getLayer()?.batchDraw()
      }
    } else {
      transformer.nodes([])
      transformer.getLayer()?.batchDraw()
    }
    return () => {
      transformer.nodes([])
    }
  }, [selectedId, shapes])

  const getTransformerConfig = useCallback((shape: Shape) => {
    const def = shapeRegistry.get(shape.type)
    return def?.getTransformerConfig?.(shape) ?? {
      enabledAnchors: [
        'top-left', 'top-center', 'top-right',
        'middle-left', 'middle-right',
        'bottom-left', 'bottom-center', 'bottom-right',
      ],
      rotateEnabled: true,
      keepRatio: false,
    }
  }, [])

  const handleTransformEnd = useCallback(() => {
    const transformer = transformerRef.current
    if (!transformer || !selectedId) return

    const node = shapeNodesRef.current.get(selectedId)
    if (!node) return

    const shape = shapes.find((s) => s.id === selectedId)
    if (!shape) return

    const result = computeTransformedPoints(shape, node, scale)

    node.x(0)
    node.y(0)
    node.scaleX(1)
    node.scaleY(1)
    node.rotation(0)

    const updated: Partial<Shape> = {
      points: result.points,
      rotation: result.rotation,
    }
    if (result.fontSize !== undefined) {
      updated.style = { ...shape.style, fontSize: result.fontSize }
    }

    useCanvasStore.getState().updateShape(selectedId, updated)

    const fullShape = { ...shape, ...updated, style: updated.style ?? shape.style }
    syncSend('update', fullShape)

    transformer.getLayer()?.batchDraw()
  }, [selectedId, shapes, syncSend])

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Prevent browser back/forward navigation on mouse buttons 3/4
    e.evt.preventDefault()
    e.evt.stopPropagation()

    // Middle mouse button — start panning
    if (e.evt.button === 1) {
      setPanning(true)
      panStart.current = { x: e.evt.clientX, y: e.evt.clientY, stageX, stageY }
      return
    }

    // Click on empty canvas area
    if (e.target === e.target.getStage()) {
      setSelectedId(null)
      const pos = getPointerPos()

      if (activeTool === 'text') {
        setTextPos(pos)
        setTextValue('')
        setShowTextInput(true)
        return
      }

      const shape = createShape(activeTool, pos, style, userId || undefined)
      setDrawingShape(shape)
      return
    }

    // Click on a shape — selection is handled by the shape's onClick
  }, [activeTool, style, getPointerPos, userId, stageX, stageY])

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Middle-button panning
    if (panning) {
      const dx = e.evt.clientX - panStart.current.x
      const dy = e.evt.clientY - panStart.current.y
      useCanvasStore.getState().setViewport(panStart.current.stageX + dx, panStart.current.stageY + dy, scale)
      return
    }

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
  }, [panning, drawingShape, getPointerPos, scale])

  const handleMouseUp = useCallback(() => {
    if (panning) {
      setPanning(false)
      return
    }
    if (!drawingShape) return
    if (!isClick(drawingShape.points, scale)) {
      addShape(drawingShape)
      syncSend('draw', drawingShape)
      // Auto-expand: if shape touches viewport edge, pan slightly to give more room
      const margin = 100
      const vs = useCanvasStore.getState()
      const [x1, y1, x2, y2] = drawingShape.points
      const worldRight = Math.max(x1, x2) * vs.scale + vs.stageX
      const worldBottom = Math.max(y1, y2) * vs.scale + vs.stageY
      const worldLeft = Math.min(x1, x2) * vs.scale + vs.stageX
      const worldTop = Math.min(y1, y2) * vs.scale + vs.stageY
      const viewW = window.innerWidth
      const viewH = window.innerHeight
      let { stageX: nx, stageY: ny } = vs
      if (worldRight > viewW - margin) nx -= (worldRight - viewW + margin)
      if (worldBottom > viewH - margin) ny -= (worldBottom - viewH + margin)
      if (worldLeft < margin) nx += (margin - worldLeft)
      if (worldTop < margin) ny += (margin - worldTop)
      if (nx !== vs.stageX || ny !== vs.stageY) {
        useCanvasStore.getState().setViewport(nx, ny, vs.scale)
      }
    }
    setDrawingShape(null)
  }, [panning, drawingShape, addShape, syncSend, scale])

  const handleTextConfirm = useCallback(() => {
    if (textValue.trim()) {
      const shape: Shape = {
        id: `shape_${Date.now()}`,
        type: 'text',
        points: [textPos.x, textPos.y],
        style: { ...style },
        text: textValue,
        userId: userId || undefined,
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
    const def = shapeRegistry.get(shape.type)
    if (def) {
      const Comp = def.renderer
      return (
        <Comp
          key={shape.id}
          shape={shape}
          isSelected={shape.id === selectedId}
          onSelect={() => handleSelectShape(shape.id)}
          shapeRef={getShapeRef(shape.id)}
        />
      )
    }
    // Fallback: render a red-tinted placeholder for unknown shape types
    console.warn(`[WhiteboardCanvas] No renderer registered for shape type: "${shape.type}"`)
    const [x1, y1, x2, y2] = shape.points
    const fx = Math.min(x1 ?? 0, x2 ?? 0)
    const fy = Math.min(y1 ?? 0, y2 ?? 0)
    const fw = Math.abs((x2 ?? 0) - (x1 ?? 0)) || 20
    const fh = Math.abs((y2 ?? 0) - (y1 ?? 0)) || 20
    return (
      <Rect
        key={shape.id}
        x={fx}
        y={fy}
        width={fw}
        height={fh}
        fill="rgba(255,0,0,0.25)"
        stroke="red"
        strokeWidth={1}
      />
    )
  }

  const renderDrawingPreview = () => {
    if (!drawingShape) return null
    const def = shapeRegistry.get(drawingShape.type)
    if (def) {
      const Comp = def.renderer
      return <Comp shape={drawingShape} />
    }
    // Fallback: draw a simple line for unknown types
    if (drawingShape.points.length >= 4) {
      return (
        <Line
          points={drawingShape.points}
          stroke={drawingShape.style.strokeColor}
          strokeWidth={drawingShape.style.strokeWidth}
          opacity={drawingShape.style.opacity}
        />
      )
    }
    return null
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
        const uid = useUserStore.getState().userId
        if (uid) {
          const removedId = useCanvasStore.getState().undoOwn(uid)
          if (removedId) {
            syncSend('delete', undefined, removedId)
          }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        exportCanvas()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedId, shapes, userId, removeShape, syncSend])

  // Drag-and-drop from toolbar: create shape at drop position
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const shapeType = e.dataTransfer.getData('application/x-shape-type')
    if (!shapeType) return

    const rect = e.currentTarget.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    // Convert screen position to world coordinates
    const worldX = (screenX - stageX) / scale
    const worldY = (screenY - stageY) / scale

    const shape = createShape(shapeType, { x: worldX, y: worldY }, style, userId || undefined)
    // Set default size for the shape
    const defaultW = 80
    const defaultH = 60
    switch (shapeType) {
      case 'brush':
        shape.points = [worldX, worldY, worldX + 10, worldY + 10]
        break
      case 'line':
      case 'arrow':
      case 'double-arrow':
      case 'dashed-line':
      case 'curved-arrow':
        shape.points = [worldX, worldY, worldX + defaultW, worldY]
        break
      case 'text':
        shape.points = [worldX, worldY]
        shape.text = '文本'
        break
      default:
        shape.points = [worldX, worldY, worldX + defaultW, worldY + defaultH]
    }

    addShape(shape)
    syncSend('draw', shape)
  }, [stageX, stageY, scale, style, userId, addShape, syncSend])

  return (
    <div
      className="w-full h-full relative"
      style={{ touchAction: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={stageX}
        y={stageY}
        scaleX={scale}
        scaleY={scale}
        onWheel={(e) => {
          e.evt.preventDefault()
          const stage = stageRef.current
          if (!stage) return
          const oldScale = scale
          const pointer = stage.getPointerPosition()
          if (!pointer) return
          const direction = e.evt.deltaY > 0 ? -1 : 1
          const factor = 1.05
          const newScale = Math.min(Math.max(oldScale * (direction > 0 ? factor : 1 / factor), 0.1), 5)
          const mousePointTo = {
            x: (pointer.x - stageX) / oldScale,
            y: (pointer.y - stageY) / oldScale,
          }
          const newX = pointer.x - mousePointTo.x * newScale
          const newY = pointer.y - mousePointTo.y * newScale
          useCanvasStore.getState().setViewport(newX, newY, newScale)
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setPanning(false); setDrawingShape(null) }}
        style={{ cursor: panning ? 'grabbing' : activeTool === 'text' ? 'text' : 'crosshair' }}
      >
        <GridBackground />
        <Layer>
          {shapes.map(renderShape)}
          {renderDrawingPreview()}
          {selectedId && (() => {
            const selectedShape = shapes.find((s) => s.id === selectedId)
            if (!selectedShape) return null
            return (
              <Transformer
                ref={transformerRef}
                {...getTransformerConfig(selectedShape)}
              onTransformEnd={handleTransformEnd}
              boundBoxFunc={(oldBox, newBox) => {
                const s = scale || 1
                const minSize = 5 / s
                if (newBox.width < minSize || newBox.height < minSize) {
                  return oldBox
                }
                return newBox
              }}
              />
          )})()}
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
        形状: {shapes.length} · {Math.round(scale * 100)}% · 右键拖拽平移 · Ctrl+Z 撤销 · Delete 删除
      </div>
    </div>
  )
}
