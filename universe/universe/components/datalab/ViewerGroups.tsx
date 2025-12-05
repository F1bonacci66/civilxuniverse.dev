'use client'

import { useState, useEffect, useCallback } from 'react'
import { Folder, Plus, Trash2, Play, X, Save } from 'lucide-react'
import {
  getViewerGroups,
  createViewerGroup,
  deleteViewerGroup,
  type ViewerGroup,
} from '@/lib/api/viewer'
import { getUser } from '@/lib/api/auth'
import { cn } from '@/lib/utils'

interface ViewerGroupsProps {
  fileUploadId: string
  selectedElementIds: string[]
  onGroupApply: (elementIds: string[]) => void
  className?: string
}

export function ViewerGroups({
  fileUploadId,
  selectedElementIds,
  onGroupApply,
  className,
}: ViewerGroupsProps) {
  const [groups, setGroups] = useState<ViewerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  // Загружаем пользователя и группы
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Получаем текущего пользователя (синхронная функция)
        const user = getUser()
        if (!user) {
          setError('Пользователь не авторизован')
          setLoading(false)
          return
        }
        setUserId(user.id)

        // Загружаем группы
        const loadedGroups = await getViewerGroups(fileUploadId, user.id)
        setGroups(loadedGroups)
      } catch (err: any) {
        console.error('Ошибка загрузки наборов:', err)
        // Игнорируем ошибки авторизации - редирект уже произошел
        if (err.isAuthRedirect) {
          return
        }
        setError(err.message || 'Не удалось загрузить наборы')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fileUploadId])

  // Создание нового набора
  const handleCreateGroup = useCallback(async () => {
    if (!userId || !newGroupName.trim() || selectedElementIds.length === 0) {
      return
    }

    try {
      setError(null)
      const newGroup = await createViewerGroup(fileUploadId, {
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        element_ids: selectedElementIds,
        user_id: userId,
      })

      setGroups((prev) => [...prev, newGroup])
      setNewGroupName('')
      setNewGroupDescription('')
      setIsCreating(false)
    } catch (err: any) {
      console.error('Ошибка создания набора:', err)
      // Игнорируем ошибки авторизации - редирект уже произошел
      if (err.isAuthRedirect) {
        return
      }
      setError(err.message || 'Не удалось создать набор')
    }
  }, [fileUploadId, userId, newGroupName, newGroupDescription, selectedElementIds])

  // Удаление набора
  const handleDeleteGroup = useCallback(
    async (groupId: string) => {
      if (!userId) return

      if (!confirm('Вы уверены, что хотите удалить этот набор?')) {
        return
      }

      try {
        setError(null)
        await deleteViewerGroup(fileUploadId, groupId, userId)
        setGroups((prev) => prev.filter((g) => g.id !== groupId))
      } catch (err: any) {
        console.error('Ошибка удаления набора:', err)
        // Игнорируем ошибки авторизации - редирект уже произошел
        if (err.isAuthRedirect) {
          return
        }
        setError(err.message || 'Не удалось удалить набор')
      }
    },
    [fileUploadId, userId]
  )

  // Применение набора
  const handleApplyGroup = useCallback(
    (group: ViewerGroup) => {
      onGroupApply(group.element_ids)
    },
    [onGroupApply]
  )

  return (
    <div
      className={cn(
        'bg-[rgba(31,41,55,0.6)] backdrop-blur-[10px] rounded-lg border border-[rgba(255,255,255,0.1)] flex flex-col h-full',
        className
      )}
    >
      {/* Заголовок */}
      <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Folder className="w-4 h-4" />
          Наборы элементов
        </h3>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="p-1.5 hover:bg-[rgba(20,184,166,0.1)] rounded transition-colors"
            title="Создать набор"
          >
            <Plus className="w-4 h-4 text-primary-500" />
          </button>
        )}
      </div>

      {/* Ошибка */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/50">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Форма создания набора */}
      {isCreating && (
        <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)] space-y-3">
          <div>
            <input
              type="text"
              placeholder="Название набора"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-lg text-white text-sm placeholder-[#999] focus:outline-none focus:border-primary-500 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <textarea
              placeholder="Описание (необязательно)"
              value={newGroupDescription}
              onChange={(e) => setNewGroupDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-lg text-white text-sm placeholder-[#999] focus:outline-none focus:border-primary-500 transition-colors resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || selectedElementIds.length === 0}
              className="flex-1 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-[rgba(55,65,81,0.8)] disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Сохранить ({selectedElementIds.length} элементов)
            </button>
            <button
              onClick={() => {
                setIsCreating(false)
                setNewGroupName('')
                setNewGroupDescription('')
              }}
              className="p-1.5 hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
            >
              <X className="w-4 h-4 text-[#999]" />
            </button>
          </div>
          {selectedElementIds.length === 0 && (
            <p className="text-xs text-amber-400">
              Выберите элементы в дереве или в 3D модели для создания набора
            </p>
          )}
        </div>
      )}

      {/* Список наборов */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <p className="text-[#999] text-sm">Загрузка наборов...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-4 text-center">
            <Folder className="w-8 h-8 mx-auto mb-2 text-[#999]" />
            <p className="text-[#999] text-sm mb-2">Нет сохраненных наборов</p>
            <p className="text-xs text-[#666]">
              Выберите элементы и создайте набор для быстрого доступа
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {groups.map((group) => (
              <div
                key={group.id}
                className="group px-3 py-2 bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(20,184,166,0.05)] rounded-lg transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">
                      {group.name}
                    </h4>
                    {group.description && (
                      <p className="text-xs text-[#999] mt-1 line-clamp-2">
                        {group.description}
                      </p>
                    )}
                    <p className="text-xs text-[#666] mt-1">
                      {group.element_ids.length} элементов
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleApplyGroup(group)}
                      className="p-1.5 hover:bg-[rgba(20,184,166,0.1)] rounded transition-colors"
                      title="Применить набор"
                    >
                      <Play className="w-4 h-4 text-primary-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                      title="Удалить набор"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

