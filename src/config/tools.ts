import type { ShapeCategory } from './shapeRegistry'
import { shapeRegistry } from './shapeRegistry'

export interface ToolConfig {
  type: string
  label: string
  icon: string
  category: ShapeCategory
}

/**
 * Dynamically populate the tools list from the Shape Registry.
 * Call this after all shape files have been imported (registerAll.ts).
 */
export function getTools(): ToolConfig[] {
  return shapeRegistry.getAll().map((def) => ({
    type: def.type,
    label: def.label,
    icon: def.icon,
    category: def.category,
  }))
}

/**
 * Legacy static TOOLS array for backward compatibility.
 * Populated dynamically from the registry.
 */
export const TOOLS: ToolConfig[] = getTools()

/**
 * Group tools by category. Returns a Map of category -> tools sorted by category order.
 */
export function getToolsByCategory(): Map<ShapeCategory, ToolConfig[]> {
  const map = new Map<ShapeCategory, ToolConfig[]>()
  const tools = getTools()
  for (const cat of shapeRegistry.getCategories()) {
    const catTools = tools.filter((t) => t.category === cat)
    if (catTools.length > 0) {
      map.set(cat, catTools)
    }
  }
  return map
}
