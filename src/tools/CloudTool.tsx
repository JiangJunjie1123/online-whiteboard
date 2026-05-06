import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computePolygonTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface CloudShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function CloudShape({ shape, isSelected, onSelect, shapeRef }: CloudShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const w = maxX - minX
  const h = maxY - minY

  // Cloud shape using arcs around a rounded rectangle
  // Build with a series of bumps
  const rx = w / 2
  const ry = h / 2
  const bumpR = Math.min(rx, ry) * 0.45
  const verts: number[] = []

  // Number of bumps on each side
  const topBumps = 4
  const bottomBumps = 4

  // Top edge bumps (left to right)
  for (let i = 0; i < topBumps; i++) {
    const bx = -rx + (rx * 2 * (i + 0.5)) / topBumps
    const by = -ry + bumpR * 0.3
    const angleStep = Math.PI / 8
    for (let a = Math.PI; a >= 0; a -= angleStep) {
      verts.push(bx + bumpR * Math.cos(a), by - bumpR * Math.sin(a))
    }
  }

  // Right edge bumps (top to bottom)
  for (let i = 0; i < 3; i++) {
    const bx = rx - bumpR * 0.3
    const by = -ry + (ry * 2 * (i + 0.5)) / 3
    const angleStep = Math.PI / 8
    for (let a = Math.PI / 2; a >= -Math.PI / 2; a -= angleStep) {
      verts.push(bx + bumpR * Math.cos(a), by - bumpR * Math.sin(a))
    }
  }

  // Bottom edge bumps (right to left)
  for (let i = 0; i < bottomBumps; i++) {
    const bx = rx - (rx * 2 * (i + 0.5)) / bottomBumps
    const by = ry - bumpR * 0.3
    const angleStep = Math.PI / 8
    for (let a = 0; a >= -Math.PI; a -= angleStep) {
      verts.push(bx + bumpR * Math.cos(a), by - bumpR * Math.sin(a))
    }
  }

  // Left edge bumps (bottom to top)
  for (let i = 0; i < 3; i++) {
    const bx = -rx + bumpR * 0.3
    const by = ry - (ry * 2 * (i + 0.5)) / 3
    const angleStep = Math.PI / 8
    for (let a = -Math.PI / 2; a >= -3 * Math.PI / 2; a -= angleStep) {
      verts.push(bx + bumpR * Math.cos(a), by - bumpR * Math.sin(a))
    }
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
      tension={0.3}
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
  type: 'cloud',
  label: '云形',
  icon: '☁',
  category: 'flowchart',
  renderer: (props) => <CloudShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#F0F4FF', strokeColor: '#2980B9' },
  transform: (shape, node, stageScale) => computePolygonTransform(shape, node as Konva.Line, stageScale),
})
