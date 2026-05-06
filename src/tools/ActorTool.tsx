import { Group, Circle, Line, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface ActorShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function ActorShape({ shape, isSelected, onSelect, shapeRef }: ActorShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 40
  const h = Math.abs(y2 - y1) || 80
  const cx = w / 2
  const headR = Math.min(w / 2, h * 0.15)
  const headCY = headR + 2
  const neckY = headR * 2 + 4
  const bodyTopY = neckY
  const bodyBottomY = h * 0.62
  const armY = neckY + (bodyBottomY - neckY) * 0.3
  const legTopY = bodyBottomY
  const footY = h

  const lineColor = shape.style.strokeColor || '#1f2937'
  const lineWidth = shape.style.strokeWidth || 2

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
      {/* Head */}
      <Circle
        x={cx}
        y={headCY}
        radius={headR}
        stroke={lineColor}
        strokeWidth={lineWidth}
        fill={shape.style.fillColor || '#FAFAFA'}
        listening={false}
      />
      {/* Body */}
      <Line
        points={[cx, neckY, cx, bodyBottomY]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        listening={false}
      />
      {/* Arms */}
      <Line
        points={[cx - w * 0.35, armY, cx + w * 0.35, armY]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        listening={false}
      />
      {/* Left leg */}
      <Line
        points={[cx, legTopY, cx - w * 0.28, footY]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        listening={false}
      />
      {/* Right leg */}
      <Line
        points={[cx, legTopY, cx + w * 0.28, footY]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'actor',
  label: '角色',
  icon: '\u{1F464}',
  category: 'uml',
  renderer: (props) => <ActorShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#FAFAFA', strokeColor: '#1f2937' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
