import { Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface HighlightShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Rect | null) => void
}

export function HighlightShape({ shape, isSelected, onSelect, shapeRef }: HighlightShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)

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
      width={width || 1}
      height={height || 1}
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor || 'transparent'}
      strokeWidth={0}
      fill={shape.style.fillColor || '#FEF08A'}
      opacity={0.5}
      cornerRadius={4}
      onClick={onSelect}
      onTap={onSelect}
      draggable
      onDragEnd={handleDragEnd}
    />
  )
}

shapeRegistry.register({
  type: 'highlight',
  label: '高亮',
  icon: '\u{1F58D}',
  category: 'annotation',
  renderer: (props) => <HighlightShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#FEF08A', strokeColor: 'transparent', opacity: 0.5 },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as Konva.Rect, stageScale),
})
