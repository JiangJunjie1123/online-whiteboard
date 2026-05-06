import { Group, Rect, Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface LifelineShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function LifelineShape({ shape, isSelected, onSelect, shapeRef }: LifelineShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 26
  const h = Math.abs(y2 - y1) || 120
  const boxH = Math.min(h * 0.18, 30)
  const cx = w / 2

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
    <Group
      id={shape.id}
      ref={shapeRef as any}
      x={x}
      y={y}
      rotation={shape.rotation || 0}
      onClick={onSelect}
      onTap={onSelect}
      draggable
      onDragEnd={handleDragEnd}
    >
      {/* Box head */}
      <Rect
        x={0}
        y={0}
        width={w}
        height={boxH}
        fill={shape.style.fillColor || '#FAFAFA'}
        stroke={shape.style.strokeColor || '#1f2937'}
        strokeWidth={shape.style.strokeWidth}
        listening={false}
      />
      {/* Dashed vertical lifeline */}
      <Line
        points={[cx, boxH, cx, h]}
        stroke={shape.style.strokeColor || '#1f2937'}
        strokeWidth={shape.style.strokeWidth}
        dash={[8, 5]}
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'lifeline',
  label: '生命线',
  icon: '\u{1F4CF}',
  category: 'uml',
  renderer: (props) => <LifelineShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#FAFAFA', strokeColor: '#1f2937' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
