'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Bell, Settings, User, ChevronDown, LogOut } from 'lucide-react'
import { universeApps } from '@/lib/mock-data'
import { getUser, logout, isAuthenticated } from '@/lib/api/auth'
import type { User as UserType } from '@/lib/api/auth'

interface GlobalHeaderProps {
  currentApp?: string
}

export function GlobalHeader({ currentApp = 'datalab' }: GlobalHeaderProps) {
  const router = useRouter()
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [user, setUser] = useState<UserType | null>(null)
  const currentAppData = universeApps.find((app) => app.id === currentApp)

  useEffect(() => {
    // Проверяем авторизацию при монтировании
    if (isAuthenticated()) {
      setUser(getUser())
    }
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[rgba(0,0,0,0.8)] backdrop-blur-[20px] border-b border-[rgba(255,255,255,0.1)] z-50 transition-all duration-300">
      <div className="h-full max-w-[1920px] mx-auto px-4 flex items-center justify-between">
        {/* Логотип и название приложения */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="text-xl font-bold text-white">CivilX.Universe</div>
          </Link>
          {currentAppData && (
            <div className="flex items-center gap-2 pl-6 border-l border-[rgba(255,255,255,0.1)]">
              <div className="text-lg font-semibold text-white">
                {currentAppData.displayName}
              </div>
            </div>
          )}
        </div>

        {/* Поиск и App Switcher */}
        <div className="flex items-center gap-4 flex-1 max-w-2xl mx-8">
          <div className="relative flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
              <input
                type="text"
                placeholder="Поиск по проектам, моделям, элементам..."
                className="w-full h-10 pl-10 pr-4 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white placeholder:text-[#999] transition-all duration-300 focus:outline-none focus:border-primary-500 focus:bg-[rgba(17,24,39,0.9)] focus:shadow-[0_0_0_3px_rgba(20,184,166,0.1)] hover:border-[rgba(20,184,166,0.3)]"
              />
            </div>
          </div>

          {/* App Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsAppsMenuOpen(!isAppsMenuOpen)}
              className="h-10 px-4 flex items-center gap-2 bg-[rgba(55,65,81,0.8)] border border-[rgba(255,255,255,0.2)] rounded-xl text-white hover:bg-[rgba(75,85,99,0.8)] hover:border-[rgba(20,184,166,0.3)] transition-all duration-300"
            >
              <span className="text-sm font-medium">Приложения</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {isAppsMenuOpen && (
              <div className="absolute top-full mt-2 right-0 w-64 bg-[rgba(31,41,55,0.95)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-xl overflow-hidden z-50">
                {universeApps.map((app) => (
                  <Link
                    key={app.id}
                    href={app.path}
                    className="block px-4 py-3 hover:bg-[rgba(20,184,166,0.1)] transition-colors"
                    onClick={() => setIsAppsMenuOpen(false)}
                  >
                    <div className="font-semibold text-white">{app.displayName}</div>
                    <div className="text-sm text-[#999] mt-1">{app.description}</div>
                    {app.status === 'coming' && (
                      <span className="inline-block mt-1 text-xs text-[#999]">
                        Скоро
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Иконки действий */}
        <div className="flex items-center gap-2">
          <button className="h-10 w-10 flex items-center justify-center rounded-xl text-white hover:bg-[rgba(20,184,166,0.1)] hover:text-primary-500 transition-all duration-300 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full"></span>
          </button>
          <button className="h-10 w-10 flex items-center justify-center rounded-xl text-white hover:bg-[rgba(20,184,166,0.1)] hover:text-primary-500 transition-all duration-300">
            <Settings className="w-5 h-5" />
          </button>
          
          {/* Меню пользователя */}
          <div className="relative">
            {user ? (
              <>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="h-10 w-10 flex items-center justify-center rounded-xl text-white hover:bg-[rgba(20,184,166,0.1)] hover:text-primary-500 transition-all duration-300"
                >
                  <User className="w-5 h-5" />
                </button>
                
                {isUserMenuOpen && (
                  <div className="absolute top-full mt-2 right-0 w-64 bg-[rgba(31,41,55,0.95)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)]">
                      <div className="font-semibold text-white">{user.name}</div>
                      <div className="text-sm text-[#999] mt-1">{user.email}</div>
                    </div>
                    <Link
                      href="/account"
                      className="block px-4 py-3 hover:bg-[rgba(20,184,166,0.1)] transition-colors text-white"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      Личный кабинет
                    </Link>
                    <button
                      onClick={() => {
                        logout()
                        setIsUserMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-[rgba(239,68,68,0.1)] transition-colors text-[#fca5a5] flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Выйти
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link
                href="/auth/login"
                className="h-10 w-10 flex items-center justify-center rounded-xl text-white hover:bg-[rgba(20,184,166,0.1)] hover:text-primary-500 transition-all duration-300"
              >
                <User className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>
      </div>
      
      {/* Закрытие меню при клике вне его */}
      {(isAppsMenuOpen || isUserMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsAppsMenuOpen(false)
            setIsUserMenuOpen(false)
          }}
        />
      )}
    </header>
  )
}



