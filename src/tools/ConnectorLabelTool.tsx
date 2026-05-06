import { Group, Arrow, Text } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface ConnectorLabelShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function ConnectorLabelShape({ shape, isSelected, onSelect, shapeRef }: ConnectorLabelShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 150
  const h = Math.abs(y2 - y1) || 40
  const cx = w / 2
  const cy = h / 2
  const len = Math.sqrt(w ** 2 + h ** 2)
  const text = shape.text || 'Label'

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
      {/* Connector line */}
      <Arrow
        points={[0, 0, w, h]}
        stroke={shape.style.strokeColor || '#2563EB'}
        strokeWidth={shape.style.strokeWidth || 2}
        fill={shape.style.strokeColor || '#2563EB'}
        pointerLength={Math.min(10, len / 4)}
        pointerWidth={Math.min(8, len / 5)}
        listening={false}
      />
      {/* Label at midpoint */}
      <Text
        x={cx - 30}
        y={cy - 10}
        width={60}
        height={20}
        text={text}
        fontSize={shape.style.fontSize || 12}
        fill={shape.style.strokeColor || '#2563EB'}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'connector-label',
  label: '连接标签',
  icon: '\u{1F517}',
  category: 'arrow',
  renderer: (props) => <ConnectorLabelShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { strokeColor: '#2563EB', strokeWidth: 2 },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
