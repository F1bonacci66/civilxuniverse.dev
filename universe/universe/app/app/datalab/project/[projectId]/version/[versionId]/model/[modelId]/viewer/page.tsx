'use client'

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import type React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { ViewerTree } from '@/components/datalab/ViewerTree'
import { ViewerProperties } from '@/components/datalab/ViewerProperties'
import { ViewerGroups } from '@/components/datalab/ViewerGroups'
import { ViewerControls } from '@/components/datalab/ViewerControls'
import { getFileUploads } from '@/lib/api/upload'
import { getViewerStatus, getMetadata, type ViewerMetadata } from '@/lib/api/viewer'
import type { FileUpload } from '@/lib/types/upload'
import { getProject, getProjectVersion } from '@/lib/api/projects'
import type { Viewer3DRef } from '@/components/datalab/Viewer3D'

// Динамически загружаем Viewer3D только на клиенте (без SSR)
// Проблема: dynamic() возвращает LoadableComponent, который не поддерживает ref напрямую
// Решение: используем callback через props для получения ref
const Viewer3D = dynamic(() => import('@/components/datalab/Viewer3D').then(mod => mod.Viewer3D), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  ),
})

export default function ModelViewerPage({
  params,
}: {
  params: { projectId: string; versionId: string; modelId: string }
}) {
  const [loading, setLoading] = useState(true)
  const [fileUpload, setFileUpload] = useState<FileUpload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string>(params.projectId)
  const [versionName, setVersionName] = useState<string>(params.versionId)
  const [hasXKT, setHasXKT] = useState(false)
  const [metadata, setMetadata] = useState<ViewerMetadata | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
  const [hiddenElementIds, setHiddenElementIds] = useState<string[]>([])
  const [isolatedElementIds, setIsolatedElementIds] = useState<string[] | null>(null)
  const [xrayMode, setXrayMode] = useState(false)
  const [displayMode, setDisplayMode] = useState<'wireframe' | 'solid' | 'shaded'>('shaded')
  const viewerRef = useRef<Viewer3DRef>(null)
  
  // Callback для получения ref от Viewer3D компонента
  // Используем callback через props, так как dynamic() не поддерживает ref
  const handleViewerRefReady = useCallback((ref: Viewer3DRef | null) => {
    console.log('[ModelViewerPage] handleViewerRefReady вызван:', ref ? 'ref получен' : 'ref null')
    viewerRef.current = ref
  }, [])

  // Загружаем названия проекта и версии
  useEffect(() => {
    const loadNames = async () => {
      try {
        const [project, version] = await Promise.all([
          getProject(params.projectId),
          getProjectVersion(params.projectId, params.versionId),
        ])
        setProjectName(project.name)
        setVersionName(version.name)
      } catch (err) {
        console.error('Ошибка загрузки названий проекта/версии:', err)
        // Игнорируем ошибки авторизации - редирект уже произошел
        if ((err as any).isAuthRedirect) {
          return
        }
      }
    }
    loadNames()
  }, [params.projectId, params.versionId])

  // Загружаем файлы и находим RVT/IFC файл с XKT
  useEffect(() => {
    const loadFileUpload = async () => {
      try {
        setLoading(true)
        setError(null)

        // Получаем все файлы для версии
        const files = await getFileUploads(params.projectId, params.versionId)

        // Ищем RVT или IFC файл, который соответствует modelId
        // modelId может быть либо file_upload_id, либо model_name
        let rvtFile: FileUpload | undefined = files.find(
          (f) =>
            (f.fileType === 'RVT' || f.fileType === 'IFC') &&
            (f.id === params.modelId || f.modelId === params.modelId)
        )

        // Если не нашли по modelId, берем первый RVT/IFC файл
        if (!rvtFile) {
          rvtFile = files.find((f) => f.fileType === 'RVT' || f.fileType === 'IFC')
        }

        if (!rvtFile) {
          setError('RVT или IFC файл не найден для этой модели')
          setLoading(false)
          return
        }

        // Проверяем, есть ли XKT файл
        try {
          const status = await getViewerStatus(rvtFile.id)
          if (status.has_xkt) {
            setHasXKT(true)
            setFileUpload(rvtFile)

            // Загружаем metadata с объединением данных RVT
            try {
              const metadataData = await getMetadata(rvtFile.id, params.projectId, params.versionId)
              setMetadata(metadataData)
            } catch (metadataErr: any) {
              // Игнорируем ошибки авторизации - редирект уже произошел
              if (metadataErr.isAuthRedirect) {
                return
              }
              console.warn('Не удалось загрузить metadata:', metadataErr)
              // Продолжаем без metadata
            }
          } else {
            setError(
              'XKT файл не найден. Модель еще не была сконвертирована в XKT. Пожалуйста, загрузите RVT файл с опцией "Конвертировать в IFC (3D визуализация)".'
            )
          }
        } catch (statusErr: any) {
          // Игнорируем ошибки авторизации - редирект уже произошел
          if (statusErr.isAuthRedirect) {
            return
          }
          console.error('Ошибка проверки статуса XKT:', statusErr)
          setError('Не удалось проверить статус конвертации XKT')
        }

        setLoading(false)
      } catch (err: any) {
        console.error('Ошибка загрузки файла:', err)
        // Игнорируем ошибки авторизации - редирект уже произошел
        if (err.isAuthRedirect) {
          return
        }
        setError(err.message || 'Ошибка загрузки файла')
        setLoading(false)
      }
    }

    loadFileUpload()
  }, [params.projectId, params.versionId, params.modelId])

  // Обработчики для панелей
  const handleElementSelect = useCallback((elementId: string, event?: MouseEvent) => {
    console.log('[ModelViewerPage] handleElementSelect вызван:', { elementId, ctrlKey: event?.ctrlKey, metaKey: event?.metaKey })
    
    // Если передан пустой elementId, сбрасываем выделение (клик по пустому пространству)
    if (!elementId) {
      console.log('[ModelViewerPage] Пустой elementId, сбрасываем выделение')
      setSelectedElementId(null)
      setSelectedElementIds([])
      if (viewerRef.current) {
        viewerRef.current.selectElements([])
      }
      return
    }

    // Проверяем, что элемент существует в metadata
    if (metadata && metadata.elements && !metadata.elements[elementId]) {
      console.warn(`Элемент ${elementId} не найден в metadata`)
      return
    }
    
    // Проверяем, зажат ли Ctrl или Cmd (для Mac)
    const isCtrlPressed = event?.ctrlKey || event?.metaKey
    console.log('[ModelViewerPage] isCtrlPressed:', isCtrlPressed)

    if (isCtrlPressed) {
      // Множественное выделение: добавляем или убираем элемент
      console.log('[ModelViewerPage] Множественное выделение (Ctrl нажат)')
      setSelectedElementIds((prev) => {
        console.log('[ModelViewerPage] Текущее выделение:', prev)
        if (prev.includes(elementId)) {
          // Убираем элемент из выделения
          const newSelection = prev.filter((id) => id !== elementId)
          console.log('[ModelViewerPage] Убираем элемент из выделения, новое выделение:', newSelection)
          setSelectedElementId(newSelection.length > 0 ? newSelection[0] : null)
          // Обновляем выделение в 3D
          if (viewerRef.current) {
            viewerRef.current.selectElements(newSelection)
          }
          return newSelection
        } else {
          // Добавляем элемент к выделению
          const newSelection = [...prev, elementId]
          console.log('[ModelViewerPage] Добавляем элемент к выделению, новое выделение:', newSelection)
          setSelectedElementId(elementId)
          // Обновляем выделение в 3D
          if (viewerRef.current) {
            viewerRef.current.selectElements(newSelection)
          }
          return newSelection
        }
      })
    } else {
      // Одиночное выделение: выделяем только этот элемент (сбрасываем предыдущее)
      console.log('[ModelViewerPage] Одиночное выделение (Ctrl НЕ нажат), сбрасываем предыдущее выделение')
      setSelectedElementId(elementId)
      setSelectedElementIds([elementId])
      // Выделяем элемент в 3D (только один элемент)
      if (viewerRef.current) {
        viewerRef.current.selectElements([elementId])
      }
    }
  }, [metadata])

  // Обработчик сброса выделения (клик по пустому пространству)
  const handleDeselectAll = useCallback(() => {
    setSelectedElementId(null)
    setSelectedElementIds([])
    if (viewerRef.current) {
      viewerRef.current.selectElements([])
    }
  }, [])

  const handleElementToggleVisibility = useCallback((elementId: string, visible: boolean) => {
    setHiddenElementIds((prev) => {
      if (visible) {
        return prev.filter((id) => id !== elementId)
      } else {
        return [...prev, elementId]
      }
    })
    // Обновляем видимость в 3D
    if (viewerRef.current) {
      if (visible) {
        viewerRef.current.showElements([elementId])
      } else {
        viewerRef.current.hideElements([elementId])
      }
    }
  }, [])

  const handleElementsSelect = useCallback((elementIds: string[]) => {
    setSelectedElementIds(elementIds)
    if (elementIds.length > 0) {
      setSelectedElementId(elementIds[0])
    } else {
      setSelectedElementId(null)
    }
    // Выделяем элементы в 3D
    if (viewerRef.current) {
      viewerRef.current.selectElements(elementIds)
    }
  }, [])

  const handleGroupApply = useCallback((elementIds: string[]) => {
    setSelectedElementIds(elementIds)
    if (elementIds.length > 0) {
      setSelectedElementId(elementIds[0])
    } else {
      setSelectedElementId(null)
    }
    // Выделяем элементы в 3D
    if (viewerRef.current) {
      viewerRef.current.selectElements(elementIds)
    }
  }, [])

  const handleHide = useCallback(() => {
    console.log('[ViewerControls] Кнопка "Скрыть" нажата, выделено элементов:', selectedElementIds.length)
    if (selectedElementIds.length === 0) {
      console.warn('[ViewerControls] Нет выделенных элементов для скрытия')
      return
    }
    console.log('[ViewerControls] Скрываем элементы:', selectedElementIds)
    setHiddenElementIds((prev) => {
      const newHidden = [...new Set([...prev, ...selectedElementIds])]
      console.log('[ViewerControls] Новый список скрытых элементов:', newHidden.length, 'элементов')
      return newHidden
    })
    if (viewerRef.current) {
      viewerRef.current.hideElements(selectedElementIds)
      console.log('[ViewerControls] ✅ Вызван viewerRef.current.hideElements')
    } else {
      console.warn('[ViewerControls] ⚠️ viewerRef.current недоступен')
    }
  }, [selectedElementIds])

  const handleShow = useCallback(() => {
    console.log('[ViewerControls] Кнопка "Показать" нажата, скрыто элементов:', hiddenElementIds.length)
    if (hiddenElementIds.length === 0) {
      console.warn('[ViewerControls] Нет скрытых элементов для показа')
      return
    }
    // Показываем все скрытые элементы
    const elementsToShow = [...hiddenElementIds]
    console.log('[ViewerControls] Показываем элементы:', elementsToShow)
    setHiddenElementIds([])
    if (viewerRef.current) {
      viewerRef.current.showElements(elementsToShow)
      console.log('[ViewerControls] ✅ Вызван viewerRef.current.showElements')
    } else {
      console.warn('[ViewerControls] ⚠️ viewerRef.current недоступен')
    }
  }, [hiddenElementIds])

  const handleIsolate = useCallback(() => {
    console.log('[ViewerControls] Кнопка "Изолировать" нажата, выделено элементов:', selectedElementIds.length)
    if (selectedElementIds.length === 0) {
      console.warn('[ViewerControls] Нет выделенных элементов для изоляции')
      return
    }
    console.log('[ViewerControls] Изолируем элементы:', selectedElementIds)
    setIsolatedElementIds(selectedElementIds)
    if (viewerRef.current) {
      viewerRef.current.isolateElements(selectedElementIds)
      console.log('[ViewerControls] ✅ Вызван viewerRef.current.isolateElements')
    } else {
      console.warn('[ViewerControls] ⚠️ viewerRef.current недоступен')
    }
  }, [selectedElementIds])

  const handleReset = useCallback(() => {
    console.log('[ViewerControls] Кнопка "Сбросить" нажата')
    console.log('[ViewerControls] Текущее состояние:', {
      hidden: hiddenElementIds.length,
      isolated: isolatedElementIds?.length || 0,
      selected: selectedElementIds.length,
    })
    // Сохраняем список скрытых элементов перед сбросом
    const hiddenToShow = [...hiddenElementIds]
    setHiddenElementIds([])
    setIsolatedElementIds(null)
    setSelectedElementIds([])
    setSelectedElementId(null)
    if (viewerRef.current) {
      // Сбрасываем изоляцию (показываем все элементы)
      viewerRef.current.isolateElements(null)
      console.log('[ViewerControls] ✅ Вызван viewerRef.current.isolateElements(null)')
      // Показываем все ранее скрытые элементы
      if (hiddenToShow.length > 0) {
        viewerRef.current.showElements(hiddenToShow)
        console.log('[ViewerControls] ✅ Вызван viewerRef.current.showElements для', hiddenToShow.length, 'элементов')
      }
      // Сбрасываем выделение
      viewerRef.current.selectElements([])
      console.log('[ViewerControls] ✅ Вызван viewerRef.current.selectElements([])')
    } else {
      console.warn('[ViewerControls] ⚠️ viewerRef.current недоступен')
    }
  }, [hiddenElementIds, isolatedElementIds, selectedElementIds])

  const handleXrayToggle = useCallback(() => {
    console.log('[ViewerControls] Кнопка "X-ray" нажата, текущий режим:', xrayMode)
    setXrayMode((prev) => {
      const newValue = !prev
      console.log('[ViewerControls] Переключаем X-ray режим на:', newValue)
      if (viewerRef.current) {
        viewerRef.current.setXrayMode(newValue)
        console.log('[ViewerControls] ✅ Вызван viewerRef.current.setXrayMode(', newValue, ')')
      } else {
        console.warn('[ViewerControls] ⚠️ viewerRef.current недоступен')
      }
      return newValue
    })
  }, [xrayMode])

  const handleDisplayModeChange = useCallback((mode: 'wireframe' | 'solid' | 'shaded') => {
    console.log('[ViewerControls] Изменение режима отображения:', mode, '(было:', displayMode, ')')
    setDisplayMode(mode)
    if (viewerRef.current) {
      viewerRef.current.setDisplayMode(mode)
      console.log('[ViewerControls] ✅ Вызван viewerRef.current.setDisplayMode(', mode, ')')
    } else {
      console.warn('[ViewerControls] ⚠️ viewerRef.current недоступен')
    }
  }, [displayMode])

  const handleFitToView = useCallback(() => {
    console.log('[ViewerControls] Кнопка "Подогнать под экран" нажата')
    if (viewerRef.current) {
      viewerRef.current.fitToView()
      console.log('[ViewerControls] ✅ Вызван viewerRef.current.fitToView()')
    } else {
      console.warn('[ViewerControls] ⚠️ viewerRef.current недоступен')
    }
  }, [])

  return (
    <div className="h-full w-full">
      <div className="h-full w-full p-8">
        <div className="mb-6">
          <Link
            href={`/app/datalab/project/${params.projectId}/version/${params.versionId}/model/${params.modelId}/data`}
            className="text-primary-500 hover:text-primary-400 text-sm mb-4 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к данным модели
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gradient mb-2">3D Viewer</h1>
              <p className="text-[#ccc] text-lg">
                Проект: {projectName} | Версия: {versionName}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-12 border border-[rgba(255,255,255,0.1)] text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-500" />
            <p className="text-[#999]">Загрузка 3D модели...</p>
          </div>
        ) : error ? (
          <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-red-500/50">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">Ошибка загрузки 3D модели</p>
            </div>
            <p className="text-[#999] text-sm">{error}</p>
            {!hasXKT && (
              <div className="mt-4">
                <Link
                  href="/app/datalab/upload"
                  className="text-primary-500 hover:text-primary-400 text-sm underline"
                >
                  Перейти на страницу загрузки файлов
                </Link>
              </div>
            )}
          </div>
        ) : fileUpload ? (
          <div className="flex gap-4 h-[calc(100vh-250px)] min-h-[600px]">
            {/* Левая панель: Дерево и Наборы */}
            <div className="w-80 flex flex-col gap-4 flex-shrink-0">
              {/* Дерево элементов */}
              <div className="flex-1 min-h-0">
                <ViewerTree
                  metadata={metadata}
                  selectedElementIds={selectedElementIds}
                  hiddenElementIds={hiddenElementIds}
                  onElementSelect={handleElementSelect}
                  onElementToggleVisibility={handleElementToggleVisibility}
                  onElementsSelect={handleElementsSelect}
                  className="h-full"
                />
              </div>

              {/* Наборы элементов */}
              <div className="h-80 flex-shrink-0">
                <ViewerGroups
                  fileUploadId={fileUpload.id}
                  selectedElementIds={selectedElementIds}
                  onGroupApply={handleGroupApply}
                  className="h-full"
                />
              </div>
            </div>

            {/* Центральная область: 3D Viewer */}
            <div className="flex-1 min-w-0 bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg border border-[rgba(255,255,255,0.1)] overflow-hidden relative">
              <Viewer3D
                fileUploadId={fileUpload.id}
                selectedElementIds={selectedElementIds}
                hiddenElementIds={hiddenElementIds}
                isolatedElementIds={isolatedElementIds}
                xrayMode={xrayMode}
                displayMode={displayMode}
                onElementSelect={handleElementSelect}
                onDeselectAll={handleDeselectAll}
                onRefReady={handleViewerRefReady}
                projectId={params.projectId}
                versionId={params.versionId}
                className="w-full h-full"
              />

              {/* Кнопки управления (в правом верхнем углу 3D viewer) */}
              <div className="absolute top-4 right-4 z-20">
                <ViewerControls
                  selectedElementIds={selectedElementIds}
                  hiddenElementIds={hiddenElementIds}
                  isolatedElementIds={isolatedElementIds}
                  xrayMode={xrayMode}
                  displayMode={displayMode}
                  onHide={handleHide}
                  onShow={handleShow}
                  onIsolate={handleIsolate}
                  onReset={handleReset}
                  onXrayToggle={handleXrayToggle}
                  onDisplayModeChange={handleDisplayModeChange}
                  onFitToView={handleFitToView}
                  className="w-64"
                />
              </div>
            </div>

            {/* Правая панель: Свойства */}
            <div className="w-80 flex-shrink-0">
              <ViewerProperties
                metadata={metadata}
                selectedElementId={selectedElementId}
                className="h-full"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

