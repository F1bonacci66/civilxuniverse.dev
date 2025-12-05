// API клиент для 3D Viewer

import { getAuthHeaders } from './auth'
import { apiGet } from './client'

// Используем прямой URL к backend
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/datalab'
const API_BASE_URL = rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1') 
  ? '/api/datalab'  // Используем относительный путь для проксирования
  : rawApiUrl       // Используем полный URL для production

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
    properties: Record<string, any>
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
  const url = `${API_BASE_URL}/viewer/${fileUploadId}/xkt`
  
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
 */
export async function getMetadata(fileUploadId: string): Promise<ViewerMetadata> {
  const url = `${API_BASE_URL}/viewer/${fileUploadId}/metadata`
  
  const response = await apiGet<ViewerMetadata>(url)
  return response
}

/**
 * Получить статус конвертации XKT
 */
export async function getViewerStatus(fileUploadId: string): Promise<ViewerStatus> {
  const url = `${API_BASE_URL}/viewer/${fileUploadId}/status`
  
  const response = await apiGet<ViewerStatus>(url)
  return response
}

/**
 * Создать набор элементов для 3D Viewer
 */
export async function createViewerGroup(
  fileUploadId: string,
  group: ViewerGroupCreate
): Promise<ViewerGroup> {
  const url = `${API_BASE_URL}/viewer/${fileUploadId}/groups`
  
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
  const url = new URL(`${API_BASE_URL}/viewer/${fileUploadId}/groups`)
  if (userId) {
    url.searchParams.append('user_id', userId)
  }
  
  const response = await apiGet<ViewerGroup[]>(url.toString())
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
  const url = `${API_BASE_URL}/viewer/${fileUploadId}/groups/${groupId}`
  
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
  const url = new URL(`${API_BASE_URL}/viewer/${fileUploadId}/groups/${groupId}`)
  url.searchParams.append('user_id', userId)
  
  const response = await fetch(url.toString(), {
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

