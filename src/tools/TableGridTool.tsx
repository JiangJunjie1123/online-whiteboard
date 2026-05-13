import { useRef } from 'react'
import { Group, Rect, Line, Text } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeGroupTransform } from '../tools/transformUtils'
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
  const cells = (shape.extras?.cells as string[] | undefined) || []
  const groupRef = useRef<Konva.Group | null>(null)
  const clickTrack = useRef({ count: 0, lastCell: -1, lastTime: 0, timer: 0 })

  const getCellIndex = (): number => {
    const group = groupRef.current
    if (!group) return -1
    const stage = group.getStage()
    const pointer = stage?.getPointerPosition()
    if (!pointer) return -1
    const pt = group.getAbsoluteTransform().copy().invert().point(pointer)
    const col = Math.floor(pt.x / cellW)
    const row = Math.floor(pt.y / cellH)
    if (col < 0 || col > 2 || row < 0 || row > 2) return -1
    return row * 3 + col
  }

  const handleMouseDown = () => {
    const cellIdx = getCellIndex()
    if (cellIdx < 0) return
    const now = Date.now()
    const t = clickTrack.current
    if (cellIdx === t.lastCell && now - t.lastTime < 500) {
      t.count++
    } else {
      t.count = 1
    }
    t.lastCell = cellIdx
    t.lastTime = now
    clearTimeout(t.timer)
    t.timer = window.setTimeout(() => { t.count = 0 }, 600)

    if (t.count >= 3) {
      t.count = 0
      clearTimeout(t.timer)
      const current = cells[cellIdx] || ''
      ;(window as any)._tableEditCell = { shapeId: shape.id, cellIndex: cellIdx }
      ;(window as any).__editShapeText?.(shape.id, current)
    }
  }

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
      ref={(node) => {
        groupRef.current = node
        if (shapeRef) (shapeRef as any)(node)
      }}
      x={x}
      y={y}
      rotation={shape.rotation || 0}
      onClick={onSelect}
      onTap={onSelect}
      onMouseDown={handleMouseDown}
      draggable
      onDragEnd={handleDragEnd}
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
      <Line points={[cellW, 0, cellW, h]} stroke={lineColor} strokeWidth={lineWidth} listening={false} />
      {/* Vertical divider 2 */}
      <Line points={[cellW * 2, 0, cellW * 2, h]} stroke={lineColor} strokeWidth={lineWidth} listening={false} />
      {/* Horizontal divider 1 */}
      <Line points={[0, cellH, w, cellH]} stroke={lineColor} strokeWidth={lineWidth} listening={false} />
      {/* Horizontal divider 2 */}
      <Line points={[0, cellH * 2, w, cellH * 2]} stroke={lineColor} strokeWidth={lineWidth} listening={false} />
      {/* Cell texts */}
      {cells.map((text, i) => {
        if (!text) return null
        return (
          <Text
            key={`ct-${i}`}
            x={(i % 3) * cellW + 4}
            y={Math.floor(i / 3) * cellH + 4}
            width={cellW - 8}
            height={cellH - 8}
            text={text}
            fontSize={12}
            fill="#1f2937"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        )
      })}
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
  transform: (shape, node) => computeGroupTransform(shape, node as any),
})
