import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape } from '../types'

interface PentagonShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function PentagonShape({ shape, isSelected, onSelect, shapeRef }: PentagonShapeProps) {
  const pts = shape.points
  // Centroid of 5 vertices
  let cx = 0, cy = 0
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1] }
  cx /= (pts.length / 2); cy /= (pts.length / 2)

  return (
    <Line
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      points={pts.map((v, i) => i % 2 === 0 ? v - cx : v - cy)}
      closed
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.fillColor}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
    />
  )
}
