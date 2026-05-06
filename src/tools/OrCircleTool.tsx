import { Group, Ellipse, Text, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface OrCircleShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function OrCircleShape({ shape, isSelected, onSelect, shapeRef }: OrCircleShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 40
  const h = Math.abs(y2 - y1) || 40
  const r = Math.min(w, h) / 2

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
      {/* Circle */}
      <Ellipse
        x={r}
        y={r}
        radiusX={r}
        radiusY={r}
        fill={shape.style.fillColor || '#FAFAFA'}
        stroke={shape.style.strokeColor || '#1f2937'}
        strokeWidth={shape.style.strokeWidth || 2}
        listening={false}
      />
      {/* OR text */}
      <Text
        x={0}
        y={0}
        width={r * 2}
        height={r * 2}
        text={shape.text || 'OR'}
        fontSize={Math.min(r * 0.6, 14)}
        fontStyle="bold"
        fill={shape.style.strokeColor || '#1f2937'}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'or-circle',
  label: '或节点',
  icon: '\u{1F503}',
  category: 'flowchart',
  renderer: (props) => <OrCircleShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#FAFAFA', strokeColor: '#1f2937' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
