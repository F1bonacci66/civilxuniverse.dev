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
      const response = await getProjectConversions(projectId, {
        versionId,
        limit,
        activeOnly,
      })
      setData(response)
      setError(null)
    } catch (err) {
      console.error('Ошибка получения статусов конвертации:', err)
      setError(err instanceof Error ? err.message : 'Не удалось получить статусы конвертации')
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




