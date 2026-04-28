import { Arrow } from 'react-konva'
import type { Shape } from '../types'

interface ArrowShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
}

export function ArrowShape({ shape, isSelected, onSelect }: ArrowShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

  return (
    <Arrow
      id={shape.id}
      points={[x1, y1, x2, y2]}
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
