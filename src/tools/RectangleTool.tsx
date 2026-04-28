import { Rect } from 'react-konva'
import type { Shape } from '../types'

interface RectShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
}

export function RectangleShape({ shape, isSelected, onSelect }: RectShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)

  return (
    <Rect
      id={shape.id}
      x={x}
      y={y}
      width={width}
      height={height}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.fillColor}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
    />
  )
}
