// Утилита для параллельной загрузки файлов с лимитом параллелизма

import { uploadFile, getUploadProgress } from '../api/upload'
import type { UploadFileRequest, UploadFileResponse, UploadProgress } from '../types/upload'

export interface ParallelUploadOptions {
  /** Максимальное количество одновременных загрузок (по умолчанию 3) */
  concurrency?: number
  /** Сортировать файлы по размеру перед загрузкой (сначала маленькие) */
  sortBySize?: boolean
  /** Интервал опроса прогресса конвертации в мс (по умолчанию 2000) */
  pollInterval?: number
  /** Callback для обновления прогресса конкретного файла */
  onFileProgress?: (fileId: string, progress: UploadProgress) => void
  /** Callback для завершения загрузки файла */
  onFileComplete?: (fileId: string, result: UploadFileResponse) => void
  /** Callback для ошибки загрузки файла */
  onFileError?: (fileId: string, error: Error) => void
}

/**
 * Загружает файлы параллельно с ограничением количества одновременных загрузок
 */
export async function uploadFilesWithConcurrencyLimit(
  files: Array<{ id: string; file: File; request: Omit<UploadFileRequest, 'file'> }>,
  options: ParallelUploadOptions = {}
): Promise<Map<string, { success: boolean; result?: UploadFileResponse; error?: Error }>> {
  const {
    concurrency = 3,
    sortBySize = true,
    pollInterval = 2000,
    onFileProgress,
    onFileComplete,
    onFileError,
  } = options

  // Сортируем файлы по размеру (сначала маленькие для быстрого отклика UI)
  const sortedFiles = sortBySize
    ? [...files].sort((a, b) => a.file.size - b.file.size)
    : files

  const results = new Map<string, { success: boolean; result?: UploadFileResponse; error?: Error }>()
  const pollingIntervals = new Map<string, NodeJS.Timeout>()

  // Функция для очистки интервала опроса
  const cleanupPolling = (fileId: string) => {
    const interval = pollingIntervals.get(fileId)
    if (interval) {
      clearInterval(interval)
      pollingIntervals.delete(fileId)
    }
  }

  // Функция для запуска опроса прогресса конвертации
  const startPolling = (fileId: string, fileUploadId: string) => {
    // Очищаем предыдущий интервал, если есть
    cleanupPolling(fileId)

    const interval = setInterval(async () => {
      try {
        const progress = await getUploadProgress(fileUploadId)
        onFileProgress?.(fileId, progress)

        // Останавливаем опрос, если конвертация завершена
        if (
          !progress.conversionStatus ||
          progress.conversionStatus === 'completed' ||
          progress.conversionStatus === 'failed' ||
          progress.conversionStatus === 'cancelled'
        ) {
          cleanupPolling(fileId)
        }
      } catch (err) {
        console.error(`Ошибка получения прогресса для файла ${fileId}:`, err)
        // Не останавливаем опрос при ошибке - возможно временная проблема
      }
    }, pollInterval)

    pollingIntervals.set(fileId, interval)
  }

  // Функция для загрузки одного файла
  const uploadSingleFile = async (fileItem: typeof sortedFiles[0]): Promise<void> => {
    const { id: fileId, file, request } = fileItem

    try {
      // Устанавливаем начальный прогресс
      const initialProgress: UploadProgress = {
        fileUploadId: 'pending',
        uploadStatus: 'uploading' as any,
        uploadProgress: 0,
        conversionStatus: undefined,
        conversionProgress: 0,
      }
      onFileProgress?.(fileId, initialProgress)

      // Загружаем файл
      const result = await uploadFile({
        ...request,
        file,
      })

      // Обновляем прогресс после загрузки
      const uploadCompleteProgress: UploadProgress = {
        fileUploadId: result.fileUpload.id,
        uploadStatus: result.fileUpload.uploadStatus as any,
        uploadProgress: 100,
        conversionStatus: result.conversionJob?.status as any,
        conversionProgress: result.conversionJob?.progress || 0,
      }
      onFileProgress?.(fileId, uploadCompleteProgress)

      // Если есть задача конвертации, начинаем отслеживать её прогресс
      if (result.conversionJob) {
        startPolling(fileId, result.fileUpload.id)
      }

      results.set(fileId, { success: true, result })
      onFileComplete?.(fileId, result)
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Ошибка загрузки')
      results.set(fileId, { success: false, error: err })
      onFileError?.(fileId, err)
      cleanupPolling(fileId)
    }
  }

  // Реализуем пул параллельных загрузок
  const queue: typeof sortedFiles = []
  let activeUploads = 0
  let currentIndex = 0

  // Функция для запуска следующей загрузки
  const startNext = async (): Promise<void> => {
    if (currentIndex >= sortedFiles.length || activeUploads >= concurrency) {
      return
    }

    const fileItem = sortedFiles[currentIndex]
    currentIndex++
    activeUploads++

    try {
      await uploadSingleFile(fileItem)
    } finally {
      activeUploads--
      // Запускаем следующую загрузку
      await startNext()
    }
  }

  // Запускаем начальные загрузки
  const initialPromises: Promise<void>[] = []
  for (let i = 0; i < Math.min(concurrency, sortedFiles.length); i++) {
    initialPromises.push(startNext())
  }

  // Ждем завершения всех загрузок
  await Promise.all(initialPromises)

  // Очищаем все интервалы опроса
  pollingIntervals.forEach((interval) => clearInterval(interval))
  pollingIntervals.clear()

  return results
}

