import { useCanvasStore } from '../stores/useCanvasStore'

type BackgroundMode = 'grid' | 'white'
type ExportFormat = 'png' | 'jpg'

interface ExportOptions {
  format?: ExportFormat
  background?: BackgroundMode
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast = document.createElement('div')
  toast.textContent = message
  toast.className = [
    'fixed bottom-20 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-opacity duration-300',
    type === 'success'
      ? 'bg-green-600 text-white'
      : 'bg-red-600 text-white',
  ].join(' ')
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}

export async function exportCanvas(options: ExportOptions = {}): Promise<void> {
  const { format = 'png', background = 'grid' } = options
  const stage = useCanvasStore.getState().getStage?.()
  if (!stage) {
    showToast('画布未就绪，请稍后重试', 'error')
    return
  }

  // Save current grid state and hide if white background
  const savedGridVisible = useCanvasStore.getState().gridVisible

  if (background === 'white') {
    useCanvasStore.getState().setGridVisible(false)
  }

  // Wait a frame for Konva to re-render with updated grid visibility
  await new Promise((r) => requestAnimationFrame(r))

  try {
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
    const blob = (await stage.toBlob({
      mimeType,
      pixelRatio: 2,
      callback: () => {},
    })) as Blob | null
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const now = new Date()
      const ts = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
      const filename = `whiteboard-${ts}.${format}`
      a.download = filename
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
      showToast(`已导出 ${filename}`, 'success')
    } else {
      showToast('导出失败，请重试', 'error')
    }
  } catch {
    showToast('导出失败，请重试', 'error')
  } finally {
    // Restore grid visibility
    if (background === 'white') {
      useCanvasStore.getState().setGridVisible(savedGridVisible)
    }
  }
}
