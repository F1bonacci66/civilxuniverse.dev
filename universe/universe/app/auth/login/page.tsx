'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setAuthToken, setUser, removeAuthToken } from '@/lib/api/auth'
import { getApiClient } from '@/lib/api/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const client = getApiClient()
      // Явно не добавляем заголовок Authorization для запроса логина
      // Удаляем токен, если он есть (на случай, если пользователь пытается войти снова)
      removeAuthToken()
      
      const response = await fetch(`${client.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Явно не добавляем Authorization заголовок
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка входа')
      }

      // Сохраняем токен и данные пользователя
      setAuthToken(data.access_token)
      setUser(data.user)

      // Перенаправляем на главную страницу
      router.push('/app/datalab')
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при входе')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-body-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[rgba(31,41,55,0.6)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Вход в Universe</h1>
            <p className="text-[#999]">Войдите в свой аккаунт</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-[rgba(239,68,68,0.1)] border border-[#ef4444] rounded-xl text-[#fca5a5]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white placeholder:text-[#999] transition-all duration-300 focus:outline-none focus:border-primary-500 focus:bg-[rgba(17,24,39,0.9)] focus:shadow-[0_0_0_3px_rgba(20,184,166,0.1)] hover:border-[rgba(20,184,166,0.3)]"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white placeholder:text-[#999] transition-all duration-300 focus:outline-none focus:border-primary-500 focus:bg-[rgba(17,24,39,0.9)] focus:shadow-[0_0_0_3px_rgba(20,184,166,0.1)] hover:border-[rgba(20,184,166,0.3)]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-primary-gradient text-black font-semibold rounded-xl hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(20,184,166,0.3)] hover:shadow-[0_8px_25px_rgba(20,184,166,0.4)]"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#999]">
              Нет аккаунта?{' '}
              <Link href="/auth/register" className="text-primary-500 hover:text-primary-400 transition-colors">
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

