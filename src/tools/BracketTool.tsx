import { Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computePolygonTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface BracketShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Line | null) => void
}

export function BracketShape({ shape, isSelected, onSelect, shapeRef }: BracketShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const w = maxX - minX
  const h = maxY - minY
  const side = (shape.extras?.bracketSide as string) || 'left'
  const hookLen = Math.min(w * 0.7, h * 0.15, 14)
  const topY = -h / 2
  const bottomY = h / 2

  const verts = side === 'right'
    ? [
        // 右括号 ]：竖线在右，钩子朝左
        w / 2 - hookLen, topY,
        w / 2, topY,
        w / 2, bottomY,
        w / 2 - hookLen, bottomY,
      ]
    : [
        // 左括号 [：竖线在左，钩子朝右
        -w / 2 + hookLen, topY,
        -w / 2, topY,
        -w / 2, bottomY,
        -w / 2 + hookLen, bottomY,
      ]

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
      rotation={shape.rotation || 0}
      stroke={shape.style.strokeColor}
      strokeWidth={shape.style.strokeWidth}
      hitStrokeWidth={Math.max(shape.style.strokeWidth + 12, 16)}
      fill={shape.style.fillColor}
      opacity={shape.style.opacity}
      lineCap="round"
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
  type: 'bracket',
  label: '括号',
  icon: '[ ]',
  category: 'annotation',
  renderer: (props) => <BracketShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { strokeColor: '#6B7280', fillColor: 'transparent' },
  transform: (shape, node) => computePolygonTransform(shape, node as Konva.Line),
})
