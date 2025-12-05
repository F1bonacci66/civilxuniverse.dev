/**
 * API клиент для работы с аутентификацией
 */

const AUTH_TOKEN_KEY = 'authToken'
const USER_KEY = 'user'

export interface User {
  id: string  // UUID для Universe пользователей
  email: string
  name: string
  company_name?: string | null
  is_active: boolean
  is_verified: boolean
  created_at: string
}

/**
 * Получить токен из localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

/**
 * Сохранить токен в localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

/**
 * Удалить токен из localStorage
 */
export function removeAuthToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * Получить данные пользователя из localStorage
 */
export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  const userStr = localStorage.getItem(USER_KEY)
  if (!userStr) return null
  try {
    return JSON.parse(userStr) as User
  } catch {
    return null
  }
}

/**
 * Сохранить данные пользователя в localStorage
 */
export function setUser(user: User): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/**
 * Проверить, авторизован ли пользователь
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null && getUser() !== null
}

/**
 * Обработать токен из URL параметра (при переходе с civilx.ru)
 */
export function handleTokenFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get('token')
  const userStr = urlParams.get('user')
  
  if (token) {
    // Сохраняем токен
    setAuthToken(token)
    
    // Сохраняем данные пользователя если переданы
    if (userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr)) as User
        setUser(user)
      } catch (e) {
        console.error('Ошибка парсинга данных пользователя:', e)
      }
    }
    
    // Удаляем параметры из URL
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.delete('token')
    newUrl.searchParams.delete('user')
    window.history.replaceState({}, '', newUrl.toString())
    
    return true
  }
  
  return false
}

/**
 * Получить заголовки для API запросов с токеном
 */
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

/**
 * Редирект на страницу авторизации Universe
 * Примечание: токен должен быть удален перед вызовом этой функции
 */
export function redirectToAuth(): void {
  if (typeof window === 'undefined') return
  window.location.href = '/auth/login'
}

/**
 * Выход из системы
 */
export function logout(): void {
  removeAuthToken()
  redirectToAuth()
}

