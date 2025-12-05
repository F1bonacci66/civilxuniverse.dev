/**
 * Базовый API client с поддержкой JWT аутентификации
 */
import { getAuthHeaders, getAuthToken, redirectToAuth, removeAuthToken } from './auth'

// Используем относительный путь для API на том же домене (civilxuniverse.ru)
// Это решает проблемы с CORS и не требует отдельного домена для API
const defaultApiUrl =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000/api/datalab'
    : '/api/datalab'

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || defaultApiUrl
const API_BASE_URL = rawApiUrl.startsWith('http') ? rawApiUrl : '/api/datalab'

/**
 * Получить базовый URL API клиента
 */
export function getApiClient() {
  return {
    baseURL: API_BASE_URL,
  }
}

/**
 * Функция для выполнения fetch с таймаутом и автоматической авторизацией
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Получаем заголовки с токеном
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  }

  try {
    // Убираем trailing slash из endpoint, если он есть (Next.js может добавлять его из-за trailingSlash: true)
    // Также убираем trailing slash из API_BASE_URL для гарантии
    const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '')
    const cleanEndpoint = endpoint.replace(/\/$/, '')
    const url = `${cleanBaseUrl}${cleanEndpoint}`
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Если токен истек или невалиден, редиректим на авторизацию
    if (response.status === 401 || response.status === 403) {
      // Проверяем, является ли 403 ошибкой авторизации (а не прав доступа)
      let isAuthError = response.status === 401
      
      if (response.status === 403) {
        // Пытаемся прочитать сообщение об ошибке
        try {
          const errorText = await response.clone().text()
          const errorMessage = errorText.toLowerCase()
          // Если сообщение содержит "authenticated", "credentials", "token" или "authorization" - это ошибка авторизации
          if (
            errorMessage.includes('not authenticated') ||
            errorMessage.includes('credentials') ||
            errorMessage.includes('token') ||
            errorMessage.includes('authorization') ||
            errorMessage.includes('требуется авторизация') ||
            errorMessage.includes('неверные учетные данные')
          ) {
            isAuthError = true
          }
        } catch {
          // Если не удалось прочитать ошибку, считаем 403 ошибкой авторизации для безопасности
          isAuthError = true
        }
      }
      
      if (isAuthError) {
        // Всегда удаляем токен при 401/403 (он невалиден или истек)
        removeAuthToken()
        // Всегда редиректим на авторизацию при 401/403
        redirectToAuth()
        // Не бросаем ошибку - редирект уже произошел, пользователь будет перенаправлен
        // Бросаем специальную ошибку, которая будет игнорироваться в компонентах
        const redirectError = new Error('Требуется авторизация')
        ;(redirectError as any).isAuthRedirect = true
        throw redirectError
      }
    }

    // Если статус 204 (No Content), ответ не имеет тела - возвращаем null сразу
    // ВАЖНО: проверяем ДО проверки response.ok, чтобы не пытаться читать тело
    if (response.status === 204) {
      return null as T
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Ошибка: ${response.statusText}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.detail || errorData.message || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      throw new Error(errorMessage)
    }

    // Читаем тело ответа один раз
    const text = await response.text()
    
    // Если тело пустое, возвращаем null (не пытаемся парсить JSON)
    if (!text || text.trim() === '') {
      return null as T
    }

    // Проверяем content-type для JSON ответов
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      // Если не JSON, возвращаем null
      return null as T
    }

    // Парсим JSON ответ
    try {
      return JSON.parse(text) as T
    } catch (error) {
      // Если не удалось распарсить JSON, возвращаем null (не бросаем ошибку)
      console.warn('Failed to parse JSON response:', error, 'Response text:', text.substring(0, 100))
      return null as T
    }
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Запрос превысил таймаут (${timeoutMs}ms)`)
    }
    throw error
  }
}

/**
 * GET запрос
 */
export async function apiGet<T>(endpoint: string, timeoutMs = 30000): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET' }, timeoutMs)
}

/**
 * POST запрос
 */
export async function apiPost<T>(
  endpoint: string,
  data?: any,
  timeoutMs = 30000
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    },
    timeoutMs
  )
}

/**
 * PUT запрос
 */
export async function apiPut<T>(
  endpoint: string,
  data?: any,
  timeoutMs = 30000
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    },
    timeoutMs
  )
}

/**
 * DELETE запрос
 */
export async function apiDelete<T>(endpoint: string, timeoutMs = 30000): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE' }, timeoutMs)
}

/**
 * POST запрос для загрузки файлов (FormData)
 */
export async function apiPostFormData<T>(
  endpoint: string,
  formData: FormData,
  timeoutMs = 60000
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const token = getAuthToken()
  const headers: HeadersInit = {}
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // Не устанавливаем Content-Type для FormData - браузер сам установит с boundary

  try {
    // Убираем trailing slash из endpoint, если он есть (Next.js может добавлять его из-за trailingSlash: true)
    // Также убираем trailing slash из API_BASE_URL для гарантии
    const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '')
    const cleanEndpoint = endpoint.replace(/\/$/, '')
    const url = `${cleanBaseUrl}${cleanEndpoint}`
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Если токен истек или невалиден, редиректим на авторизацию
    if (response.status === 401 || response.status === 403) {
      // Проверяем, является ли 403 ошибкой авторизации (а не прав доступа)
      let isAuthError = response.status === 401
      
      if (response.status === 403) {
        // Пытаемся прочитать сообщение об ошибке
        try {
          const errorText = await response.clone().text()
          const errorMessage = errorText.toLowerCase()
          // Если сообщение содержит "authenticated", "credentials", "token" или "authorization" - это ошибка авторизации
          if (
            errorMessage.includes('not authenticated') ||
            errorMessage.includes('credentials') ||
            errorMessage.includes('token') ||
            errorMessage.includes('authorization') ||
            errorMessage.includes('требуется авторизация') ||
            errorMessage.includes('неверные учетные данные')
          ) {
            isAuthError = true
          }
        } catch {
          // Если не удалось прочитать ошибку, считаем 403 ошибкой авторизации для безопасности
          isAuthError = true
        }
      }
      
      if (isAuthError) {
        // Всегда удаляем токен при 401/403 (он невалиден или истек)
        removeAuthToken()
        // Всегда редиректим на авторизацию при 401/403
        redirectToAuth()
        // Не бросаем ошибку - редирект уже произошел, пользователь будет перенаправлен
        // Бросаем специальную ошибку, которая будет игнорироваться в компонентах
        const redirectError = new Error('Требуется авторизация')
        ;(redirectError as any).isAuthRedirect = true
        throw redirectError
      }
    }

    // Если статус 204 (No Content), ответ не имеет тела - возвращаем null сразу
    // ВАЖНО: проверяем ДО проверки response.ok, чтобы не пытаться читать тело
    if (response.status === 204) {
      return null as T
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Ошибка: ${response.statusText}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.detail || errorData.message || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      throw new Error(errorMessage)
    }

    // Читаем тело ответа один раз
    const text = await response.text()
    
    // Если тело пустое, возвращаем null (не пытаемся парсить JSON)
    if (!text || text.trim() === '') {
      return null as T
    }

    // Проверяем content-type для JSON ответов
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      // Если не JSON, возвращаем null
      return null as T
    }

    // Парсим JSON ответ
    try {
      return JSON.parse(text) as T
    } catch (error) {
      // Если не удалось распарсить JSON, возвращаем null (не бросаем ошибку)
      console.warn('Failed to parse JSON response:', error, 'Response text:', text.substring(0, 100))
      return null as T
    }
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Запрос превысил таймаут (${timeoutMs}ms)`)
    }
    throw error
  }
}

/**
 * Проверить, является ли ошибка ошибкой авторизации (требуется редирект)
 */
export function isAuthError(error: any): boolean {
  return error?.isAuthRedirect === true || error?.message === 'Требуется авторизация'
}
