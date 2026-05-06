import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computePolygonTransform } from '../tools/transformUtils'

interface OctagonShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function OctagonShape({ shape, isSelected, onSelect, shapeRef }: OctagonShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const rx = (maxX - minX) / 2, ry = (maxY - minY) / 2
  const verts: number[] = []
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 4
    verts.push(rx * Math.cos(angle), ry * Math.sin(angle))
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
    />
  )
}

shapeRegistry.register({
  type: 'octagon',
  label: '八边形',
  icon: '🛑',
  category: 'basic',
  renderer: (props) => <OctagonShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  transform: (shape, node, stageScale) => computePolygonTransform(shape, node as Konva.Line, stageScale),
})
