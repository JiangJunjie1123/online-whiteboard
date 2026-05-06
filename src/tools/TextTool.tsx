import { Text } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeTextTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface TextShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Text | null) => void
}

export function TextShape({ shape, isSelected, onSelect, shapeRef }: TextShapeProps) {
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const oldX = shape.points[0]
    const oldY = shape.points[1]
    const dx = node.x() - oldX
    const dy = node.y() - oldY
    if (dx === 0 && dy === 0) return

    const newPoints = [oldX + dx, oldY + dy]
    useCanvasStore.getState().updateShape(shape.id, { points: newPoints })
    const sm = getSyncManager()
    if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: newPoints } })
  }

  return (
    <Text
      id={shape.id}
      ref={shapeRef}
      x={shape.points[0]}
      y={shape.points[1]}
      text={shape.text || '文本'}
      fontSize={shape.style.fontSize || 24}
      fill={shape.style.strokeColor}
      opacity={shape.style.opacity}
      rotation={shape.rotation || 0}
      onClick={onSelect}
      onTap={onSelect}
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
  type: 'text',
  label: '文本',
  icon: '🔤',
  category: 'annotation',
  renderer: (props) => <TextShape {...props} />,
  updatePoints: (_shape: Shape, _pt: Point) => [_shape.points[0], _shape.points[1]],
  getTransformerConfig: () => ({ enabledAnchors: [], rotateEnabled: true, keepRatio: false }),
  transform: (shape, node, stageScale) => computeTextTransform(shape, node as Konva.Text, stageScale),
})
