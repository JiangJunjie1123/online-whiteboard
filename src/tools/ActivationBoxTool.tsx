import { Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface ActivationBoxShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Rect | null) => void
}

export function ActivationBoxShape({ shape, isSelected, onSelect, shapeRef }: ActivationBoxShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 14
  const h = Math.abs(y2 - y1) || 60

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const oldX = Math.min(x1, x2)
    const oldY = Math.min(y1, y2)
    const dx = node.x() - oldX
    const dy = node.y() - oldY
    if (dx === 0 && dy === 0) return

    const newPoints = [x1 + dx, y1 + dy, x2 + dx, y2 + dy]
    useCanvasStore.getState().updateShape(shape.id, { points: newPoints })
    const sm = getSyncManager()
    if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: newPoints } })
  }

  return (
    <Rect
      id={shape.id}
      ref={shapeRef}
      x={x}
      y={y}
      width={w || 1}
      height={h || 1}
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor || '#1f2937'}
      strokeWidth={shape.style.strokeWidth || 2}
      fill={shape.style.fillColor || '#E5E7EB'}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
      draggable
      onDragEnd={handleDragEnd}
    />
  )
}

shapeRegistry.register({
  type: 'activation-box',
  label: '激活框',
  icon: '⏺',
  category: 'uml',
  renderer: (props) => <ActivationBoxShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#E5E7EB', strokeColor: '#1f2937' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as Konva.Rect, stageScale),
})
