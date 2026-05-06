import { Group, Rect, Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface CalloutShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function CalloutShape({ shape, isSelected, onSelect, shapeRef }: CalloutShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 120
  const h = Math.abs(y2 - y1) || 60
  const pointerW = Math.min(w * 0.2, 20)
  const pointerH = Math.min(h * 0.25, 16)
  // Pointer at bottom-left
  const px = pointerW
  const py = h

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
      {/* Rounded body rect */}
      <Rect
        width={w}
        height={h}
        fill={shape.style.fillColor || '#FFF9C4'}
        stroke={shape.style.strokeColor || '#E6C300'}
        strokeWidth={shape.style.strokeWidth || 2}
        cornerRadius={8}
        listening={false}
      />
      {/* Pointer triangle */}
      <Line
        points={[px - pointerW / 2, py, px + pointerW / 2, py, px, py + pointerH]}
        closed
        fill={shape.style.fillColor || '#FFF9C4'}
        stroke={shape.style.strokeColor || '#E6C300'}
        strokeWidth={shape.style.strokeWidth || 2}
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'callout',
  label: '标注框',
  icon: '\u{1F4AC}',
  category: 'annotation',
  renderer: (props) => <CalloutShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#FFF9C4', strokeColor: '#E6C300', strokeWidth: 2 },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
