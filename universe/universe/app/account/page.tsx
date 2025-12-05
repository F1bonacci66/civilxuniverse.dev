'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, logout, setUser, getAuthHeaders } from '@/lib/api/auth'
import { getApiClient } from '@/lib/api/client'
import { User } from '@/lib/api/auth'

export default function AccountPage() {
  const router = useRouter()
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Форма редактирования профиля
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Форма смены пароля
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    // Проверяем авторизацию
    const currentUser = getUser()
    if (!currentUser) {
      router.push('/auth/login')
      return
    }

    // Загружаем актуальные данные пользователя
    loadUserData()
  }, [router])

  const loadUserData = async () => {
    try {
      const client = getApiClient()
      const response = await fetch(`${client.baseURL}/auth/me`, {
        headers: {
          ...getAuthHeaders(),
        },
      })

      if (response.status === 401) {
        logout()
        return
      }

      if (!response.ok) {
        throw new Error('Ошибка загрузки данных пользователя')
      }

      const userData = await response.json()
      setUserState(userData)
      setName(userData.name)
      setEmail(userData.email)
      setCompanyName(userData.company_name || '')
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const client = getApiClient()
      const response = await fetch(`${client.baseURL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ 
          name, 
          email,
          company_name: companyName || null
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Ошибка обновления профиля')
      }

      const updatedUser = await response.json()
      setUserState(updatedUser)
      setUser(updatedUser)
      setSuccess('Профиль успешно обновлен')
      setIsEditing(false)
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления профиля')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (newPassword.length < 8) {
      setError('Пароль должен содержать минимум 8 символов')
      return
    }

    setChangingPassword(true)

    try {
      const client = getApiClient()
      const response = await fetch(`${client.baseURL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Ошибка смены пароля')
      }

      setSuccess('Пароль успешно изменен')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'Ошибка смены пароля')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-body-gradient flex items-center justify-center">
        <div className="text-white">Загрузка...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-body-gradient p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Личный кабинет</h1>

        {error && (
          <div className="mb-6 p-4 bg-[rgba(239,68,68,0.1)] border border-[#ef4444] rounded-xl text-[#fca5a5]">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-[rgba(34,197,94,0.1)] border border-[#22c55e] rounded-xl text-[#86efac]">
            {success}
          </div>
        )}

        {/* Профиль */}
        <div className="bg-[rgba(31,41,55,0.6)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">Профиль</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-primary-gradient text-black font-semibold rounded-xl hover:opacity-90 transition-all"
              >
                Редактировать
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Имя</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Название компании <span className="text-[#999] text-xs">(необязательно)</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  maxLength={255}
                  className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white focus:outline-none focus:border-primary-500"
                  placeholder="Название вашей компании"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-primary-gradient text-black font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setName(user.name)
                    setEmail(user.email)
                    setCompanyName(user.company_name || '')
                  }}
                  className="px-6 py-3 bg-[rgba(55,65,81,0.8)] text-white font-semibold rounded-xl hover:bg-[rgba(75,85,99,0.8)] transition-all"
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-[#999] mb-1">Имя</div>
                <div className="text-white text-lg">{user.name}</div>
              </div>
              <div>
                <div className="text-sm text-[#999] mb-1">Email</div>
                <div className="text-white text-lg">{user.email}</div>
              </div>
              {user.company_name && (
                <div>
                  <div className="text-sm text-[#999] mb-1">Название компании</div>
                  <div className="text-white text-lg">{user.company_name}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-[#999] mb-1">Дата регистрации</div>
                <div className="text-white text-lg">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'Не указана'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Смена пароля */}
        <div className="bg-[rgba(31,41,55,0.6)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-semibold text-white mb-6">Смена пароля</h2>
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Текущий пароль</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Подтвердите новый пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-[rgba(17,24,39,0.8)] border-2 border-[rgba(255,255,255,0.1)] rounded-xl text-white focus:outline-none focus:border-primary-500"
              />
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="px-6 py-3 bg-primary-gradient text-black font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
            >
              {changingPassword ? 'Смена пароля...' : 'Изменить пароль'}
            </button>
          </form>
        </div>

        {/* Выход */}
        <div className="bg-[rgba(31,41,55,0.6)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-4">Выход</h2>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-[rgba(239,68,68,0.1)] border border-[#ef4444] text-[#fca5a5] font-semibold rounded-xl hover:bg-[rgba(239,68,68,0.2)] transition-all"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  )
}

