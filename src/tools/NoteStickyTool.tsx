import { Group, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface NoteStickyShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Rect | null) => void
}

export function NoteStickyShape({ shape, isSelected, onSelect, shapeRef }: NoteStickyShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 100
  const h = Math.abs(y2 - y1) || 80

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
      {/* Shadow rect (slightly offset) */}
      <Rect
        x={3}
        y={3}
        width={w}
        height={h}
        fill="#000"
        opacity={0.08}
        cornerRadius={2}
        listening={false}
      />
      {/* Main sticky note body */}
      <Rect
        width={w}
        height={h}
        fill={shape.style.fillColor || '#FFF9C4'}
        stroke={shape.style.strokeColor || '#E6C300'}
        strokeWidth={shape.style.strokeWidth || 1}
        cornerRadius={2}
        shadowColor="#000"
        shadowBlur={5}
        shadowOffsetX={1}
        shadowOffsetY={2}
        shadowOpacity={0.15}
        listening={false}
      />
      {/* Fold corner */}
      <Rect
        x={w - 15}
        y={0}
        width={15}
        height={15}
        fill={shape.style.fillColor || '#FFF9C4'}
        stroke={shape.style.strokeColor || '#E6C300'}
        strokeWidth={0.5}
        opacity={0.7}
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'note-sticky',
  label: '便签',
  icon: '📝',
  category: 'annotation',
  renderer: (props) => <NoteStickyShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { strokeColor: '#E6C300', strokeWidth: 1, fillColor: '#FFF9C4', opacity: 1 },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as Konva.Rect, stageScale),
})
