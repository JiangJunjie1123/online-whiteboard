import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface BrushShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function BrushShape({ shape, isSelected, onSelect, shapeRef }: BrushShapeProps) {
  return (
    <Line
      id={shape.id}
      ref={shapeRef}
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
