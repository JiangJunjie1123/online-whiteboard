import { useState, useRef, useEffect } from 'react'
import { exportCanvas } from '../utils/exportCanvas'

type ExportFormat = 'png' | 'jpg'
type BackgroundMode = 'grid' | 'white'

export function ExportPopover() {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('png')
  const [background, setBackground] = useState<BackgroundMode>('grid')
  const [exporting, setExporting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleOpen = () => {
    // Reset to defaults each time
    setFormat('png')
    setBackground('grid')
    setOpen(true)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportCanvas({ format, background })
    } finally {
      setExporting(false)
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span className="inline-flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
          {/* Format */}
          <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">导出格式</h4>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  value="png"
                  checked={format === 'png'}
                  onChange={() => setFormat('png')}
                  className="accent-primary"
                />
                <span className="text-sm text-gray-700">PNG</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  value="jpg"
                  checked={format === 'jpg'}
                  onChange={() => setFormat('jpg')}
                  className="accent-primary"
                />
                <span className="text-sm text-gray-700">JPG</span>
              </label>
            </div>
          </div>

          {/* Background */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">背景</h4>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="export-bg"
                  value="grid"
                  checked={background === 'grid'}
                  onChange={() => setBackground('grid')}
                  className="accent-primary"
                />
                <span className="text-sm text-gray-700">网格</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="export-bg"
                  value="white"
                  checked={background === 'white'}
                  onChange={() => setBackground('white')}
                  className="accent-primary"
                />
                <span className="text-sm text-gray-700">白色</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors"
            >
              {exporting ? '导出中...' : '导出'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
