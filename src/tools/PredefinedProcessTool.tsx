import { Group, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface PredefinedProcessShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function PredefinedProcessShape({ shape, isSelected, onSelect, shapeRef }: PredefinedProcessShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 80
  const h = Math.abs(y2 - y1) || 40
  const barW = Math.min(w * 0.1, 8)

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
      {/* Main rectangle body */}
      <Rect
        width={w}
        height={h}
        fill={shape.style.fillColor || '#F0F4FF'}
        stroke={shape.style.strokeColor || '#2980B9'}
        strokeWidth={shape.style.strokeWidth}
        cornerRadius={2}
        listening={false}
      />
      {/* Left vertical bar */}
      <Rect
        x={barW * 0.5}
        y={0}
        width={barW}
        height={h}
        fill={shape.style.strokeColor || '#2980B9'}
        opacity={0.8}
        listening={false}
      />
      {/* Right vertical bar */}
      <Rect
        x={w - barW * 1.5}
        y={0}
        width={barW}
        height={h}
        fill={shape.style.strokeColor || '#2980B9'}
        opacity={0.8}
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'predefined-process',
  label: '预定义流程',
  icon: '\u{1F4E6}',
  category: 'flowchart',
  renderer: (props) => <PredefinedProcessShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#F0F4FF', strokeColor: '#2980B9' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
