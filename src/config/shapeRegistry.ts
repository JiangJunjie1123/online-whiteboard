import type { Shape, Point, ShapeStyle } from '../types'
import type Konva from 'konva'
import type React from 'react'

export interface ShapeRendererProps {
  shape: Shape
  isSelected?: boolean
  onSelect?: () => void
  shapeRef?: (node: Konva.Node | null) => void
}

export interface TransformerConfig {
  enabledAnchors: string[]
  rotateEnabled: boolean
  keepRatio: boolean
}

export interface ShapeDefinition {
  type: string
  label: string
  icon: string
  category: ShapeCategory
  renderer: React.FC<ShapeRendererProps>
  updatePoints: (shape: Shape, currentPoint: Point) => number[]
  getTransformerConfig?: (shape: Shape) => TransformerConfig
  defaultStyle?: Partial<ShapeStyle>
}

export type ShapeCategory = 'basic' | 'arrow' | 'flowchart' | 'uml' | 'annotation' | 'misc'

class ShapeRegistryClass {
  private shapes = new Map<string, ShapeDefinition>()
  private categoryOrder: ShapeCategory[] = ['basic', 'arrow', 'flowchart', 'uml', 'annotation', 'misc']

  register(def: ShapeDefinition): void {
    if (this.shapes.has(def.type)) {
      console.warn(`[ShapeRegistry] Overwriting registration for "${def.type}"`)
    }
    this.shapes.set(def.type, def)
  }

  get(type: string): ShapeDefinition | undefined {
    return this.shapes.get(type)
  }

  getAll(): ShapeDefinition[] {
    return Array.from(this.shapes.values())
  }

  getByCategory(category: ShapeCategory): ShapeDefinition[] {
    return this.getAll().filter(s => s.category === category)
  }

  getCategories(): ShapeCategory[] {
    return this.categoryOrder
  }

  isValid(type: string): boolean {
    return this.shapes.has(type)
  }
}

export const shapeRegistry = new ShapeRegistryClass()
