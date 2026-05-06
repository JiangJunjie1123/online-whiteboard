import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computePolygonTransform } from '../tools/transformUtils'

interface TrapezoidShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function TrapezoidShape({ shape, isSelected, onSelect, shapeRef }: TrapezoidShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
  const w = maxX - minX
  const inset = w * 0.2
  const verts = [minX + inset, minY, maxX - inset, minY, maxX, maxY, minX, maxY]
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2

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
  type: 'trapezoid',
  label: '梯形',
  icon: '⏢',
  category: 'basic',
  renderer: (props) => <TrapezoidShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  transform: (shape, node, stageScale) => computePolygonTransform(shape, node as Konva.Line, stageScale),
})
