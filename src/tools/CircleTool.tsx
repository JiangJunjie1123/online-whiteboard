import { Ellipse } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'

interface CircleShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Ellipse | null) => void
}

export function CircleShape({ shape, isSelected, onSelect, shapeRef }: CircleShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const rx = Math.abs(x2 - x1) / 2
  const ry = Math.abs(y2 - y1) / 2

  return (
    <Ellipse
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      radiusX={rx || 1}
      radiusY={ry || 1}
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
  type: 'circle',
  label: '圆形',
  icon: '⭕',
  category: 'basic',
  renderer: (props) => <CircleShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
})
