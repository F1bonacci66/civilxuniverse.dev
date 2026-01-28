import { useCallback, useEffect, useRef, useState } from 'react'
import { getProjectConversions } from '@/lib/api/upload'
import type { ProjectConversionStatus } from '@/lib/types/upload'

interface Options {
  versionId?: string
  pollInterval?: number
  limit?: number
  activeOnly?: boolean
  enabled?: boolean
}

export function useProjectConversions(
  projectId?: string,
  {
    versionId,
    pollInterval = 5000,
    limit = 20,
    activeOnly = false,
    enabled = true,
  }: Options = {}
) {
  const [data, setData] = useState<ProjectConversionStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async () => {
    if (!projectId || !enabled) {
      setData([])
      return
    }
    try {
      setLoading(true)
      console.log('[useConversionMonitor] Запрос статусов конвертации:', {
        projectId,
        versionId,
        limit,
        activeOnly,
      })
      const response = await getProjectConversions(projectId, {
        versionId,
        limit,
        activeOnly,
      })
      console.log('[useConversionMonitor] Получены статусы конвертации:', {
        count: response.length,
        statuses: response.map(s => ({
          jobId: s.job.id,
          fileName: s.file.originalFilename,
          conversionType: s.job.conversionType,
          status: s.job.status,
        })),
      })
      setData(response)
      setError(null)
    } catch (err: any) {
      console.error('Ошибка получения статусов конвертации:', err)
      // Игнорируем ошибки авторизации - редирект уже произошел
      if (err.isAuthRedirect) {
        return
      }
      // При ошибках соединения (ERR_CONNECTION_RESET, ERR_CONNECTION_REFUSED) не сбрасываем данные
      // Это нормально при загрузке больших файлов, когда фронтенд может быть временно недоступен
      const isConnectionError = err.message?.includes('Failed to fetch') || 
                                err.message?.includes('ERR_CONNECTION_RESET') ||
                                err.message?.includes('ERR_CONNECTION_REFUSED') ||
                                err.name === 'TypeError'
      if (isConnectionError) {
        // При ошибке соединения не показываем ошибку пользователю и не сбрасываем данные
        // Последние известные данные остаются отображенными
        console.warn('Ошибка соединения при получении статусов конвертации, используем последние известные данные:', err.message)
        // Не устанавливаем ошибку и не сбрасываем данные
        return
      }
      // Для других ошибок показываем сообщение, но не сбрасываем данные
      setError(err instanceof Error ? err.message : 'Не удалось получить статусы конвертации')
      // Не сбрасываем data - оставляем последние известные данные
    } finally {
      setLoading(false)
    }
  }, [projectId, versionId, limit, activeOnly, enabled])

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    fetchData()
    if (!projectId || !enabled) {
      stopPolling()
      return
    }
    pollRef.current = setInterval(fetchData, pollInterval)
    return () => {
      stopPolling()
    }
  }, [projectId, versionId, pollInterval, fetchData, enabled])

  return {
    data,
    loading,
    error,
    refresh: fetchData,
  }
}






