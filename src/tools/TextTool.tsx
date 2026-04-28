import { Text } from 'react-konva'
import type { Shape } from '../types'

interface TextShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
}

export function TextShape({ shape, isSelected, onSelect }: TextShapeProps) {
  return (
    <Text
      id={shape.id}
      x={shape.points[0]}
      y={shape.points[1]}
      text={shape.text || '文本'}
      fontSize={shape.style.fontSize || 24}
      fill={shape.style.strokeColor}
      opacity={shape.style.opacity}
      draggable
      onClick={onSelect}
      onTap={onSelect}
    />
  )
}
