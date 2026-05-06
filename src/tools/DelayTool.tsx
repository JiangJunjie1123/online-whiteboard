import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computePolygonTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface DelayShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function DelayShape({ shape, isSelected, onSelect, shapeRef }: DelayShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const w = maxX - minX
  const h = maxY - minY
  const r = Math.min(w, h / 2)

  // Half-ellipse pill: semicircle on left, flat right end
  const verts: number[] = []
  const steps = 16
  // Left semicircle (top half)
  for (let i = 0; i <= steps / 2; i++) {
    const angle = Math.PI * (i / (steps / 2)) - Math.PI / 2
    verts.push(-w / 2 + r + r * Math.cos(angle), r * Math.sin(angle))
  }
  // Right flat end
  const rightX = w / 2
  const flatTop = -h / 2 + (h - r * 2) / 2
  const flatBottom = h / 2 - (h - r * 2) / 2
  // Actually just draw top edge → right edge → bottom edge → back along left arc

  // Simplified: just use the pill shape
  verts.push(rightX, -r)       // top right
  verts.push(rightX, r)        // bottom right
  // Left semicircle bottom to top
  for (let i = steps / 2; i <= steps; i++) {
    const angle = Math.PI * (i / steps) - Math.PI / 2
    verts.push(-w / 2 + r + r * Math.cos(angle), r * Math.sin(angle))
  }

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const oldX = (minX + maxX) / 2
    const oldY = (minY + maxY) / 2
    const dx = node.x() - oldX
    const dy = node.y() - oldY
    if (dx === 0 && dy === 0) return

    const newPoints = [x1 + dx, y1 + dy, x2 + dx, y2 + dy]
    useCanvasStore.getState().updateShape(shape.id, { points: newPoints })
    const sm = getSyncManager()
    if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: newPoints } })
  }

  return (
    <Line
      id={shape.id}
      ref={shapeRef}
      x={cx}
      y={cy}
      points={verts}
      closed
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      fill={shape.style.fillColor}
      opacity={shape.style.opacity}
      onClick={onSelect}
      onTap={onSelect}
      draggable
      onDragEnd={handleDragEnd}
      onDblClick={() => {
        const textTypes = ["text","connector-label","flow-terminator","note-sticky","class-box","or-circle","callout"]
        if (shape.text !== undefined || textTypes.includes(shape.type)) {
          ;(window as any).__editShapeText?.(shape.id, shape.text || "")
        }
      }}
    />
  )
}

shapeRegistry.register({
  type: 'delay',
  label: '延迟',
  icon: '⏳',
  category: 'flowchart',
  renderer: (props) => <DelayShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#EBF5FB', strokeColor: '#2980B9' },
  transform: (shape, node, stageScale) => computePolygonTransform(shape, node as Konva.Line, stageScale),
})
