import { Layer, Rect } from 'react-konva'
import { useState, useEffect } from 'react'

export function GridBackground() {
  const [patternImage, setPatternImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const size = 20
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, size, size)
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = '#d0d5dd'
    ctx.fill()
    const img = new Image()
    img.onload = () => setPatternImage(img)
    img.src = canvas.toDataURL()
  }, [])

  return (
    <Layer listening={false}>
      {patternImage && (
        <Rect
          x={-10000}
          y={-10000}
          width={20000}
          height={20000}
          fillPatternImage={patternImage}
          listening={false}
        />
      )}
    </Layer>
  )
}
