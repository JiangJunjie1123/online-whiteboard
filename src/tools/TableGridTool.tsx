import { Group, Rect, Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface TableGridShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function TableGridShape({ shape, isSelected, onSelect, shapeRef }: TableGridShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 120
  const h = Math.abs(y2 - y1) || 90
  const cellW = w / 3
  const cellH = h / 3
  const lineColor = shape.style.strokeColor || '#6B7280'
  const lineWidth = shape.style.strokeWidth || 1

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const oldX = Math.min(x1, x2)
    const oldY = Math.min(y1, y2)
    const dx = node.x() - oldX
    const dy = node.y() - oldY
    if (dx === 0 && dy === 0) return

    const newPoints = [x1 + dx, y1 + dy, x2 + dx, y2 + dy]
    useCanvasStore.getState().updateShape(shape.id, { points: newPoints })
    const sm = getSyncManager()
    if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: newPoints } })
  }

  return (
    <Group
      id={shape.id}
      ref={shapeRef as any}
      x={x}
      y={y}
      rotation={shape.rotation || 0}
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
    >
      {/* Transparent hit area for drag */}
      <Rect width={w} height={h} fill="transparent" />
      {/* Outer border */}
      <Rect
        width={w}
        height={h}
        fill={shape.style.fillColor || '#FAFAFA'}
        stroke={lineColor}
        strokeWidth={lineWidth}
        listening={false}
      />
      {/* Vertical divider 1 */}
      <Line
        points={[cellW, 0, cellW, h]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        listening={false}
      />
      {/* Vertical divider 2 */}
      <Line
        points={[cellW * 2, 0, cellW * 2, h]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        listening={false}
      />
      {/* Horizontal divider 1 */}
      <Line
        points={[0, cellH, w, cellH]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        listening={false}
      />
      {/* Horizontal divider 2 */}
      <Line
        points={[0, cellH * 2, w, cellH * 2]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'table-grid',
  label: '表格',
  icon: '⊞',
  category: 'misc',
  renderer: (props) => <TableGridShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#FAFAFA', strokeColor: '#6B7280', strokeWidth: 1 },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
