import { Text } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeTextTransform } from '../tools/transformUtils'

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

shapeRegistry.register({
  type: 'text',
  label: '文本',
  icon: '🔤',
  category: 'annotation',
  renderer: (props) => <TextShape {...props} />,
  updatePoints: (_shape: Shape, _pt: Point) => [_shape.points[0], _shape.points[1]],
  getTransformerConfig: () => ({ enabledAnchors: [], rotateEnabled: true, keepRatio: false }),
  transform: (shape, node, stageScale) => computeTextTransform(shape, node as Konva.Text, stageScale),
})
