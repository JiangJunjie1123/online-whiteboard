import { Group, Ellipse, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface DatabaseShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function DatabaseShape({ shape, isSelected, onSelect, shapeRef }: DatabaseShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 80
  const h = Math.abs(y2 - y1) || 60
  const topH = h * 0.22
  const bodyH = h - 2 * topH

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
      {/* Body rectangle */}
      <Rect
        x={0}
        y={topH}
        width={w}
        height={bodyH}
        fill={shape.style.fillColor || '#F0F4FF'}
        stroke={shape.style.strokeColor || '#2980B9'}
        strokeWidth={shape.style.strokeWidth}
        listening={false}
      />
      {/* Top ellipse */}
      <Ellipse
        x={w / 2}
        y={topH}
        radiusX={w / 2}
        radiusY={topH}
        fill={shape.style.fillColor || '#F0F4FF'}
        stroke={shape.style.strokeColor || '#2980B9'}
        strokeWidth={shape.style.strokeWidth}
        listening={false}
      />
      {/* Bottom ellipse */}
      <Ellipse
        x={w / 2}
        y={topH + bodyH}
        radiusX={w / 2}
        radiusY={topH}
        fill={shape.style.fillColor || '#F0F4FF'}
        stroke={shape.style.strokeColor || '#2980B9'}
        strokeWidth={shape.style.strokeWidth}
        listening={false}
      />
      {/* Bottom arc for open bottom */}
      <Rect
        x={0}
        y={topH + bodyH}
        width={w}
        height={topH}
        fill={shape.style.fillColor || '#F0F4FF'}
        listening={false}
      />
      {/* Bottom ellipse arc (draw over to hide top half of bottom ellipse) */}
      <Rect
        x={0}
        y={topH + bodyH}
        width={w}
        height={topH / 2}
        fill={shape.style.fillColor || '#F0F4FF'}
        listening={false}
      />
      {/* Bottom ellipse stroke (only bottom half visible) */}
      <Ellipse
        x={w / 2}
        y={topH + bodyH}
        radiusX={w / 2}
        radiusY={topH}
        fill={shape.style.fillColor || '#F0F4FF'}
        stroke={shape.style.strokeColor || '#2980B9'}
        strokeWidth={shape.style.strokeWidth}
        listening={false}
      />
      {/* Cover top half of bottom ellipse */}
      <Rect
        x={0}
        y={topH + bodyH - topH}
        width={w}
        height={topH}
        fill={shape.style.fillColor || '#F0F4FF'}
        listening={false}
      />
      {/* Side lines for body connection */}
      <Rect
        x={0}
        y={0}
        width={shape.style.strokeWidth || 1}
        height={topH}
        fill={shape.style.strokeColor || '#2980B9'}
        listening={false}
      />
      <Rect
        x={w - (shape.style.strokeWidth || 1)}
        y={0}
        width={shape.style.strokeWidth || 1}
        height={topH}
        fill={shape.style.strokeColor || '#2980B9'}
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'database',
  label: '数据库',
  icon: '\u{1F5C4}',
  category: 'flowchart',
  renderer: (props) => <DatabaseShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#F0F4FF', strokeColor: '#2980B9' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
