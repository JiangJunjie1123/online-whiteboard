import { Arrow } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'

interface DoubleArrowShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Arrow | null) => void
}

export function DoubleArrowShape({ shape, isSelected, onSelect, shapeRef }: DoubleArrowShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  return (
    <Arrow
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      points={[x1 - cx, y1 - cy, x2 - cx, y2 - cy]}
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.strokeColor}
      opacity={shape.style.opacity}
      pointerLength={Math.min(15, len / 3)}
      pointerWidth={Math.min(10, len / 4)}
      pointerAtBeginning
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={shape.style.strokeWidth + 10}
    />
  )
}

shapeRegistry.register({
  type: 'double-arrow',
  label: '双箭头',
  icon: '⇔',
  category: 'arrow',
  renderer: (props) => <DoubleArrowShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
})
