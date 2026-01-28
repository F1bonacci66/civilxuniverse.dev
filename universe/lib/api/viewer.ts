// API клиент для 3D Viewer

import { getAuthHeaders } from './auth'
import { apiGet, getApiClient } from './client'

// Используем API_BASE_URL из client.ts для единообразия
const { baseURL: API_BASE_URL } = getApiClient()

// Типы для Viewer
export interface ViewerStatus {
  xkt_conversion_status: 'pending' | 'processing' | 'completed' | 'failed' | null
  xkt_file_path: string | null
  metadata_file_path: string | null
  has_xkt: boolean
  has_metadata: boolean
}

export interface ViewerMetadata {
  file_upload_id: string | null
  model_name: string
  elements: Record<string, {
    category: string
    family: string | null
    type: string | null
    properties?: Record<string, any>  // Новый формат
    parameters?: Record<string, any>   // Старый формат (для совместимости)
    revit_element_id?: string | null   // ID элемента из исходной RVT модели
  }>
}

export interface ViewerGroup {
  id: string
  file_upload_id: string
  user_id: string
  name: string
  description: string | null
  element_ids: string[]
  created_at: string
  updated_at: string
}

export interface ViewerGroupCreate {
  name: string
  description?: string
  element_ids: string[]
  user_id: string
}

export interface ViewerGroupUpdate {
  name?: string
  description?: string
  element_ids?: string[]
  user_id: string
}

/**
 * Получить XKT файл для 3D визуализации
 */
export async function getXKTFile(fileUploadId: string): Promise<Blob> {
  // Используем apiRequest для единообразия, но получаем Blob
  const endpoint = `/viewer/${fileUploadId}/xkt`
  const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '')
  const cleanEndpoint = endpoint.replace(/\/$/, '')
  const url = `${cleanBaseUrl}${cleanEndpoint}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      // Редирект на авторизацию
      window.location.href = '/auth/login'
      throw new Error('Требуется авторизация')
    }
    throw new Error(`Ошибка получения XKT файла: ${response.statusText}`)
  }

  return response.blob()
}

/**
 * Получить metadata.json для 3D визуализации
 * Объединяет данные из IFC (3D вид) с данными из RVT (параметры элементов)
 * 
 * @param fileUploadId - ID загруженного файла (RVT или IFC)
 * @param projectId - ID проекта для загрузки RVT данных (опционально)
 * @param versionId - ID версии для загрузки RVT данных (опционально)
 */
export async function getMetadata(
  fileUploadId: string,
  projectId?: string,
  versionId?: string
): Promise<ViewerMetadata> {
  // apiGet уже добавляет API_BASE_URL, поэтому используем только endpoint
  let endpoint = `/viewer/${fileUploadId}/metadata`
  
  // Добавляем query параметры, если переданы projectId и versionId
  const params = new URLSearchParams()
  if (projectId) {
    params.append('project_id', projectId)
  }
  if (versionId) {
    params.append('version_id', versionId)
  }
  
  if (params.toString()) {
    endpoint += `?${params.toString()}`
  }
  
  console.log('🔵 [Viewer] Запрос metadata:', { fileUploadId, projectId, versionId, endpoint })
  
  const response = await apiGet<ViewerMetadata>(endpoint)
  return response
}

/**
 * Получить статус конвертации XKT
 */
export async function getViewerStatus(fileUploadId: string): Promise<ViewerStatus> {
  // apiGet уже добавляет API_BASE_URL, поэтому используем только endpoint
  const endpoint = `/viewer/${fileUploadId}/status`
  
  const response = await apiGet<ViewerStatus>(endpoint)
  return response
}

/**
 * Создать набор элементов для 3D Viewer
 */
export async function createViewerGroup(
  fileUploadId: string,
  group: ViewerGroupCreate
): Promise<ViewerGroup> {
  // Используем прямой fetch для POST запроса
  const endpoint = `/viewer/${fileUploadId}/groups`
  const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '')
  const cleanEndpoint = endpoint.replace(/\/$/, '')
  const url = `${cleanBaseUrl}${cleanEndpoint}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(group),
  })

  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = '/auth/login'
      throw new Error('Требуется авторизация')
    }
    const errorText = await response.text()
    throw new Error(`Ошибка создания набора: ${errorText}`)
  }

  return response.json()
}

/**
 * Получить список наборов элементов для 3D Viewer
 */
export async function getViewerGroups(
  fileUploadId: string,
  userId?: string
): Promise<ViewerGroup[]> {
  // apiGet уже добавляет API_BASE_URL, поэтому используем только endpoint
  let endpoint = `/viewer/${fileUploadId}/groups`
  if (userId) {
    endpoint += `?user_id=${encodeURIComponent(userId)}`
  }
  
  const response = await apiGet<ViewerGroup[]>(endpoint)
  return response
}

/**
 * Обновить набор элементов для 3D Viewer
 */
export async function updateViewerGroup(
  fileUploadId: string,
  groupId: string,
  group: ViewerGroupUpdate
): Promise<ViewerGroup> {
  // Используем apiRequest для единообразия
  const endpoint = `/viewer/${fileUploadId}/groups/${groupId}`
  const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '')
  const cleanEndpoint = endpoint.replace(/\/$/, '')
  const url = `${cleanBaseUrl}${cleanEndpoint}`
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(group),
  })

  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = '/auth/login'
      throw new Error('Требуется авторизация')
    }
    const errorText = await response.text()
    throw new Error(`Ошибка обновления набора: ${errorText}`)
  }

  return response.json()
}

/**
 * Удалить набор элементов для 3D Viewer
 */
export async function deleteViewerGroup(
  fileUploadId: string,
  groupId: string,
  userId: string
): Promise<void> {
  // Используем прямой fetch для DELETE запроса
  const endpoint = `/viewer/${fileUploadId}/groups/${groupId}?user_id=${encodeURIComponent(userId)}`
  const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '')
  const cleanEndpoint = endpoint.replace(/\/$/, '')
  const url = `${cleanBaseUrl}${cleanEndpoint}`
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = '/auth/login'
      throw new Error('Требуется авторизация')
    }
    const errorText = await response.text()
    throw new Error(`Ошибка удаления набора: ${errorText}`)
  }
}


