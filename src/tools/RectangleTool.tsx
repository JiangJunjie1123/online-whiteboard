import { Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'

interface RectShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Rect | null) => void
}

export function RectangleShape({ shape, isSelected, onSelect, shapeRef }: RectShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)

  return (
    <Rect
      id={shape.id}
      ref={shapeRef}
      x={x}
      y={y}
      width={width || 1}
      height={height || 1}
      rotation={shape.rotation || 0}
      cornerRadius={8}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.fillColor}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
    />
  )
}

shapeRegistry.register({
  type: 'rectangle',
  label: '矩形',
  icon: '⬜',
  category: 'basic',
  renderer: (props) => <RectangleShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
})
