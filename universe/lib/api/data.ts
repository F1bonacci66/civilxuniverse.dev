/**
 * API клиент для работы с данными CSV
 */
import { apiDelete, isAuthError } from './client'
// Если API URL указывает на localhost, используем относительный путь для проксирования через Next.js
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/datalab'
const API_BASE_URL = rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1') 
  ? '/api/datalab'  // Используем относительный путь для проксирования
  : rawApiUrl       // Используем полный URL для production

export interface CSVDataRow {
  id: string
  fileUploadId: string
  userId: string
  projectId: string
  versionId: string
  rowNumber: number
  modelName: string | null
  elementId: string | null
  category: string | null
  parameterName: string | null
  parameterValue: string | null
  data: any
  createdAt: string | null
}

export interface CSVDataResponse {
  total: number
  limit: number
  offset: number
  hasMore: boolean
  data: CSVDataRow[]
}

export interface CSVDataFilters {
  fileUploadId?: string
  userId?: string
  projectId?: string
  versionId?: string
  category?: string
  parameterName?: string
  elementId?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
  distinctOnly?: boolean
}

export interface CSVDistinctFiltersResponse {
  categories: string[]
  parameters: string[]
  total: number
}

export interface CSVStatistics {
  totalRows: number
  uniqueElements: number
  uniqueCategories: number
  uniqueParameters: number
}

export interface DeleteProjectVersionDataResult {
  success: boolean
  message?: string
  deletedFiles?: number
  deletedIfcs?: number
  deletedCsv?: number
  deletedRows?: number
}

/**
 * Получить данные CSV с фильтрацией, сортировкой и пагинацией
 */
export async function getCSVData(filters: CSVDataFilters = {}): Promise<CSVDataResponse> {
  const params = new URLSearchParams()
  
  if (filters.fileUploadId) params.append('file_upload_id', filters.fileUploadId)
  if (filters.userId) params.append('user_id', filters.userId)
  if (filters.projectId) params.append('project_id', filters.projectId)
  if (filters.versionId) params.append('version_id', filters.versionId)
  if (filters.category) params.append('category', filters.category)
  if (filters.parameterName) params.append('parameter_name', filters.parameterName)
  if (filters.elementId) params.append('element_id', filters.elementId)
  if (filters.search) params.append('search', filters.search)
  if (filters.sortBy) params.append('sort_by', filters.sortBy)
  if (filters.sortOrder) params.append('sort_order', filters.sortOrder)
  if (filters.limit) params.append('limit', filters.limit.toString())
  if (filters.offset) params.append('offset', filters.offset.toString())
  if (filters.distinctOnly) params.append('distinct_only', 'true')
  
  const url = `${API_BASE_URL}/data?${params.toString()}`
  
  console.log('📡 Запрос CSV данных:', url)
  
  const response = await fetch(url)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Ошибка получения CSV данных:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    })
    throw new Error(`Failed to fetch CSV data: ${response.status} ${response.statusText}`)
  }
  
  const result = await response.json()
  console.log('📦 Ответ API:', {
    total: result.total,
    dataLength: result.data?.length || 0,
  })
  
  // Если запрашивались только уникальные значения (distinct_only)
  if (filters.distinctOnly && (result.categories || result.parameters)) {
    return result as any
  }
  
  // Преобразуем snake_case в camelCase
  return {
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    hasMore: result.has_more || false,
    data: result.data.map((row: any) => ({
      id: row.id,
      fileUploadId: row.file_upload_id,
      userId: row.user_id,
      projectId: row.project_id,
      versionId: row.version_id,
      rowNumber: row.row_number,
      modelName: row.model_name,
      elementId: row.element_id,
      category: row.category,
      parameterName: row.parameter_name,
      parameterValue: row.parameter_value,
      data: row.data,
      createdAt: row.created_at,
    })),
  }
}

/**
 * Получить список уникальных параметров (parameter_name) для unpivot
 */
export async function getAvailableParameters(filters: {
  fileUploadId?: string
  userId?: string
  projectId?: string
  versionId?: string
}): Promise<string[]> {
  const params = new URLSearchParams()
  
  if (filters.fileUploadId) params.append('file_upload_id', filters.fileUploadId)
  if (filters.userId) params.append('user_id', filters.userId)
  if (filters.projectId) params.append('project_id', filters.projectId)
  if (filters.versionId) params.append('version_id', filters.versionId)
  params.append('distinct_only', 'true')
  
  const url = `${API_BASE_URL}/data?${params.toString()}`
  
  console.log('📡 Запрос уникальных параметров:', url)
  
  const response = await fetch(url)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Ошибка получения параметров:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    })
    throw new Error(`Failed to fetch parameters: ${response.status} ${response.statusText}`)
  }
  
  const result = await response.json()
  
  // Когда distinctOnly=true, API возвращает { categories, parameters, total }
  if (result.parameters && Array.isArray(result.parameters)) {
    return result.parameters
  }
  
  // Fallback: если формат не тот, возвращаем пустой массив
  console.warn('⚠️ Неожиданный формат ответа для параметров:', result)
  return []
}

/**
 * Получить статистику по CSV данным
 */
export async function getCSVStatistics(fileUploadId: string): Promise<CSVStatistics> {
  const url = `${API_BASE_URL}/upload/${fileUploadId}/data/statistics`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV statistics: ${response.statusText}`)
  }
  
  const result = await response.json()
  
  return {
    totalRows: result.total_rows || 0,
    uniqueElements: result.unique_elements || 0,
    uniqueCategories: result.unique_categories || 0,
    uniqueParameters: result.unique_parameters || 0,
  }
}

/**
 * Загрузить CSV данные в БД
 */
export async function loadCSVData(fileUploadId: string): Promise<{ success: boolean; rowsLoaded: number }> {
  const url = `${API_BASE_URL}/upload/${fileUploadId}/load-data`
  
  const response = await fetch(url, {
    method: 'POST',
  })
  
  if (!response.ok) {
    throw new Error(`Failed to load CSV data: ${response.statusText}`)
  }
  
  const result = await response.json()
  
  return {
    success: result.success,
    rowsLoaded: result.rows_loaded || 0,
  }
}

/**
 * Полностью удалить данные по проекту и версии (IFC, CSV, записи БД)
 */
export async function deleteProjectVersionData(
  projectId: string,
  versionId: string
): Promise<DeleteProjectVersionDataResult> {
  try {
    const payload = await apiDelete<any>(
      `/projects/${projectId}/versions/${versionId}/data`,
      60000 // 60 секунд таймаут для операции удаления
    )

    if (payload && typeof payload === 'object') {
      return {
        success: payload.success ?? true,
        message: payload.message || payload.detail,
        deletedFiles: payload.deletedFiles ?? payload.deleted_files,
        deletedIfcs: payload.deletedIfcs ?? payload.deleted_ifcs,
        deletedCsv: payload.deletedCsv ?? payload.deleted_csv,
        deletedRows: payload.deletedRows ?? payload.deleted_rows,
      }
    }

    return {
      success: true,
      message: undefined,
    }
  } catch (error: any) {
    // Если это ошибка авторизации, пробрасываем её дальше (редирект уже произошел)
    if (isAuthError(error)) {
      throw error
    }
    // Для остальных ошибок пробрасываем как есть
    throw error
  }
}

