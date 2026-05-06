// Pointer tool — not a drawing tool, just selection/drag
import type { Shape, Point } from '../types'
import { shapeRegistry } from '../config/shapeRegistry'

shapeRegistry.register({
  type: 'pointer',
  label: '指针',
  icon: '🖱',
  category: 'basic',
  renderer: () => null,
  updatePoints: (_: Shape, __: Point) => [],
})
