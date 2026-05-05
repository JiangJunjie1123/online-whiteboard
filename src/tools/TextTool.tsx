import { Text } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface TextShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Text | null) => void
}

export function TextShape({ shape, isSelected, onSelect, shapeRef }: TextShapeProps) {
  return (
    <Text
      id={shape.id}
      ref={shapeRef}
      x={shape.points[0]}
      y={shape.points[1]}
      text={shape.text || '文本'}
      fontSize={shape.style.fontSize || 24}
      fill={shape.style.strokeColor}
      opacity={shape.style.opacity}
      rotation={shape.rotation || 0}
      onClick={onSelect}
      onTap={onSelect}
    />
  )
}
