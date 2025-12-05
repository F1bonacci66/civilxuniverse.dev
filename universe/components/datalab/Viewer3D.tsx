'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { getXKTFile, getMetadata, type ViewerMetadata } from '@/lib/api/viewer'
import { cn } from '@/lib/utils'

interface Viewer3DProps {
  fileUploadId: string
  className?: string
  onLoad?: () => void
  onError?: (error: Error) => void
}

export function Viewer3D({ fileUploadId, className, onLoad, onError }: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<ViewerMetadata | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let isMounted = true

    const initViewer = async () => {
      try {
        setLoading(true)
        setError(null)

        // Динамически импортируем Xeokit SDK
        const { Viewer, XKTLoaderPlugin } = await import('@xeokit/xeokit-sdk')

        // Создаем контейнер для viewer
        const container = containerRef.current
        if (!container) return

        // Создаем canvas элемент внутри контейнера
        const canvasId = `viewer-canvas-${fileUploadId}`
        const canvas = document.createElement('canvas')
        canvas.id = canvasId
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.display = 'block'
        container.innerHTML = ''
        container.appendChild(canvas)

        // Инициализируем Xeokit Viewer с canvas
        const viewerInstance = new Viewer({
          canvasId: canvasId,
          transparent: true,
          edges: true,
          saoEnabled: true,
          pbrEnabled: false,
        })

        viewerRef.current = viewerInstance

        // Загружаем metadata
        try {
          const metadataData = await getMetadata(fileUploadId)
          if (isMounted) {
            setMetadata(metadataData)
          }
        } catch (err) {
          console.warn('Не удалось загрузить metadata:', err)
          // Продолжаем без metadata
        }

        // Загружаем XKT файл
        const xktBlob = await getXKTFile(fileUploadId)
        const xktUrl = URL.createObjectURL(xktBlob)

        // Загружаем XKTLoaderPlugin
        const xktLoader = new XKTLoaderPlugin(viewerInstance)

        // Загружаем модель
        const model = await xktLoader.load({
          id: `model-${fileUploadId}`,
          src: xktUrl,
          edges: true,
        })

        // Фокусируемся на модели
        viewerInstance.cameraFlight.flyTo({
          aabb: model.aabb,
          duration: 1.0,
        })

        // Очищаем URL после загрузки
        URL.revokeObjectURL(xktUrl)

        if (isMounted) {
          setLoading(false)
          onLoad?.()
        }
      } catch (err: any) {
        console.error('Ошибка инициализации 3D Viewer:', err)
        if (isMounted) {
          setError(err.message || 'Ошибка загрузки 3D модели')
          setLoading(false)
          onError?.(err)
        }
      }
    }

    initViewer()

    // Cleanup при размонтировании
    return () => {
      isMounted = false
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy()
        } catch (err) {
          console.error('Ошибка при уничтожении viewer:', err)
        }
        viewerRef.current = null
      }
    }
  }, [fileUploadId, onLoad, onError])

  return (
    <div className={cn('relative w-full h-full bg-[rgba(0,0,0,0.3)]', className)}>
      {/* Индикатор загрузки */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.5)] z-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <p className="text-white text-sm">Загрузка 3D модели...</p>
          </div>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.5)] z-10">
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto p-6 bg-red-500/10 border border-red-500/50 rounded-lg">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-red-400 text-center">{error}</p>
          </div>
        </div>
      )}

      {/* Контейнер для viewer */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />
    </div>
  )
}

