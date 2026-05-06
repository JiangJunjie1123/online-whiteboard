import { Group, Rect, Line } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { computeRectTransform } from '../tools/transformUtils'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface ClassBoxShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Group | null) => void
}

export function ClassBoxShape({ shape, isSelected, onSelect, shapeRef }: ClassBoxShapeProps) {
  const [x1, y1, x2, y2] = shape.points
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 120
  const h = Math.abs(y2 - y1) || 90
  const sectionH = h / 3

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
      {/* Main outline */}
      <Rect
        width={w}
        height={h}
        fill={shape.style.fillColor || '#FAFAFA'}
        stroke={shape.style.strokeColor || '#1f2937'}
        strokeWidth={shape.style.strokeWidth}
        listening={false}
      />
      {/* Divider line 1: between name and attributes */}
      <Line
        points={[0, sectionH, w, sectionH]}
        stroke={shape.style.strokeColor || '#1f2937'}
        strokeWidth={shape.style.strokeWidth * 0.7}
        listening={false}
      />
      {/* Divider line 2: between attributes and methods */}
      <Line
        points={[0, sectionH * 2, w, sectionH * 2]}
        stroke={shape.style.strokeColor || '#1f2937'}
        strokeWidth={shape.style.strokeWidth * 0.7}
        listening={false}
      />
      {/* Top section header background */}
      <Rect
        width={w}
        height={sectionH}
        fill={shape.style.strokeColor || '#1f2937'}
        opacity={0.08}
        listening={false}
      />
    </Group>
  )
}

shapeRegistry.register({
  type: 'class-box',
  label: '类框',
  icon: '\u{1F4CB}',
  category: 'uml',
  renderer: (props) => <ClassBoxShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { fillColor: '#FAFAFA', strokeColor: '#1f2937' },
  transform: (shape, node, stageScale) => computeRectTransform(shape, node as any, stageScale),
})
