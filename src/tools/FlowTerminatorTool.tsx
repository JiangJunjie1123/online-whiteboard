import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface FlowTerminatorShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Rect | null) => void
}

export function FlowTerminatorShape({ shape, isSelected, onSelect, shapeRef }: FlowTerminatorShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 80
  const h = Math.abs(y2 - y1) || 40
  const radius = Math.min(w, h) / 2

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
      <Rect
        width={w}
        height={h}
        fill={shape.style.fillColor || '#EBF5FB'}
        stroke={shape.style.strokeColor || '#2980B9'}
        strokeWidth={shape.style.strokeWidth || 2}
        cornerRadius={radius}
        listening={false}
      />
      <Text
        width={w}
        height={h}
        text={shape.text || '开始'}
        fontSize={shape.style.fontSize || 14}
        fill="#1f2937"
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'flow-terminator',
  label: '开始/结束',
  icon: '🔘',
  category: 'flowchart',
  renderer: (props) => <FlowTerminatorShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#EBF5FB', strokeColor: '#2980B9' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as Konva.Rect, stageScale),
})
