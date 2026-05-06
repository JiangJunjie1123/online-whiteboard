import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeBrushTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface BrushShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function BrushShape({ shape, isSelected, onSelect, shapeRef }: BrushShapeProps) {
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const dx = node.x()
    const dy = node.y()
    if (dx === 0 && dy === 0) return
    node.x(0)
    node.y(0)

    const newPoints = [...shape.points]
    for (let i = 0; i < newPoints.length; i += 2) {
      newPoints[i] += dx
      newPoints[i + 1] += dy
    }
    useCanvasStore.getState().updateShape(shape.id, { points: newPoints })
    const sm = getSyncManager()
    if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: newPoints } })
  }

  return (
    <Line
      id={shape.id}
      ref={shapeRef}
      points={shape.points}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      opacity={shape.style.opacity}
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      globalCompositeOperation="source-over"
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={shape.style.strokeWidth + 10}
      draggable
      onDragEnd={handleDragEnd}
      onDblClick={() => {
        const textTypes = ["text","connector-label","flow-terminator","note-sticky","class-box","or-circle","callout"]
        if (shape.text !== undefined || textTypes.includes(shape.type)) {
          ;(window as any).__editShapeText?.(shape.id, shape.text || "")
        }
      }}
    />
  )
}

shapeRegistry.register({
  type: 'brush',
  label: '画笔',
  icon: '✏️',
  category: 'basic',
  renderer: (props) => <BrushShape {...props} />,
  updatePoints: (shape: Shape, pt: Point) => [...shape.points, pt.x, pt.y],
  getTransformerConfig: () => ({ enabledAnchors: [], rotateEnabled: false, keepRatio: false }),
  transform: (shape, node, stageScale) => computeBrushTransform(shape, node as Konva.Line, stageScale),
})
