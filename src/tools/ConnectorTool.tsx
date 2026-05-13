import { Arrow, Circle } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Point, ConnectorExtras } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'
import { getBestEdgeAnchor, isPointInShapeBounds } from '../utils/anchorUtils'
import { routeOrthogonal, routeStraight } from '../utils/connectorRouter'
import { useCanvasStore } from '../stores/useCanvasStore'
import { getSyncManager } from '../sync/SyncManager'

interface ConnectorShapeProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Arrow | null) => void
}

function ConnectorShape({ shape, isSelected, onSelect, shapeRef }: ConnectorShapeProps) {
  const points = shape.points
  const extras = shape.extras as ConnectorExtras | undefined
  const stroke = shape.style.strokeColor || '#2563EB'
  const strokeW = shape.style.strokeWidth || 2
  const len = Math.hypot(points[2] - points[0], points[3] - points[1])
  const arrowLen = Math.min(12, len / 4)
  const arrowW = Math.min(8, len / 5)
  const hasStart = extras?.arrowStart === 'triangle'
  const hasEnd = extras?.arrowEnd !== 'none'

  // 拖拽端点 → 吸附到目标形状边缘锚点（垂直连线）
  const makeEndpointDragEnd = (idx: 0 | 1) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target as Konva.Circle
    const pos: Point = { x: node.x(), y: node.y() }
    const store = useCanvasStore.getState()
    let snapped = false
    const curExtras = (store.shapes.find(s => s.id === shape.id)?.extras ?? shape.extras) as ConnectorExtras | undefined
    const otherIdx = idx === 0 ? 1 : 0
    const otherPos = { x: points[otherIdx * 2], y: points[otherIdx * 2 + 1] }

    for (const s of store.shapes) {
      if (s.id === shape.id || s.type === 'connector') continue
      if (!isPointInShapeBounds(s, pos, 24)) continue
      const best = getBestEdgeAnchor(s, pos)
      const newExtras: ConnectorExtras = {
        startShapeId: idx === 0 ? s.id : (curExtras?.startShapeId || ''),
        endShapeId: idx === 1 ? s.id : (curExtras?.endShapeId || ''),
        startAnchor: idx === 0 ? best.anchor : (curExtras?.startAnchor || 'center'),
        endAnchor: idx === 1 ? best.anchor : (curExtras?.endAnchor || 'center'),
        arrowEnd: curExtras?.arrowEnd ?? 'triangle',
        arrowStart: curExtras?.arrowStart ?? 'none',
      }
      const startPos = idx === 0 ? best.position : otherPos
      const endPos = idx === 1 ? best.position : otherPos
      const routed = routeOrthogonal(startPos, endPos, newExtras.startAnchor, newExtras.endAnchor, store.shapes, [shape.id, newExtras.startShapeId, newExtras.endShapeId])
      store.updateShape(shape.id, { points: routed, extras: newExtras as any })
      const sm = getSyncManager()
      if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: routed, extras: newExtras as any } })
      snapped = true
      break
    }
    if (!snapped) {
      const pts = [...points]
      pts[idx * 2] = pos.x
      pts[idx * 2 + 1] = pos.y
      store.updateShape(shape.id, { points: pts })
      const sm = getSyncManager()
      if (sm) sm.send({ type: 'operation', action: 'update', shape: { ...shape, points: pts } })
    }
  }

  return (
    <>
      <Arrow
        id={shape.id}
        ref={shapeRef}
        points={points}
        stroke={stroke}
        strokeWidth={strokeW}
        fill={stroke}
        pointerLength={hasEnd ? arrowLen : 0}
        pointerWidth={hasEnd ? arrowW : 0}
        pointerAtBeginning={hasStart}
        hitStrokeWidth={16}
        onClick={onSelect}
        onTap={onSelect}
      />
      {/* 选中时显示可拖拽端点 */}
      {isSelected && (
        <>
          <Circle
            x={points[0]} y={points[1]}
            radius={6} fill="white" stroke="#2563EB" strokeWidth={2}
            draggable
            onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
              const pts = [...points]; pts[0] = e.target.x(); pts[1] = e.target.y()
              useCanvasStore.getState().updateShape(shape.id, { points: pts })
            }}
            onDragEnd={makeEndpointDragEnd(0)}
          />
          <Circle
            x={points[points.length - 2]} y={points[points.length - 1]}
            radius={6} fill="white" stroke="#2563EB" strokeWidth={2}
            draggable
            onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
              const pts = [...points]; pts[pts.length - 2] = e.target.x(); pts[pts.length - 1] = e.target.y()
              useCanvasStore.getState().updateShape(shape.id, { points: pts })
            }}
            onDragEnd={makeEndpointDragEnd(1)}
          />
        </>
      )}
    </>
  )
}

shapeRegistry.register({
  type: 'connector',
  label: '连接线',
  icon: '→',
  category: 'arrow',
  renderer: (props) => <ConnectorShape {...props} />,
  updatePoints: (_shape: Shape, pt: Point) => [_shape.points[0], _shape.points[1], pt.x, pt.y],
  defaultStyle: { strokeColor: '#2563EB', strokeWidth: 2 },
  getTransformerConfig: () => ({
    enabledAnchors: [],
    rotateEnabled: false,
    keepRatio: false,
  }),
})
