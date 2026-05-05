import { Arrow } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface ArrowShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Arrow | null) => void
}

export function ArrowShape({ shape, isSelected, onSelect, shapeRef }: ArrowShapeProps) {
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
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={shape.style.strokeWidth + 10}
    />
  )
}
