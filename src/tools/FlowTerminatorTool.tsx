import { Rect } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'

interface FlowTerminatorShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Rect | null) => void
}

export function FlowTerminatorShape({ shape, isSelected, onSelect, shapeRef }: FlowTerminatorShapeProps) {
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
      cornerRadius={Math.min(width, height) / 2}
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
  type: 'flow-terminator',
  label: '开始/结束',
  icon: '🔘',
  category: 'flowchart',
  renderer: (props) => <FlowTerminatorShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#EBF5FB', strokeColor: '#2980B9' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as Konva.Rect, stageScale),
})
