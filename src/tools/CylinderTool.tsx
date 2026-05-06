import { Group, Ellipse, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface CylinderShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function CylinderShape({ shape, isSelected, onSelect, shapeRef }: CylinderShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 70
  const h = Math.abs(y2 - y1) || 90
  const ellH = h * 0.15
  const bodyH = h - 2 * ellH

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
      onDblClick={() => {
        const textTypes = ["text","connector-label","flow-terminator","note-sticky","class-box","or-circle","callout"]
        if (shape.text !== undefined || textTypes.includes(shape.type)) {
          ;(window as any).__editShapeText?.(shape.id, shape.text || "")
        }
      }}
    >
      {/* Transparent hit area for drag */}
      <Rect width={w} height={h} fill="transparent" />
      {/* Body rect */}
      <Rect
        x={0}
        y={ellH}
        width={w}
        height={bodyH}
        fill={shape.style.fillColor || '#F0F4FF'}
        stroke={shape.style.strokeColor || '#2563EB'}
        strokeWidth={shape.style.strokeWidth || 2}
        listening={false}
      />
      {/* Top ellipse (full, for 3D top face) */}
      <Ellipse
        x={w / 2}
        y={ellH}
        radiusX={w / 2}
        radiusY={ellH}
        fill={shape.style.fillColor || '#DBEAFE'}
        stroke={shape.style.strokeColor || '#2563EB'}
        strokeWidth={shape.style.strokeWidth || 2}
        listening={false}
      />
      {/* Bottom ellipse arc (only bottom half visible) */}
      <Ellipse
        x={w / 2}
        y={ellH + bodyH}
        radiusX={w / 2}
        radiusY={ellH}
        fill={shape.style.fillColor || '#F0F4FF'}
        stroke={shape.style.strokeColor || '#2563EB'}
        strokeWidth={shape.style.strokeWidth || 2}
        listening={false}
      />
      {/* Cover top half of bottom ellipse */}
      <Rect
        x={0}
        y={ellH + bodyH - ellH}
        width={w}
        height={ellH}
        fill={shape.style.fillColor || '#F0F4FF'}
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'cylinder',
  label: '圆柱体',
  icon: '\u{1FAD9}',
  category: 'misc',
  renderer: (props) => <CylinderShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#F0F4FF', strokeColor: '#2563EB' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
