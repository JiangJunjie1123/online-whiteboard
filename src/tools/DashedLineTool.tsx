import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeArrowTransform } from '../tools/transformUtils'

interface DashedLineShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function DashedLineShape({ shape, isSelected, onSelect, shapeRef }: DashedLineShapeProps) {
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
      dash={[12, 8]}
      onClick={onSelect}
      onTap={onSelect}
      hitStrokeWidth={shape.style.strokeWidth + 10}
    />
  )
}

shapeRegistry.register({
  type: 'dashed-line',
  label: '虚线',
  icon: '┅',
  category: 'arrow',
  renderer: (props) => <DashedLineShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  transform: (shape, node, stageScale) => computeArrowTransform(shape, node as Konva.Arrow, stageScale),
})
