'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { isAuthenticated } from '@/lib/api/auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Проверяем путь из window.location как fallback, если pathname еще не загружен
    const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '')
    
    // Если путь начинается с /auth - это публичные страницы, показываем сразу
    if (currentPath && currentPath.startsWith('/auth')) {
      const normalizedPath = currentPath.replace(/\/$/, '')
      const authenticated = isAuthenticated()
      
      // Если авторизован и на странице авторизации - редирект на главную
      if (authenticated && (normalizedPath === '/auth/login' || normalizedPath === '/auth/register')) {
        router.push('/app/datalab')
        return
      }
      
      // Показываем контент для публичных страниц
      setIsChecking(false)
      return
    }
    
    // Для остальных страниц проверяем авторизацию
    const authenticated = isAuthenticated()
    
    // Если не авторизован - редирект на авторизацию
    if (!authenticated) {
      router.push('/auth/login')
      return
    }
    
    // Все проверки пройдены - показываем контент
    setIsChecking(false)
  }, [pathname, router])

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-lg">Загрузка...</div>
      </div>
    )
  }

  return <>{children}</>
}

