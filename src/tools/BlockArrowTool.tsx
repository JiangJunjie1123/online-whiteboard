import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computePolygonTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface BlockArrowShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function BlockArrowShape({ shape, isSelected, onSelect, shapeRef }: BlockArrowShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const w = maxX - minX
  const h = maxY - minY
  const hw = w / 2
  const hh = h / 2
  const shaftW = hh * 0.5

  // Block arrow pointing right:
  // Left side (shaft): narrower vertical rectangle
  // Right side (arrowhead): widens to full height
  const verts = [
    -hw, -shaftW,               // top-left of shaft
    hw * 0.3, -shaftW,          // top of shaft before head
    hw * 0.3, -hh,              // top of arrowhead
    hw, 0,                      // right point
    hw * 0.3, hh,               // bottom of arrowhead
    hw * 0.3, shaftW,           // bottom of shaft before head
    -hw, shaftW,                // bottom-left of shaft
  ]

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const oldX = (minX + maxX) / 2
    const oldY = (minY + maxY) / 2
    const dx = node.x() - oldX
    const dy = node.y() - oldY
    if (dx === 0 && dy === 0) return

    const newPoints = [x1 + dx, y1 + dy, x2 + dx, y2 + dy]
    useCanvasStore.getState().updateShape(shape.id, { points: newPoints })
    const sm = getSyncManager()
    if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: newPoints } })
  }

  return (
    <Line
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      points={verts}
      closed
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.fillColor}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
      draggable
      onDragEnd={handleDragEnd}
    />
  )
}

shapeRegistry.register({
  type: 'block-arrow',
  label: '块箭头',
  icon: '\u{27A4}',
  category: 'misc',
  renderer: (props) => <BlockArrowShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#DBEAFE', strokeColor: '#2563EB' },
  transform: (shape, node, stageScale) => computePolygonTransform(shape, node as Konva.Line, stageScale),
})
