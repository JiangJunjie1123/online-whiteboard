import { Group, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface SignalShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function SignalShape({ shape, isSelected, onSelect, shapeRef }: SignalShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 30
  const h = Math.abs(y2 - y1) || 60
  const barCount = 4
  const barW = w / (barCount + 0.5)
  const gap = barW * 0.3
  const maxBarH = h
  const activeColor = shape.style.fillColor || '#22C55E'
  const inactiveColor = shape.style.strokeColor || '#D1D5DB'

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
      {Array.from({ length: barCount }, (_, i) => {
        const barH = maxBarH * ((i + 1) / barCount)
        const bx = i * (barW + gap)
        const by = maxBarH - barH
        const isActive = i < barCount
        return (
          <Rect
            key={i}
            x={bx}
            y={by}
            width={barW - gap}
            height={barH}
            fill={isActive ? activeColor : inactiveColor}
            cornerRadius={1.5}
            listening={false}
          />
        )
      })}
    </Group>
  )
}

shapeRegistry.register({
  type: 'signal',
  label: '信号',
  icon: '\u{1F4F6}',
  category: 'misc',
  renderer: (props) => <SignalShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#22C55E', strokeColor: '#D1D5DB' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
