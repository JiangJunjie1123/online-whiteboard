import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'

interface CrossShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function CrossShape({ shape, isSelected, onSelect, shapeRef }: CrossShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2
  const thick = Math.min(maxX - minX, maxY - minY) * 0.25

  // Draw a cross as a thick plus sign using a closed path
  const l = minX, r = maxX, t = minY, b = maxY
  const verts = [
    midX - thick, t,
    midX + thick, t,
    midX + thick, midY - thick,
    r, midY - thick,
    r, midY + thick,
    midX + thick, midY + thick,
    midX + thick, b,
    midX - thick, b,
    midX - thick, midY + thick,
    l, midY + thick,
    l, midY - thick,
    midX - thick, midY - thick,
  ]
  const cx = midX, cy = midY

  return (
    <Line
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      points={verts.map((v, i) => i % 2 === 0 ? v - cx : v - cy)}
      closed
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.fillColor}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
    />
  )
}

shapeRegistry.register({
  type: 'cross',
  label: '十字形',
  icon: '✚',
  category: 'basic',
  renderer: (props) => <CrossShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
})
