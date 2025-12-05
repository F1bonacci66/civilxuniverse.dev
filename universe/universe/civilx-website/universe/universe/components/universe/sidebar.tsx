'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Folder,
  ChevronRight,
  Plus,
  Database,
  BarChart3,
  FileBarChart,
  CheckSquare,
  Upload,
  GitBranch,
  X,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
} from 'lucide-react'
import { mockProjects } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { 
  getProjects, 
  createProject, 
  getProjectVersions, 
  createProjectVersion,
  updateProject,
  deleteProject,
  updateProjectVersion,
  deleteProjectVersion,
  type Project, 
  type ProjectVersion 
} from '@/lib/api/projects'
import { useToast } from '@/components/ui/toast'

const getProjectRouteId = (project: Project) => project.shortId?.toString() ?? project.id
const getVersionRouteId = (version: ProjectVersion) => version.shortId?.toString() ?? version.id

interface SidebarProps {
  projectId?: string
  versionId?: string
}

export function Sidebar({ projectId, versionId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [expandedProjects, setExpandedProjects] = useState<string[]>([])
  const [expandedVersions, setExpandedVersions] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectVersions, setProjectVersions] = useState<Record<string, ProjectVersion[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({})
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Состояния для создания версии
  const [showCreateVersionModal, setShowCreateVersionModal] = useState(false)
  const [selectedProjectForVersion, setSelectedProjectForVersion] = useState<string | null>(null)
  const [newVersionName, setNewVersionName] = useState('')
  const [newVersionDescription, setNewVersionDescription] = useState('')
  const [isCreatingVersion, setIsCreatingVersion] = useState(false)
  const [versionError, setVersionError] = useState<string | null>(null)

  // Состояния для меню настроек
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; right?: number } | null>(null)
  const [editingId, setEditingId] = useState<{ type: 'project' | 'version'; id: string } | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState<{ type: 'project' | 'version'; id: string; name: string; projectId?: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Toast уведомления
  const { showToast } = useToast()

  // Загружаем проекты из API
  useEffect(() => {
    loadProjects()
  }, [])

  // Разворачиваем открытый проект и загружаем его версии
  useEffect(() => {
    if (!projectId || projects.length === 0) return
    const matchedProject = projects.find((p) => getProjectRouteId(p) === projectId)
    if (!matchedProject) return

    const projectKey = matchedProject.id
    setExpandedProjects((prev) =>
      prev.includes(projectKey) ? prev : [...prev, projectKey]
    )

    if (!projectVersions[projectKey]) {
      getProjectVersions(projectKey)
        .then((versions) => {
          setProjectVersions((prev) => ({ ...prev, [projectKey]: versions }))
        })
        .catch((err) => {
          console.error(`Ошибка загрузки версий проекта ${projectKey}:`, err)
        })
    }
  }, [projectId, projects, projectVersions])

  useEffect(() => {
    if (!projectId || !versionId || projects.length === 0) return
    const matchedProject = projects.find((p) => getProjectRouteId(p) === projectId)
    if (!matchedProject) return
    const versions = projectVersions[matchedProject.id]
    if (!versions) return

    const matchedVersion = versions.find((v) => getVersionRouteId(v) === versionId)
    if (!matchedVersion) return

    const versionKey = matchedVersion.id
    setExpandedVersions((prev) =>
      prev.includes(versionKey) ? prev : [...prev, versionKey]
    )
  }, [projectId, versionId, projects, projectVersions])

  const loadProjects = async () => {
    try {
      setIsLoadingProjects(true)
      const projectsData = await getProjects()
      setProjects(projectsData)
    } catch (err) {
      console.error('Ошибка загрузки проектов:', err)
      // В случае ошибки используем mock данные
      setProjects(mockProjects as any)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError('Название проекта обязательно')
      return
    }

    try {
      setIsCreating(true)
      setError(null)
      const newProject = await createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
      })
      
      // Обновляем список проектов
      await loadProjects()
      
      // Разворачиваем созданный проект и загружаем его версии
      setExpandedProjects((prev) => [...prev, newProject.id])
      try {
        const versions = await getProjectVersions(newProject.id)
        setProjectVersions((prev) => ({ ...prev, [newProject.id]: versions }))
      } catch (err) {
        console.error('Ошибка загрузки версий нового проекта:', err)
      }
      
      // Закрываем модальное окно и очищаем форму
      setShowCreateProjectModal(false)
      setNewProjectName('')
      setNewProjectDescription('')
      
      // Переходим к созданному проекту
      router.push(`/app/datalab/project/${getProjectRouteId(newProject)}`)
    } catch (err: any) {
      console.error('Ошибка создания проекта:', err)
      setError(err.message || 'Не удалось создать проект')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateVersion = async () => {
    if (!selectedProjectForVersion) {
      setVersionError('Проект не выбран')
      return
    }

    if (!newVersionName.trim()) {
      setVersionError('Название версии обязательно')
      return
    }

    try {
      setIsCreatingVersion(true)
      setVersionError(null)
      const newVersion = await createProjectVersion(selectedProjectForVersion, {
        name: newVersionName.trim(),
        description: newVersionDescription.trim() || undefined,
      })
      
      // Обновляем список версий проекта
      const versions = await getProjectVersions(selectedProjectForVersion)
      setProjectVersions((prev) => ({ ...prev, [selectedProjectForVersion]: versions }))
      
      // Закрываем модальное окно и очищаем форму
      setShowCreateVersionModal(false)
      setSelectedProjectForVersion(null)
      setNewVersionName('')
      setNewVersionDescription('')
      
      // Переходим к созданной версии
      const projectRouteId =
        projects.find((p) => p.id === selectedProjectForVersion)?.shortId?.toString() ??
        selectedProjectForVersion
      router.push(`/app/datalab/project/${projectRouteId}/version/${getVersionRouteId(newVersion)}`)
    } catch (err: any) {
      console.error('Ошибка создания версии:', err)
      setVersionError(err.message || 'Не удалось создать версию')
    } finally {
      setIsCreatingVersion(false)
    }
  }

  const openCreateVersionModal = (projectId: string) => {
    setSelectedProjectForVersion(projectId)
    setShowCreateVersionModal(true)
    setNewVersionName('')
    setNewVersionDescription('')
    setVersionError(null)
  }

  const toggleProject = async (projectId: string) => {
    const isExpanding = !expandedProjects.includes(projectId)
    
    setExpandedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    )

    // Загружаем версии при разворачивании проекта
    if (isExpanding && !projectVersions[projectId]) {
      try {
        setLoadingVersions((prev) => ({ ...prev, [projectId]: true }))
        const versions = await getProjectVersions(projectId)
        setProjectVersions((prev) => ({ ...prev, [projectId]: versions }))
      } catch (err) {
        console.error(`Ошибка загрузки версий проекта ${projectId}:`, err)
        setProjectVersions((prev) => ({ ...prev, [projectId]: [] }))
      } finally {
        setLoadingVersions((prev) => ({ ...prev, [projectId]: false }))
      }
    }
  }

  const toggleVersion = (versionId: string) => {
    setExpandedVersions((prev) =>
      prev.includes(versionId)
        ? prev.filter((id) => id !== versionId)
        : [...prev, versionId]
    )
  }

  const isProjectExpanded = (projectId: string) => expandedProjects.includes(projectId)
  const isVersionExpanded = (versionId: string) => expandedVersions.includes(versionId)

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest(`[data-menu-id]`) && !(event.target as Element).closest('[data-menu-dropdown]')) {
        setOpenMenuId(null)
        setMenuPosition(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  // Обновление позиции меню при скролле или изменении размера окна
  useEffect(() => {
    if (!openMenuId || !menuPosition) return

    const updatePosition = () => {
      const button = document.querySelector(`[data-menu-id="${openMenuId}"] button`)
      if (button) {
        const rect = button.getBoundingClientRect()
        // Для всех меню открываем вправо от кнопки, чтобы они перекрывали основной контент
        setMenuPosition({
          top: rect.bottom + 4,
          left: rect.left, // Открываем вправо от левого края кнопки
        })
      }
    }

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [openMenuId, menuPosition])

  // Обработка переименования проекта
  const handleRenameProject = (project: Project) => {
    setEditingId({ type: 'project', id: project.id })
    setEditingName(project.name)
    setOpenMenuId(null)
    setMenuPosition(null)
  }

  // Обработка переименования версии
  const handleRenameVersion = (version: ProjectVersion) => {
    setEditingId({ type: 'version', id: version.id })
    setEditingName(version.name)
    setOpenMenuId(null)
    setMenuPosition(null)
  }

  // Сохранение переименования
  const handleSaveRename = async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null)
      setEditingName('')
      return
    }

    try {
      setIsUpdating(true)
      
      if (editingId.type === 'project') {
        await updateProject(editingId.id, { name: editingName.trim() })
        showToast('Проект успешно переименован', 'success')
        await loadProjects()
      } else {
        const project = projects.find((p) => 
          projectVersions[p.id]?.some((v) => v.id === editingId.id)
        )
        if (project) {
          await updateProjectVersion(project.id, editingId.id, { name: editingName.trim() })
          showToast('Версия успешно переименована', 'success')
          const versions = await getProjectVersions(project.id)
          setProjectVersions((prev) => ({ ...prev, [project.id]: versions }))
        }
      }
      
      setEditingId(null)
      setEditingName('')
    } catch (err: any) {
      console.error('Ошибка переименования:', err)
      showToast(err.message || 'Не удалось переименовать', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  // Отмена переименования
  const handleCancelRename = () => {
    setEditingId(null)
    setEditingName('')
  }

  // Обработка удаления проекта
  const handleDeleteProject = (project: Project) => {
    setShowDeleteModal({ type: 'project', id: project.id, name: project.name })
    setOpenMenuId(null)
    setMenuPosition(null)
  }

  // Обработка удаления версии
  const handleDeleteVersion = (version: ProjectVersion, projectId: string) => {
    setShowDeleteModal({ type: 'version', id: version.id, name: version.name, projectId })
    setOpenMenuId(null)
    setMenuPosition(null)
  }

  // Подтверждение удаления
  const handleConfirmDelete = async () => {
    if (!showDeleteModal) return

    try {
      setIsDeleting(true)
      
      if (showDeleteModal.type === 'project') {
        await deleteProject(showDeleteModal.id)
        showToast('Проект успешно удален', 'success')
        
        // Если удален активный проект, перенаправляем на главную
        const deletedProject = projects.find((p) => p.id === showDeleteModal.id)
        if (deletedProject && projectId === getProjectRouteId(deletedProject)) {
          router.push('/app/datalab')
        }
        
        await loadProjects()
      } else {
        if (!showDeleteModal.projectId) return
        
        await deleteProjectVersion(showDeleteModal.projectId, showDeleteModal.id)
        showToast('Версия успешно удалена', 'success')
        
        // Если удалена активная версия, перенаправляем на главную
        const project = projects.find((p) => p.id === showDeleteModal.projectId)
        if (project) {
          const deletedVersion = projectVersions[project.id]?.find((v) => v.id === showDeleteModal.id)
          if (deletedVersion && versionId === getVersionRouteId(deletedVersion)) {
            router.push('/app/datalab')
          }
          
          const versions = await getProjectVersions(project.id)
          setProjectVersions((prev) => ({ ...prev, [project.id]: versions }))
        }
      }
      
      setShowDeleteModal(null)
    } catch (err: any) {
      console.error('Ошибка удаления:', err)
      showToast(err.message || 'Не удалось удалить', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const datalabTabs = [
    {
      id: 'data',
      name: 'Таблица данных',
      icon: Database,
      path:
        projectId && versionId
          ? `/app/datalab/project/${projectId}/version/${versionId}/data`
          : undefined,
    },
    {
      id: 'pivot',
      name: 'Pivot-аналитика',
      icon: BarChart3,
      path:
        projectId && versionId
          ? `/app/datalab/project/${projectId}/version/${versionId}/pivot`
          : undefined,
    },
    {
      id: 'reports',
      name: 'Отчёты / Спецификации',
      icon: FileBarChart,
      path:
        projectId && versionId
          ? `/app/datalab/project/${projectId}/version/${versionId}/reports`
          : undefined,
    },
    {
      id: 'checks',
      name: 'Проверки параметров',
      icon: CheckSquare,
      path:
        projectId && versionId
          ? `/app/datalab/project/${projectId}/version/${versionId}/checks`
          : undefined,
    },
  ]

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] border-r border-[rgba(255,255,255,0.1)] overflow-y-auto">
      <div className="p-4">
        {/* Список проектов */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Проекты
            </h2>
            <button 
              onClick={() => setShowCreateProjectModal(true)}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-white hover:bg-[rgba(20,184,166,0.1)] hover:text-primary-500 transition-all duration-300"
              title="Создать новый проект"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {isLoadingProjects ? (
              <div className="text-[#ccc] text-sm px-3 py-2">Загрузка...</div>
            ) : projects.length === 0 ? (
              <div className="text-[#ccc] text-sm px-3 py-2">Нет проектов</div>
            ) : (
              projects.map((project) => {
                const projectRoute = getProjectRouteId(project)
                const projectVersionList = projectVersions[project.id] || []
                const isActiveProject = projectId === projectRoute

                const isEditing = editingId?.type === 'project' && editingId.id === project.id
                const isMenuOpen = openMenuId === `project-${project.id}`

                return (
                  <div key={project.id} className="group relative">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleProject(project.id)}
                        className={cn(
                          'flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200',
                          isActiveProject
                            ? 'bg-[rgba(20,184,166,0.1)] text-primary-500'
                            : 'text-white hover:bg-[rgba(20,184,166,0.05)] hover:text-primary-400'
                        )}
                      >
                        <ChevronRight
                          className={cn(
                            'w-4 h-4 flex-shrink-0 transition-transform duration-200',
                            isProjectExpanded(project.id) && 'rotate-90'
                          )}
                        />
                        <Folder className="w-4 h-4 flex-shrink-0" />
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={(e) => {
                              // Не сохраняем при blur, только при Enter
                              // Это позволяет пользователю кликнуть вне поля без сохранения
                              const relatedTarget = e.relatedTarget as HTMLElement
                              if (!relatedTarget || !relatedTarget.closest('[data-menu-id]')) {
                                handleSaveRename()
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSaveRename()
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                handleCancelRename()
                              }
                            }}
                            className="flex-1 min-w-0 bg-[rgba(255,255,255,0.1)] border border-primary-500 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                            autoFocus
                            disabled={isUpdating}
                          />
                        ) : (
                          <span className="flex-1 min-w-0 text-sm font-medium truncate">
                            {project.name}
                          </span>
                        )}
                      </button>
                      {!isEditing && (
                        <div className="relative flex-shrink-0 ml-1" data-menu-id={`project-${project.id}`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const button = e.currentTarget
                              const rect = button.getBoundingClientRect()
                              if (isMenuOpen) {
                                setOpenMenuId(null)
                                setMenuPosition(null)
                              } else {
                                setOpenMenuId(`project-${project.id}`)
                                // Открываем меню вправо от кнопки, чтобы оно перекрывало основной контент
                                setMenuPosition({
                                  top: rect.bottom + 4,
                                  left: rect.left, // Открываем вправо от левого края кнопки
                                })
                              }
                            }}
                            className={cn(
                              'h-8 w-8 flex items-center justify-center rounded text-[#999] hover:bg-[rgba(20,184,166,0.2)] hover:text-primary-500 transition-all duration-200',
                              isMenuOpen && 'bg-[rgba(20,184,166,0.2)] text-primary-500'
                            )}
                            title="Настройки проекта"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isProjectExpanded(project.id) && (
                      <div className="ml-4 mt-1 space-y-1 border-l border-[rgba(255,255,255,0.1)] pl-4">
                        <div className="flex items-center justify-between mb-1 px-3">
                          <span className="text-xs text-[#999] uppercase tracking-wider">Версии</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openCreateVersionModal(project.id)
                            }}
                            className="h-6 w-6 flex items-center justify-center rounded text-[#999] hover:bg-[rgba(20,184,166,0.1)] hover:text-primary-500 transition-all duration-300"
                            title="Создать новую версию"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        {loadingVersions[project.id] ? (
                          <div className="text-[#ccc] text-sm px-3 py-2">Загрузка версий...</div>
                        ) : projectVersionList.length === 0 ? (
                          <div className="text-[#666] text-sm px-3 py-2">Нет версий</div>
                        ) : (
                          projectVersionList.map((version) => {
                            const versionRoute = getVersionRouteId(version)
                            const isActiveVersion = versionId === versionRoute
                            const isEditing = editingId?.type === 'version' && editingId.id === version.id
                            const isMenuOpen = openMenuId === `version-${version.id}`

                            return (
                              <div key={version.id} className="group relative">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => toggleVersion(version.id)}
                                    className={cn(
                                      'flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200',
                                      isActiveVersion
                                        ? 'bg-[rgba(20,184,166,0.1)] text-primary-500'
                                        : 'text-[#ccc] hover:bg-[rgba(20,184,166,0.05)] hover:text-primary-400'
                                    )}
                                  >
                                    <ChevronRight
                                      className={cn(
                                        'w-3 h-3 flex-shrink-0 transition-transform duration-200',
                                        isVersionExpanded(version.id) && 'rotate-90'
                                      )}
                                    />
                                    <GitBranch className="w-3 h-3 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={editingName}
                                          onChange={(e) => setEditingName(e.target.value)}
                                          onBlur={(e) => {
                                            // Не сохраняем при blur, только при Enter
                                            const relatedTarget = e.relatedTarget as HTMLElement
                                            if (!relatedTarget || !relatedTarget.closest('[data-menu-id]')) {
                                              handleSaveRename()
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault()
                                              handleSaveRename()
                                            } else if (e.key === 'Escape') {
                                              e.preventDefault()
                                              handleCancelRename()
                                            }
                                          }}
                                          className="w-full bg-[rgba(255,255,255,0.1)] border border-primary-500 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                          autoFocus
                                          disabled={isUpdating}
                                        />
                                      ) : (
                                        <div className="text-sm font-medium truncate">{version.name}</div>
                                      )}
                                    </div>
                                  </button>
                                  {!isEditing && (
                                    <div className="relative flex-shrink-0 ml-1" data-menu-id={`version-${version.id}`}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const button = e.currentTarget
                                          const rect = button.getBoundingClientRect()
                                          if (isMenuOpen) {
                                            setOpenMenuId(null)
                                            setMenuPosition(null)
                                          } else {
                                            setOpenMenuId(`version-${version.id}`)
                                            // Открываем меню вправо от кнопки, чтобы оно перекрывало основной контент
                                            setMenuPosition({
                                              top: rect.bottom + 4,
                                              left: rect.left, // Открываем вправо от левого края кнопки
                                            })
                                          }
                                        }}
                                        className={cn(
                                          'h-8 w-8 flex items-center justify-center rounded text-[#999] hover:bg-[rgba(20,184,166,0.2)] hover:text-primary-500 transition-all duration-200',
                                          isMenuOpen && 'bg-[rgba(20,184,166,0.2)] text-primary-500'
                                        )}
                                        title="Настройки версии"
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {isVersionExpanded(version.id) && (
                                  <div className="ml-4 mt-1 space-y-1 border-l border-[rgba(255,255,255,0.1)] pl-4">
                                    <Link
                                      href={`/app/datalab/project/${projectRoute}/version/${versionRoute}/data`}
                                      className={cn(
                                        'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200',
                                        pathname === `/app/datalab/project/${projectRoute}/version/${versionRoute}/data`
                                          ? 'bg-[rgba(20,184,166,0.1)] text-primary-500'
                                          : 'text-[#ccc] hover:bg-[rgba(20,184,166,0.05)] hover:text-primary-400'
                                      )}
                                    >
                                      <Database className="w-4 h-4" />
                                      <span className="text-sm font-medium">Таблица данных</span>
                                    </Link>
                                    <Link
                                      href={`/app/datalab/project/${projectRoute}/version/${versionRoute}/pivot`}
                                      className={cn(
                                        'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200',
                                        pathname === `/app/datalab/project/${projectRoute}/version/${versionRoute}/pivot`
                                          ? 'bg-[rgba(20,184,166,0.1)] text-primary-500'
                                          : 'text-[#ccc] hover:bg-[rgba(20,184,166,0.05)] hover:text-primary-400'
                                      )}
                                    >
                                      <BarChart3 className="w-4 h-4" />
                                      <span className="text-sm font-medium">Pivot-аналитика</span>
                                    </Link>
                                    <Link
                                      href={`/app/datalab/project/${projectRoute}/version/${versionRoute}/reports`}
                                      className={cn(
                                        'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200',
                                        pathname === `/app/datalab/project/${projectRoute}/version/${versionRoute}/reports`
                                          ? 'bg-[rgba(20,184,166,0.1)] text-primary-500'
                                          : 'text-[#ccc] hover:bg-[rgba(20,184,166,0.05)] hover:text-primary-400'
                                      )}
                                    >
                                      <FileBarChart className="w-4 h-4" />
                                      <span className="text-sm font-medium">Отчёты</span>
                                    </Link>
                                    <Link
                                      href={`/app/datalab/project/${projectRoute}/version/${versionRoute}/checks`}
                                      className={cn(
                                        'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200',
                                        pathname === `/app/datalab/project/${projectRoute}/version/${versionRoute}/checks`
                                          ? 'bg-[rgba(20,184,166,0.1)] text-primary-500'
                                          : 'text-[#ccc] hover:bg-[rgba(20,184,166,0.05)] hover:text-primary-400'
                                      )}
                                    >
                                      <CheckSquare className="w-4 h-4" />
                                      <span className="text-sm font-medium">Проверки</span>
                                    </Link>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Модальное окно создания версии проекта */}
        {showCreateVersionModal && selectedProjectForVersion && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[rgba(30,30,30,0.95)] border border-[rgba(255,255,255,0.1)] rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Создать новую версию</h3>
                <button
                  onClick={() => {
                    setShowCreateVersionModal(false)
                    setSelectedProjectForVersion(null)
                    setNewVersionName('')
                    setNewVersionDescription('')
                    setVersionError(null)
                  }}
                  className="text-[#ccc] hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#ccc] mb-2">
                    Проект
                  </label>
                  <div className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2 text-white">
                    {projects.find((p) => p.id === selectedProjectForVersion)?.name || selectedProjectForVersion}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#ccc] mb-2">
                    Название версии *
                  </label>
                  <input
                    type="text"
                    value={newVersionName}
                    onChange={(e) => setNewVersionName(e.target.value)}
                    placeholder="Введите название версии"
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isCreatingVersion) {
                        handleCreateVersion()
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#ccc] mb-2">
                    Описание (необязательно)
                  </label>
                  <textarea
                    value={newVersionDescription}
                    onChange={(e) => setNewVersionDescription(e.target.value)}
                    placeholder="Введите описание версии"
                    rows={3}
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
                  />
                </div>

                {versionError && (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {versionError}
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowCreateVersionModal(false)
                      setSelectedProjectForVersion(null)
                      setNewVersionName('')
                      setNewVersionDescription('')
                      setVersionError(null)
                    }}
                    disabled={isCreatingVersion}
                    className="px-4 py-2 text-[#ccc] hover:text-white transition-colors disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleCreateVersion}
                    disabled={isCreatingVersion || !newVersionName.trim()}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingVersion ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно создания проекта */}
        {showCreateProjectModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[rgba(30,30,30,0.95)] border border-[rgba(255,255,255,0.1)] rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Создать новый проект</h3>
                <button
                  onClick={() => {
                    setShowCreateProjectModal(false)
                    setNewProjectName('')
                    setNewProjectDescription('')
                    setError(null)
                  }}
                  className="text-[#ccc] hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#ccc] mb-2">
                    Название проекта *
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Введите название проекта"
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isCreating) {
                        handleCreateProject()
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#ccc] mb-2">
                    Описание (необязательно)
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Введите описание проекта"
                    rows={3}
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
                  />
                </div>

                {error && (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowCreateProjectModal(false)
                      setNewProjectName('')
                      setNewProjectDescription('')
                      setError(null)
                    }}
                    disabled={isCreating}
                    className="px-4 py-2 text-[#ccc] hover:text-white transition-colors disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleCreateProject}
                    disabled={isCreating || !newProjectName.trim()}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно подтверждения удаления */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[rgba(30,30,30,0.95)] border border-[rgba(255,255,255,0.1)] rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {showDeleteModal.type === 'project' ? 'Удалить проект' : 'Удалить версию'}
                </h3>
                <button
                  onClick={() => setShowDeleteModal(null)}
                  disabled={isDeleting}
                  className="text-[#ccc] hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-[#ccc]">
                  Вы уверены, что хотите удалить{' '}
                  <span className="font-semibold text-white">{showDeleteModal.name}</span>?
                  {showDeleteModal.type === 'project' && (
                    <span className="block mt-2 text-sm text-red-400">
                      Это действие также удалит все версии и данные этого проекта. Это действие нельзя отменить.
                    </span>
                  )}
                  {showDeleteModal.type === 'version' && (
                    <span className="block mt-2 text-sm text-red-400">
                      Это действие также удалит все данные этой версии. Это действие нельзя отменить.
                    </span>
                  )}
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowDeleteModal(null)}
                    disabled={isDeleting}
                    className="px-4 py-2 text-[#ccc] hover:text-white transition-colors disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? 'Удаление...' : 'Удалить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Раздел Загрузка */}
        <div className="border-t border-[rgba(255,255,255,0.1)] pt-4 mb-6">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
            Загрузка
          </h2>
          <Link
            href="/app/datalab/upload"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200',
              pathname === '/app/datalab/upload'
                ? 'bg-[rgba(20,184,166,0.1)] text-primary-500'
                : 'text-[#ccc] hover:bg-[rgba(20,184,166,0.05)] hover:text-primary-400'
            )}
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Загрузка файлов</span>
          </Link>
        </div>

        {/* Навигация внутри DataLab (показывается только при выбранной версии) */}
        {versionId && (
          <div className="border-t border-[rgba(255,255,255,0.1)] pt-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              DataLab
            </h2>
            <nav className="space-y-1">
              {datalabTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = pathname === tab.path
                return (
                  <Link
                    key={tab.id}
                    href={tab.path || '#'}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200',
                      isActive
                        ? 'bg-[rgba(20,184,166,0.1)] text-primary-500'
                        : 'text-[#ccc] hover:bg-[rgba(20,184,166,0.05)] hover:text-primary-400'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.name}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Рендеринг меню через Portal в body для отображения поверх всего контента */}
      {typeof window !== 'undefined' && openMenuId && menuPosition && createPortal(
        <div
          data-menu-dropdown
          className="bg-[rgba(30,30,30,0.95)] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-xl min-w-[160px] backdrop-blur-sm"
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: menuPosition.left !== undefined ? `${menuPosition.left}px` : undefined,
            right: menuPosition.right !== undefined ? `${menuPosition.right}px` : undefined,
            zIndex: 999999, // Максимальный z-index для перекрытия всего контента
            isolation: 'isolate', // Создаем новый stacking context
            pointerEvents: 'auto', // Убеждаемся, что меню интерактивно
          } as React.CSSProperties & { zIndex: number }}
          ref={(el) => {
            // Дополнительно устанавливаем z-index через DOM API для гарантии
            if (el) {
              el.style.setProperty('z-index', '999999', 'important')
            }
          }}
        >
          {openMenuId.startsWith('project-') && (() => {
            const projectId = openMenuId.replace('project-', '')
            const project = projects.find((p) => p.id === projectId)
            if (!project) return null
            return (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRenameProject(project)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-[rgba(20,184,166,0.1)] transition-colors first:rounded-t-lg"
                >
                  <Edit2 className="w-4 h-4" />
                  Переименовать
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteProject(project)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors last:rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              </>
            )
          })()}
          {openMenuId.startsWith('version-') && (() => {
            const versionId = openMenuId.replace('version-', '')
            let version: ProjectVersion | undefined
            let projectId: string | undefined
            for (const proj of projects) {
              const vers = projectVersions[proj.id]?.find((v) => v.id === versionId)
              if (vers) {
                version = vers
                projectId = proj.id
                break
              }
            }
            if (!version || !projectId) return null
            return (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRenameVersion(version!)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-[rgba(20,184,166,0.1)] transition-colors first:rounded-t-lg"
                >
                  <Edit2 className="w-4 h-4" />
                  Переименовать
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteVersion(version!, projectId!)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors last:rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              </>
            )
          })()}
        </div>,
        document.body
      )}
    </aside>
  )
}
