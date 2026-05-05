import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface LineShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function LineShape({ shape, isSelected, onSelect, shapeRef }: LineShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  return (
    <Line
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      points={[x1 - cx, y1 - cy, x2 - cx, y2 - cy]}
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={shape.style.strokeWidth + 10}
    />
  )
}
