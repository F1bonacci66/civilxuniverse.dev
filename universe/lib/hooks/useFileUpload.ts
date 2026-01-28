// React hook для управления загрузкой файлов

import { useState, useCallback, useEffect, useRef } from 'react'
import { uploadFile, getUploadProgress } from '../api/upload'
import type { UploadProgress, UploadFileRequest } from '../types/upload'

interface UseFileUploadOptions {
  onProgress?: (progress: UploadProgress) => void
  onComplete?: (result: Awaited<ReturnType<typeof uploadFile>>) => void
  onError?: (error: Error) => void
  pollInterval?: number // интервал опроса статуса в мс (по умолчанию 2000)
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { onProgress, onComplete, onError, pollInterval = 2000 } = options

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Очистка интервала при размонтировании
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const startPolling = useCallback(
    (fileUploadId: string) => {
      // Останавливаем предыдущий опрос, если есть
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const progress = await getUploadProgress(fileUploadId)
          setUploadProgress(progress)
          onProgress?.(progress)

          // Останавливаем опрос, если конвертация завершена или её нет
          if (
            !progress.conversionStatus ||
            progress.conversionStatus === 'completed' ||
            progress.conversionStatus === 'failed' ||
            progress.conversionStatus === 'cancelled'
          ) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
          }
        } catch (err) {
          console.error('Ошибка получения прогресса:', err)
          // Не останавливаем опрос при ошибке - возможно временная проблема
        }
      }, pollInterval)
    },
    [onProgress, pollInterval]
  )

  const upload = useCallback(
    async (request: UploadFileRequest) => {
      setIsUploading(true)
      setError(null)
      setUploadProgress(undefined)

      // Устанавливаем начальный статус загрузки
      const initialProgress: UploadProgress = {
        fileUploadId: 'pending',
        uploadStatus: 'uploading' as any,
        uploadProgress: 0,
        conversionStatus: undefined,
        conversionProgress: 0,
      }
      setUploadProgress(initialProgress)
      onProgress?.(initialProgress)

      try {
        console.log('Начинаем загрузку файла, размер:', request.file.size, 'байт')
        // Загружаем файл
        const result = await uploadFile(request)
        console.log('Файл успешно загружен, результат:', result)
        
        const progress: UploadProgress = {
          fileUploadId: result.fileUpload.id,
          uploadStatus: result.fileUpload.uploadStatus as any,
          uploadProgress: 100,
          conversionStatus: result.conversionJob?.status as any,
          conversionProgress: result.conversionJob?.progress || 0,
        }
        setUploadProgress(progress)
        onProgress?.(progress)

        // Если есть задача конвертации, начинаем отслеживать её прогресс
        if (result.conversionJob) {
          startPolling(result.fileUpload.id)
        }

        onComplete?.(result)
        return result
      } catch (err) {
        console.error('Ошибка при загрузке:', err)
        const error = err instanceof Error ? err : new Error('Ошибка загрузки')
        setError(error)
        onError?.(error)
        throw error
      } finally {
        setIsUploading(false)
      }
    },
    [onComplete, onError, onProgress, startPolling]
  )

  return {
    upload,
    isUploading,
    uploadProgress,
    error,
  }
}

