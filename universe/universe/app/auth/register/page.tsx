'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setAuthToken, setUser } from '@/lib/api/auth'
import { getApiClient } from '@/lib/api/client'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов')
      return
    }

    setLoading(true)

    try {
      const client = getApiClient()
      // Используем альтернативный endpoint /signup с trailing slash, чтобы избежать редиректа 308 в Nginx
      const response = await fetch(`${client.baseURL}/auth/signup/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name, 
          email, 
          password,
          company_name: companyName || undefined
        }),
      })

      // Проверяем Content-Type перед парсингом JSON
      const contentType = response.headers.get('content-type')
      let data: any
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json()
        } catch (jsonError) {
          const text = await response.text()
          console.error('Failed to parse JSON response:', text)
          throw new Error(`Ошибка сервера: неверный формат ответа (${response.status})`)
        }
      } else {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        throw new Error(`Ошибка сервера: неверный формат ответа (${response.status})`)
      }

      if (!response.ok) {
        // Обрабатываем разные форматы ошибок
        let errorMessage = 'Ошибка регистрации'
        if (data.detail) {
          if (Array.isArray(data.detail)) {
            // Pydantic validation errors
            errorMessage = data.detail.map((err: any) => 
              `${err.loc?.join('.')}: ${err.msg}`
            ).join(', ')
          } else if (typeof data.detail === 'string') {
            errorMessage = data.detail
          }
        } else if (data.message) {
          errorMessage = data.message
        }
        throw new Error(errorMessage)
      }

      // Сохраняем токен и данные пользователя
      setAuthToken(data.access_token)
      setUser(data.user)

      // Перенаправляем на главную страницу
      router.push('/app/datalab')
    } catch (err: any) {
      console.error('Registration error:', err)
      setError(err.message || 'Произошла ошибка при регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-body-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[rgba(31,41,55,0.6)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Регистрация в Universe</h1>
            <p className="text-[#999]">Создайте новый аккаунт</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-[rgba(239,68,68,0.1)] border border-[#ef4444] rounded-xl text-[#fca5a5]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                Имя
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={255}
                autoComplete="name"
                className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white placeholder:text-[#999] transition-all duration-300 focus:outline-none focus:border-primary-500 focus:bg-[rgba(17,24,39,0.9)] focus:shadow-[0_0_0_3px_rgba(20,184,166,0.1)] hover:border-[rgba(20,184,166,0.3)]"
                placeholder="Ваше имя"
              />
            </div>

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
              <label htmlFor="companyName" className="block text-sm font-medium text-white mb-2">
                Название компании <span className="text-[#999] text-xs">(необязательно)</span>
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                maxLength={255}
                className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white placeholder:text-[#999] transition-all duration-300 focus:outline-none focus:border-primary-500 focus:bg-[rgba(17,24,39,0.9)] focus:shadow-[0_0_0_3px_rgba(20,184,166,0.1)] hover:border-[rgba(20,184,166,0.3)]"
                placeholder="Название вашей компании"
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
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white placeholder:text-[#999] transition-all duration-300 focus:outline-none focus:border-primary-500 focus:bg-[rgba(17,24,39,0.9)] focus:shadow-[0_0_0_3px_rgba(20,184,166,0.1)] hover:border-[rgba(20,184,166,0.3)]"
                placeholder="Минимум 8 символов"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                Подтвердите пароль
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white placeholder:text-[#999] transition-all duration-300 focus:outline-none focus:border-primary-500 focus:bg-[rgba(17,24,39,0.9)] focus:shadow-[0_0_0_3px_rgba(20,184,166,0.1)] hover:border-[rgba(20,184,166,0.3)]"
                placeholder="Повторите пароль"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-primary-gradient text-black font-semibold rounded-xl hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(20,184,166,0.3)] hover:shadow-[0_8px_25px_rgba(20,184,166,0.4)]"
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#999]">
              Уже есть аккаунт?{' '}
              <Link href="/auth/login" className="text-primary-500 hover:text-primary-400 transition-colors">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

