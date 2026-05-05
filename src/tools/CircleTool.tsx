import { Ellipse } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

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
