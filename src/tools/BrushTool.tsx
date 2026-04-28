import { Line } from 'react-konva'
import type { Shape } from '../types'

interface BrushShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
}

export function BrushShape({ shape, isSelected, onSelect }: BrushShapeProps) {
  return (
    <Line
      id={shape.id}
      points={shape.points}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      opacity={shape.style.opacity}
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      globalCompositeOperation="source-over"
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={shape.style.strokeWidth + 10}
    />
  )
}
