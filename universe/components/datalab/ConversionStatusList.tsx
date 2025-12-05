'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { Activity, FileText, Loader2, ScrollText, RefreshCw, AlertCircle, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useProjectConversions } from '@/lib/hooks/useConversionMonitor'
import { getConversionLogs, downloadFile, getQueueStatus } from '@/lib/api/upload'
import type { ConversionLog, ProjectConversionStatus, QueueStatus } from '@/lib/types/upload'

interface ConversionStatusListProps {
  projectId?: string
  versionId?: string
  pollInterval?: number
  activeOnly?: boolean
  className?: string
  limit?: number
  title?: string
}

export function ConversionStatusList({
  projectId,
  versionId,
  pollInterval = 5000,
  activeOnly = false,
  className,
  limit = 20,
  title = 'Статусы конвертации',
}: ConversionStatusListProps) {
  const [selectedJob, setSelectedJob] = useState<ProjectConversionStatus | null>(null)
  const [logs, setLogs] = useState<ConversionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  
  // Состояние для статуса очереди
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [queueStatusError, setQueueStatusError] = useState<string | null>(null)
  
  // Отслеживаем уже загруженные файлы, чтобы не загружать их повторно
  const downloadedFilesRef = useRef<Set<string>>(new Set())
  // Отслеживаем, была ли уже первая загрузка данных
  const hasLoadedOnceRef = useRef<boolean>(false)

  const {
    data: statuses,
    loading,
    error,
    refresh,
  } = useProjectConversions(projectId, {
    versionId,
    pollInterval,
    activeOnly,
    limit,
    enabled: Boolean(projectId),
  })

  // Отслеживаем первую загрузку данных
  useEffect(() => {
    if (!loading && statuses !== undefined) {
      hasLoadedOnceRef.current = true
    }
  }, [loading, statuses])

  useEffect(() => {
    setSelectedJob(null)
    setLogs([])
    setLogsError(null)
    // Сбрасываем список загруженных файлов при смене проекта/версии
    downloadedFilesRef.current.clear()
    // Сбрасываем флаг первой загрузки при смене проекта/версии
    hasLoadedOnceRef.current = false
  }, [projectId, versionId])

  // Обновление статуса очереди каждые 5 секунд
  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        setQueueStatusError(null)
        const status = await getQueueStatus()
        setQueueStatus(status)
      } catch (err: any) {
        console.error('Ошибка получения статуса очереди:', err)
        // Игнорируем ошибки авторизации - редирект уже произошел
        if (err.isAuthRedirect) {
          return
        }
        // При таймауте не сбрасываем статус - оставляем последний известный
        // Это позволяет продолжать показывать актуальную информацию даже при временных проблемах
        const isTimeout = err.message?.includes('таймаут') || err.message?.includes('timeout')
        if (isTimeout) {
          // При таймауте не показываем ошибку пользователю, просто пропускаем обновление
          // Последний известный статус остается отображенным
          console.warn('Таймаут при получении статуса очереди, используем последний известный статус')
          return
        }
        // Для других ошибок показываем сообщение, но не сбрасываем статус
        setQueueStatusError(err.message || 'Не удалось получить статус очереди')
        // Не сбрасываем queueStatus - оставляем последний известный статус
      }
    }

    // Загружаем сразу
    fetchQueueStatus()

    // Обновляем каждые 5 секунд
    const interval = setInterval(fetchQueueStatus, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  // Автоматическая загрузка CSV после завершения конвертации
  useEffect(() => {
    if (!statuses || statuses.length === 0) return

    statuses.forEach((item) => {
      const job = item.job
      
      // Проверяем, что конвертация завершена и есть outputFileId
      if (
        job.status === 'completed' &&
        job.outputFileId &&
        !downloadedFilesRef.current.has(job.id)
      ) {
        // Помечаем файл как загруженный, чтобы не загружать повторно
        downloadedFilesRef.current.add(job.id)
        
        const filename = `${item.file.originalFilename.replace(/\.[^/.]+$/, '')}_converted.csv`
        console.log('[ConversionStatusList] Автоматическая загрузка CSV:', {
          jobId: job.id,
          outputFileId: job.outputFileId,
          filename,
        })
        
        // Автоматически загружаем CSV файл
        downloadFile(job.outputFileId, filename)
          .then(() => {
            console.log('[ConversionStatusList] CSV файл успешно загружен:', filename)
            // Показываем уведомление пользователю (можно добавить toast)
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('CSV файл загружен', {
                body: `Файл ${filename} успешно скачан`,
                icon: '/favicon.ico',
              })
            }
          })
          .catch((err) => {
            console.error('[ConversionStatusList] Ошибка автоматической загрузки CSV:', err)
            // Удаляем из списка загруженных, чтобы можно было попробовать снова
            downloadedFilesRef.current.delete(job.id)
            // Показываем ошибку пользователю
            alert(`Не удалось автоматически загрузить CSV файл. Попробуйте скачать вручную.\n\nОшибка: ${err.message}`)
          })
      }
    })
  }, [statuses])

  const openLogs = async (item: ProjectConversionStatus) => {
    try {
      setSelectedJob(item)
      setLogsError(null)
      setLogs([])
      setLogsLoading(true)
      const response = await getConversionLogs(item.job.id)
      setLogs(response)
    } catch (err) {
      setLogsError(err instanceof Error ? err.message : 'Не удалось получить логи')
    } finally {
      setLogsLoading(false)
    }
  }

  const closeLogs = () => {
    setSelectedJob(null)
    setLogs([])
    setLogsError(null)
  }

  const handleDownloadCSV = async (item: ProjectConversionStatus) => {
    if (!item.job.outputFileId) {
      alert('CSV файл ещё не готов для скачивания')
      return
    }

    try {
      const filename = `${item.file.originalFilename.replace(/\.[^/.]+$/, '')}_converted.csv`
      console.log('[ConversionStatusList] Ручная загрузка CSV:', {
        jobId: item.job.id,
        outputFileId: item.job.outputFileId,
        filename,
      })
      await downloadFile(item.job.outputFileId, filename)
      console.log('[ConversionStatusList] CSV файл успешно загружен вручную:', filename)
    } catch (err) {
      console.error('[ConversionStatusList] Ошибка ручной загрузки CSV:', err)
      alert(`Не удалось загрузить CSV файл.\n\nОшибка: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return 'text-primary-400 bg-primary-500/10 border-primary-500/40'
      case 'queued':
      case 'pending':
        return 'text-amber-300 bg-amber-400/10 border-amber-400/30'
      case 'completed':
        return 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30'
      case 'failed':
        return 'text-red-300 bg-red-500/10 border-red-500/30'
      case 'cancelled':
        return 'text-slate-300 bg-slate-500/10 border-slate-500/30'
      default:
        return 'text-slate-200 bg-slate-500/10 border-slate-500/30'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'processing':
        return 'Обработка'
      case 'queued':
        return 'В очереди'
      case 'pending':
        return 'Ожидание'
      case 'completed':
        return 'Готово'
      case 'failed':
        return 'Ошибка'
      case 'cancelled':
        return 'Отменено'
      default:
        return status
    }
  }

  const visibleStatuses = useMemo(() => statuses, [statuses])

  // Определяем статус нагрузки
  const getLoadStatus = () => {
    if (queueStatusError) {
      return {
        text: 'Ошибка',
        className: 'text-red-300 bg-red-500/10 border-red-500/40',
      }
    }

    if (!queueStatus) {
      return null
    }

    // Преобразуем значения в числа для надежности
    const queuedCount = Number(queueStatus.queuedCount) || 0
    const processingCount = Number(queueStatus.processingCount) || 0
    const availableSlots = queueStatus.availableSlots !== null ? Number(queueStatus.availableSlots) : null
    const windowsServerBusy = queueStatus.windowsServerBusy === true

    // Высокая нагрузка, если:
    // 1. Нет доступных слотов (availableSlots === 0) - основной триггер
    // 2. Windows сервер занят (windowsServerBusy === true) - для обратной совместимости
    // 3. Есть задачи в очереди (queuedCount > 0)
    // 4. Есть активные задачи конвертации (processingCount > 0) - если availableSlots недоступен
    const isHighLoad = 
      (availableSlots !== null && availableSlots === 0) ||
      windowsServerBusy || 
      queuedCount > 0 ||
      (availableSlots === null && processingCount > 0)

    if (isHighLoad) {
      return {
        text: 'Высокая нагрузка',
        className: 'text-amber-300 bg-amber-400/10 border-amber-400/30',
      }
    }

    return {
      text: 'Нормальная нагрузка',
      className: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30',
    }
  }

  const loadStatus = getLoadStatus()

  return (
    <div
      className={cn(
        'bg-[rgba(0,0,0,0.6)] backdrop-blur-xl rounded-2xl border border-white/10 p-6',
        className
      )}
    >
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm uppercase tracking-wider text-primary-400">{title}</p>
            <h3 className="text-2xl font-semibold text-white">Конвертации проекта</h3>
          </div>
          {loadStatus && (
            <div
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-semibold',
                loadStatus.className
              )}
            >
              {loadStatus.text}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="h-9 border-white/20 text-white hover:text-primary-400 hover:border-primary-400/60"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {projectId ? (
        loading && !hasLoadedOnceRef.current ? (
          <div className="flex items-center justify-center py-12 text-white/60">
            <Loader2 className="w-6 h-6 mr-3" />
            Загружаем статусы...
          </div>
        ) : visibleStatuses.length === 0 ? (
          <div className="py-8 text-center text-white/60">
            <Activity className="w-8 h-8 mx-auto mb-3 text-primary-400" />
            Пока нет задач конвертации
          </div>
        ) : (
          <div className="space-y-4">
            {visibleStatuses.map((item) => (
              <div
                key={item.job.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary-400" />
                      <p className="text-white font-medium">
                        {item.file.originalFilename}
                      </p>
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                      {formatFileSize(item.file.fileSize)} · Версия {item.file.versionId.slice(0, 8)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold',
                      statusBadge(item.job.status)
                    )}
                  >
                    {statusLabel(item.job.status)}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-white/60 mb-2">
                    <span>{item.currentStep || 'Ожидание'}</span>
                    <span>{item.job.progress ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all duration-500',
                        item.job.status === 'failed'
                          ? 'bg-red-500'
                          : item.job.status === 'completed'
                            ? 'bg-emerald-400'
                            : 'bg-primary-400'
                      )}
                      style={{ width: `${Math.min(item.job.progress ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-white/60">
                  <div>
                    {item.job.startedAt && (
                      <p>
                        Старт:{' '}
                        <span className="text-white/80">
                          {new Date(item.job.startedAt).toLocaleString()}
                        </span>
                      </p>
                    )}
                    {item.job.completedAt && (
                      <p>
                        Завершено:{' '}
                        <span className="text-white/80">
                          {new Date(item.job.completedAt).toLocaleString()}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.job.status === 'completed' && item.job.outputFileId && (
                      <button
                        onClick={() => handleDownloadCSV(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300 hover:text-emerald-200 hover:border-emerald-400/60 hover:bg-emerald-400/20 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Скачать CSV
                      </button>
                    )}
                    <button
                      onClick={() => openLogs(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/80 hover:text-primary-300 hover:border-primary-400/60 transition-colors"
                    >
                      <ScrollText className="w-3.5 h-3.5" />
                      Логи
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="py-6 text-center text-white/50 text-sm">
          Выберите проект, чтобы отслеживать конвертации
        </div>
      )}

  {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-[#050505] shadow-[0_25px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-sm uppercase tracking-wide text-primary-400">Логи конвертации</p>
                <h4 className="text-xl font-semibold text-white">
                  {selectedJob.file.originalFilename}
                </h4>
              </div>
              <button
                onClick={closeLogs}
                className="text-white/60 hover:text-white text-sm"
              >
                Закрыть
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-3">
              {logsLoading ? (
                <div className="flex items-center justify-center text-white/60 py-8 text-sm">
                  <Loader2 className="w-4 h-4 mr-2" />
                  Загружаем логи...
                </div>
              ) : logsError ? (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  {logsError}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-sm text-white/60 py-6 text-center">
                  Логи отсутствуют
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm text-white/80"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1 text-xs text-white/50">
                      <span>{formatDate(log.createdAt)}</span>
                      <span className="font-semibold uppercase tracking-wide">
                        {log.logLevel}
                      </span>
                    </div>
                    <p>{log.message}</p>
                    {log.metadata && (
                      <pre className="mt-2 rounded bg-black/40 p-2 text-xs text-white/60 overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const formatFileSize = (bytes: number) => {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

