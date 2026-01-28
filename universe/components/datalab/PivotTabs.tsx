'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, Edit2, Trash2, Loader2 } from 'lucide-react'
import type { PivotReport } from '@/lib/types/pivot'
import {
  getPivotReports,
  createPivotReport,
  updatePivotReport,
  deletePivotReport,
} from '@/lib/api/pivot'

interface PivotTabsProps {
  projectId: string
  versionId: string
  activeTabId: string | null
  onTabChange: (tab: PivotReport) => void
  onTabCreate: (tab: PivotReport) => void
  onTabDelete: (tabId: string) => void
}

export function PivotTabs({
  projectId,
  versionId,
  activeTabId,
  onTabChange,
  onTabCreate,
  onTabDelete,
}: PivotTabsProps) {
  const [tabs, setTabs] = useState<PivotReport[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Загрузка вкладок
  useEffect(() => {
    if (!projectId || !versionId) return
    loadTabs()
  }, [projectId, versionId])

  // Фокус на input при редактировании
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTabId])

  const loadTabs = async () => {
    try {
      setLoading(true)
      const data = await getPivotReports(projectId, versionId)
      setTabs(data)
      
      // Если нет вкладок, создаем первую
      if (data.length === 0) {
        await createFirstTab()
        return
      }
      
      // Пытаемся восстановить активную вкладку из localStorage
      const storageKey = `pivot-active-tab-${projectId}-${versionId}`
      let tabToLoad: PivotReport | null = null
      
      if (activeTabId) {
        // Если activeTabId передан из пропсов, используем его
        tabToLoad = data.find(t => t.id === activeTabId) || null
      } else {
        // Пытаемся восстановить из localStorage
        const savedTabId = localStorage.getItem(storageKey)
        if (savedTabId) {
          tabToLoad = data.find(t => t.id === savedTabId) || null
        }
      }
      
      // Если вкладка не найдена, выбираем первую
      if (!tabToLoad) {
        tabToLoad = data[0]
      }
      
      // Сохраняем активную вкладку в localStorage
      localStorage.setItem(storageKey, tabToLoad.id)
      
      // Загружаем выбранную вкладку
      onTabChange(tabToLoad)
    } catch (err: any) {
      console.error('Ошибка загрузки вкладок:', err)
    } finally {
      setLoading(false)
    }
  }

  const createFirstTab = async () => {
    try {
      setCreating(true)
      const newTab = await createPivotReport({
        name: 'Таблица 1',
        projectId,
        versionId,
        rows: [],
        columns: [],
        values: [],
      })
      setTabs([newTab])
      // Сохраняем активную вкладку в localStorage
      const storageKey = `pivot-active-tab-${projectId}-${versionId}`
      localStorage.setItem(storageKey, newTab.id)
      onTabCreate(newTab)
      onTabChange(newTab)
    } catch (err: any) {
      console.error('Ошибка создания первой вкладки:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleCreateTab = async () => {
    try {
      setCreating(true)
      const tabNumber = tabs.length + 1
      const newTab = await createPivotReport({
        name: `Таблица ${tabNumber}`,
        projectId,
        versionId,
        rows: [],
        columns: [],
        values: [],
      })
      const updatedTabs = [...tabs, newTab]
      setTabs(updatedTabs)
      // Сохраняем активную вкладку в localStorage
      const storageKey = `pivot-active-tab-${projectId}-${versionId}`
      localStorage.setItem(storageKey, newTab.id)
      onTabCreate(newTab)
      onTabChange(newTab)
    } catch (err: any) {
      console.error('Ошибка создания вкладки:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleStartEdit = (tab: PivotReport) => {
    setEditingTabId(tab.id)
    setEditingName(tab.name)
  }

  const handleSaveEdit = async (tabId: string) => {
    if (!editingName.trim()) {
      setEditingTabId(null)
      return
    }

    try {
      const updatedTab = await updatePivotReport(tabId, {
        name: editingName.trim(),
      })
      setTabs(tabs.map((t) => (t.id === tabId ? updatedTab : t)))
      setEditingTabId(null)
      
      // Если редактируемая вкладка активна, обновляем её
      if (activeTabId === tabId) {
        onTabChange(updatedTab)
      }
    } catch (err: any) {
      console.error('Ошибка сохранения названия вкладки:', err)
    }
  }

  const handleCancelEdit = () => {
    setEditingTabId(null)
    setEditingName('')
  }

  const handleDeleteTab = async (tabId: string) => {
    if (tabs.length === 1) {
      alert('Нельзя удалить последнюю вкладку')
      return
    }

    if (!confirm('Вы уверены, что хотите удалить эту вкладку?')) {
      return
    }

    try {
      await deletePivotReport(tabId)
      const updatedTabs = tabs.filter((t) => t.id !== tabId)
      setTabs(updatedTabs)
      onTabDelete(tabId)
      
      // Если удалена активная вкладка, переключаемся на первую
      if (activeTabId === tabId && updatedTabs.length > 0) {
        const storageKey = `pivot-active-tab-${projectId}-${versionId}`
        localStorage.setItem(storageKey, updatedTabs[0].id)
        onTabChange(updatedTabs[0])
      }
    } catch (err: any) {
      console.error('Ошибка удаления вкладки:', err)
    }
  }

  if (loading || creating) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgba(255,255,255,0.1)]">
        <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
        <span className="text-sm text-[#999]">Загрузка вкладок...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgba(255,255,255,0.1)] overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id
        const isEditing = editingTabId === tab.id

        return (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 transition-all
              ${
                isActive
                  ? 'bg-[rgba(0,0,0,0.6)] border-primary-500'
                  : 'bg-[rgba(0,0,0,0.3)] border-transparent hover:bg-[rgba(0,0,0,0.4)]'
              }
            `}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleSaveEdit(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveEdit(tab.id)
                  } else if (e.key === 'Escape') {
                    handleCancelEdit()
                  }
                }}
                className="bg-[rgba(255,255,255,0.1)] border border-primary-500 rounded px-2 py-1 text-sm text-white min-w-[100px] focus:outline-none focus:ring-1 focus:ring-primary-500"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <button
                  onClick={() => {
                    // Сохраняем активную вкладку в localStorage
                    const storageKey = `pivot-active-tab-${projectId}-${versionId}`
                    localStorage.setItem(storageKey, tab.id)
                    onTabChange(tab)
                  }}
                  className="text-sm font-medium text-white hover:text-primary-400 transition-colors"
                >
                  {tab.name}
                </button>
                <button
                  onClick={() => handleStartEdit(tab)}
                  className="p-1 hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
                  title="Переименовать"
                >
                  <Edit2 className="w-3 h-3 text-[#999] hover:text-primary-400" />
                </button>
                {tabs.length > 1 && (
                  <button
                    onClick={() => handleDeleteTab(tab.id)}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                    title="Удалить"
                  >
                    <X className="w-3 h-3 text-[#999] hover:text-red-400" />
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}
      
      <Button
        onClick={handleCreateTab}
        className="ml-2 flex-shrink-0 bg-transparent border border-[rgba(255,255,255,0.2)] text-white hover:bg-[rgba(255,255,255,0.1)] h-9 px-3"
        disabled={creating}
      >
        <Plus className="w-4 h-4 mr-1" />
        Новая вкладка
      </Button>
    </div>
  )
}

