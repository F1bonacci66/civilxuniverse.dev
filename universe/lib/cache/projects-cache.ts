/**
 * Утилита для кэширования проектов в localStorage
 * Кэш привязан к пользователю и имеет TTL (time to live)
 */

import type { Project } from '@/lib/api/projects'
import { getUser } from '@/lib/api/auth'

const CACHE_KEY_PREFIX = 'projects_cache_'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 минут

interface CachedProjects {
  projects: Project[]
  timestamp: number
  userId: string
}

/**
 * Получить ключ кэша для текущего пользователя
 */
function getCacheKey(): string | null {
  const user = getUser()
  if (!user) return null
  return `${CACHE_KEY_PREFIX}${user.id}`
}

/**
 * Получить кэшированные проекты
 * @returns Кэшированные проекты или null, если кэш недействителен
 */
export function getCachedProjects(): Project[] | null {
  if (typeof window === 'undefined') return null
  
  const cacheKey = getCacheKey()
  if (!cacheKey) return null

  try {
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const data: CachedProjects = JSON.parse(cached)
    const user = getUser()
    
    // Проверяем, что кэш принадлежит текущему пользователю
    if (!user || data.userId !== user.id) {
      localStorage.removeItem(cacheKey)
      return null
    }

    // Проверяем TTL
    const now = Date.now()
    if (now - data.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey)
      return null
    }

    return data.projects
  } catch (error) {
    console.error('Ошибка чтения кэша проектов:', error)
    // Удаляем поврежденный кэш
    if (cacheKey) {
      localStorage.removeItem(cacheKey)
    }
    return null
  }
}

/**
 * Сохранить проекты в кэш
 */
export function setCachedProjects(projects: Project[]): void {
  if (typeof window === 'undefined') return

  const cacheKey = getCacheKey()
  if (!cacheKey) return

  const user = getUser()
  if (!user) return

  try {
    const data: CachedProjects = {
      projects,
      timestamp: Date.now(),
      userId: user.id,
    }
    localStorage.setItem(cacheKey, JSON.stringify(data))
  } catch (error) {
    console.error('Ошибка сохранения кэша проектов:', error)
    // Игнорируем ошибки сохранения (например, если localStorage переполнен)
  }
}

/**
 * Очистить кэш проектов для текущего пользователя
 */
export function clearProjectsCache(): void {
  if (typeof window === 'undefined') return

  const cacheKey = getCacheKey()
  if (!cacheKey) return

  try {
    localStorage.removeItem(cacheKey)
  } catch (error) {
    console.error('Ошибка очистки кэша проектов:', error)
  }
}

/**
 * Очистить кэш проектов для всех пользователей (при выходе)
 */
export function clearAllProjectsCache(): void {
  if (typeof window === 'undefined') return

  try {
    // Удаляем все ключи, начинающиеся с префикса
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.error('Ошибка очистки всех кэшей проектов:', error)
  }
}

/**
 * Проверить, действителен ли кэш
 */
export function isCacheValid(): boolean {
  return getCachedProjects() !== null
}



