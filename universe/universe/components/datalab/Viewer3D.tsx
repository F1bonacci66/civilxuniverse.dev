'use client'

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { getMetadata, type ViewerMetadata } from '@/lib/api/viewer'
import { getAuthHeaders } from '@/lib/api/auth'
import { getApiClient } from '@/lib/api/client'
import { cn } from '@/lib/utils'

interface Viewer3DProps {
  fileUploadId: string
  className?: string
  onLoad?: () => void
  onError?: (error: Error) => void
  selectedElementIds?: string[]
  hiddenElementIds?: string[]
  isolatedElementIds?: string[] | null
  xrayMode?: boolean
  displayMode?: 'wireframe' | 'solid' | 'shaded'
  onElementSelect?: (elementId: string, event?: MouseEvent) => void
  onDeselectAll?: () => void
  onViewerReady?: (viewer: any) => void
  onRefReady?: (ref: Viewer3DRef | null) => void
  projectId?: string  // ID проекта для загрузки RVT данных
  versionId?: string  // ID версии для загрузки RVT данных
}

export interface Viewer3DRef {
  viewer: any | null
  selectElements: (elementIds: string[]) => void
  hideElements: (elementIds: string[]) => void
  showElements: (elementIds: string[]) => void
  isolateElements: (elementIds: string[] | null) => void
  setXrayMode: (enabled: boolean) => void
  setDisplayMode: (mode: 'wireframe' | 'solid' | 'shaded') => void
  fitToView: () => void
}

export const Viewer3D = forwardRef<Viewer3DRef, Viewer3DProps>(
  (
    {
      fileUploadId,
      className,
      onLoad,
      onError,
      selectedElementIds = [],
      hiddenElementIds = [],
      isolatedElementIds = null,
      xrayMode = false,
      displayMode = 'shaded',
      onElementSelect,
      onDeselectAll,
      onViewerReady,
      onRefReady,
      projectId,
      versionId,
    },
    ref
  ) => {
    // Логируем полученные props для отладки
    console.log('🔵 [Viewer3D] Props получены:', { fileUploadId, projectId, versionId })
    
    const containerRef = useRef<HTMLDivElement>(null)
    const viewerRef = useRef<any>(null)
    const modelRef = useRef<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [metadata, setMetadata] = useState<ViewerMetadata | null>(null)

  useEffect(() => {
    // Проверяем, что мы на клиенте
    if (typeof window === 'undefined') return
    if (!containerRef.current) return

    let isMounted = true

    const initViewer = async () => {
      try {
        setLoading(true)
        setError(null)

        // Динамически импортируем Xeokit SDK только на клиенте
        const { Viewer, XKTLoaderPlugin } = await import('@xeokit/xeokit-sdk')

        // Создаем контейнер для viewer
        const container = containerRef.current
        if (!container) return

        // Создаем canvas элемент внутри контейнера
        const canvasId = `viewer-canvas-${fileUploadId}`
        const canvas = document.createElement('canvas')
        canvas.id = canvasId
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.display = 'block'
        container.innerHTML = ''
        container.appendChild(canvas)

        // Убеждаемся, что canvas имеет размеры перед инициализацией viewer
        // Это важно для правильной инициализации Xeokit
        if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
          // Если canvas еще не имеет размеров, ждем следующего кадра
          await new Promise((resolve) => requestAnimationFrame(resolve))
        }

        // Инициализируем Xeokit Viewer с canvas
        const viewerInstance = new Viewer({
          canvasId: canvasId,
          transparent: true,
          saoEnabled: true,
          pbrEnabled: false,
        })

        viewerRef.current = viewerInstance

        // Ждем, пока viewer полностью инициализируется
        // Проверяем, что scene создана и готова к использованию
        const waitForViewerReady = (): Promise<void> => {
          return new Promise((resolve, reject) => {
            let attempts = 0
            const maxAttempts = 50 // Максимум 5 секунд (50 * 100ms)
            
            const checkReady = () => {
              attempts++
              
              // Проверяем, что scene существует и инициализирована
              if (viewerInstance.scene && viewerInstance.scene.canvas) {
                resolve()
                return
              }
              
              if (attempts >= maxAttempts) {
                reject(new Error('Viewer не инициализировался в течение 5 секунд'))
                return
              }
              
              // Проверяем снова через 100ms
              setTimeout(checkReady, 100)
            }
            
            checkReady()
          })
        }

        // Ждем готовности viewer
        await waitForViewerReady()

        // Загружаем metadata с объединением данных RVT (если переданы projectId и versionId)
        try {
          const metadataData = await getMetadata(fileUploadId, projectId, versionId)
          if (isMounted) {
            setMetadata(metadataData)
          }
        } catch (err: any) {
          // Игнорируем ошибки авторизации - редирект уже произошел
          if (err.isAuthRedirect) {
            return
          }
          console.warn('Не удалось загрузить metadata:', err)
          // Продолжаем без metadata
        }

        // Загружаем XKT файл через fetch с заголовками авторизации
        // XKTLoaderPlugin не поддерживает передачу заголовков, поэтому используем прямой URL с токеном
        const { baseURL: API_BASE_URL } = getApiClient()
        const { getAuthToken } = await import('@/lib/api/auth')
        const token = getAuthToken()
        
        if (!token) {
          window.location.href = '/auth/login'
          throw new Error('Требуется авторизация')
        }
        
        const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '')
        // Используем прямой URL с токеном в query параметре для XKTLoaderPlugin
        // Это временное решение, так как XKTLoaderPlugin не поддерживает заголовки авторизации
        const xktUrl = `${cleanBaseUrl}/viewer/${fileUploadId}/xkt?token=${encodeURIComponent(token)}`

        // Проверяем, что viewer все еще готов перед созданием XKTLoaderPlugin
        if (!viewerInstance.scene) {
          throw new Error('Viewer scene не инициализирована')
        }

        // Дополнительная проверка: убеждаемся, что viewer.scene.models существует
        if (!viewerInstance.scene.models) {
          console.warn('[Viewer3D] viewer.scene.models не существует, ожидаем инициализации...')
          // Ждем еще немного для инициализации models
          await new Promise(resolve => setTimeout(resolve, 200))
          
          if (!viewerInstance.scene.models) {
            throw new Error('Viewer scene.models не инициализирована после ожидания')
          }
        }

        // Загружаем XKTLoaderPlugin
        const xktLoader = new XKTLoaderPlugin(viewerInstance)

        // Загружаем модель через прямой URL к API с токеном
        // XKTLoaderPlugin.load() возвращает промис, который резолвится когда модель загружена
        console.log('[Viewer3D] Загрузка XKT модели:', { 
          fileUploadId, 
          xktUrl, 
          viewerReady: !!viewerInstance.scene,
          hasModels: !!viewerInstance.scene.models,
          canvasReady: !!viewerInstance.scene.canvas
        })
        
        const model = await xktLoader.load({
          id: `model-${fileUploadId}`,
          src: xktUrl,
          edges: true,
        })
        
        if (!model) {
          // Проверяем, что URL доступен
          try {
            const testResponse = await fetch(xktUrl, { method: 'HEAD' })
            if (!testResponse.ok) {
              throw new Error(`XKT файл недоступен: ${testResponse.status} ${testResponse.statusText}`)
            }
          } catch (fetchErr: any) {
            throw new Error(`Ошибка доступа к XKT файлу: ${fetchErr.message}`)
          }
          
          throw new Error(`XKTLoaderPlugin.load() вернул null для модели ${fileUploadId}. Viewer: scene=${!!viewerInstance.scene}, models=${!!viewerInstance.scene?.models}, canvas=${!!viewerInstance.scene?.canvas}`)
        }
        
        console.log('[Viewer3D] Модель загружена успешно:', model.id)
        modelRef.current = model

        // Настраиваем обработчик клика для выделения элементов
        // Отслеживаем состояние Ctrl/Cmd глобально
        let isCtrlPressed = false
        const viewerCanvas = viewerInstance.scene.canvas.canvas
        
        console.log('[Viewer3D] Настройка обработчиков клика, canvas:', viewerCanvas)
        
        // Обработчики для отслеживания состояния Ctrl/Cmd
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Control' || e.key === 'Meta') {
            isCtrlPressed = true
            console.log('[Viewer3D] Ctrl/Cmd нажата')
          }
        }
        
        const handleKeyUp = (e: KeyboardEvent) => {
          if (e.key === 'Control' || e.key === 'Meta') {
            isCtrlPressed = false
            console.log('[Viewer3D] Ctrl/Cmd отпущена')
          }
        }
        
        const handleMouseDown = (e: MouseEvent) => {
          // Обновляем состояние Ctrl/Cmd при клике мыши
          isCtrlPressed = e.ctrlKey || e.metaKey
          console.log('[Viewer3D] mousedown на canvas, isCtrlPressed:', isCtrlPressed, 'target:', e.target)
        }
        
        // Добавляем обработчики
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        viewerCanvas.addEventListener('mousedown', handleMouseDown)
        console.log('[Viewer3D] Обработчики keydown/keyup/mousedown добавлены')

        // Настраиваем обработчик picked события
        const setupClickHandler = async () => {
          console.log('[Viewer3D] setupClickHandler вызван')
          
          // Загружаем metadata для проверки элементов
          let metadataForCheck: ViewerMetadata | null = null
          try {
            metadataForCheck = await getMetadata(fileUploadId)
            console.log('[Viewer3D] Metadata загружен, элементов:', metadataForCheck?.elements ? Object.keys(metadataForCheck.elements).length : 0)
          } catch (err) {
            console.warn('[Viewer3D] Не удалось загрузить metadata для проверки элементов:', err)
          }

          // Регистрируем обработчик picked события
          console.log('[Viewer3D] Регистрация обработчика picked события')
          viewerInstance.cameraControl.on('picked', (pickResult: any) => {
            console.log('[Viewer3D] picked событие получено:', { 
              hasPickResult: !!pickResult, 
              hasEntity: !!pickResult?.entity,
              entityId: pickResult?.entity?.id,
              isCtrlPressed 
            })
            
            if (onElementSelect) {
              if (pickResult && pickResult.entity) {
                // Клик по элементу
                const entityId = pickResult.entity.id
                // entityId может быть в формате "model-{fileUploadId}#{elementId}"
                const elementId = entityId.split('#').pop() || entityId
                
                // Создаем синтетическое событие с информацией о Ctrl
                const syntheticEvent = {
                  ctrlKey: isCtrlPressed,
                  metaKey: isCtrlPressed,
                } as MouseEvent
                
                console.log('[Viewer3D] picked event, elementId:', elementId, 'isCtrlPressed:', isCtrlPressed)
                
                // Проверяем, существует ли элемент в metadata
                if (metadataForCheck && metadataForCheck.elements && metadataForCheck.elements[elementId]) {
                  // Передаем элемент и информацию о Ctrl
                  console.log('[Viewer3D] Вызываем onElementSelect с elementId:', elementId)
                  onElementSelect(elementId, syntheticEvent)
                } else {
                  // Если metadata еще не загружен, все равно вызываем callback
                  // Родительский компонент проверит наличие элемента
                  console.log('[Viewer3D] Metadata не загружен или элемент не найден, но вызываем onElementSelect с elementId:', elementId)
                  onElementSelect(elementId, syntheticEvent)
                }
              } else {
                // Клик по пустому пространству - сбрасываем выделение
                console.log('[Viewer3D] Клик по пустому пространству')
                if (onDeselectAll) {
                  onDeselectAll()
                }
              }
            } else {
              console.warn('[Viewer3D] onElementSelect не определен')
            }
          })
          console.log('[Viewer3D] Обработчик picked события зарегистрирован')
        }
        setupClickHandler()

        // Фокусируемся на модели
        viewerInstance.cameraFlight.flyTo({
          aabb: model.aabb,
          duration: 1.0,
        })

        // Уведомляем родительский компонент о готовности viewer
        if (onViewerReady) {
          onViewerReady(viewerInstance)
        }

        if (isMounted) {
          setLoading(false)
          onLoad?.()
          
          // Вызываем onRefReady после загрузки модели
          // Создаем ref объект с методами
          const refObject: Viewer3DRef = {
            viewer: viewerRef.current,
            selectElements,
            hideElements,
            showElements,
            isolateElements,
            setXrayMode,
            setDisplayMode,
            fitToView,
          }
          
          if (onRefReady) {
            onRefReady(refObject)
            console.log('[Viewer3D] onRefReady вызван после загрузки модели')
          }
        }
        
        // Сохраняем cleanup функцию для вызова при размонтировании
        const cleanupClickHandlers = () => {
          console.log('[Viewer3D] Выполняется cleanup обработчиков')
          window.removeEventListener('keydown', handleKeyDown)
          window.removeEventListener('keyup', handleKeyUp)
          viewerCanvas.removeEventListener('mousedown', handleMouseDown)
          console.log('[Viewer3D] Обработчики клика удалены')
        }
        
        // Возвращаем cleanup функцию для useEffect
        return cleanupClickHandlers
      } catch (err: any) {
        console.error('Ошибка инициализации 3D Viewer:', err)
        if (isMounted) {
          setError(err.message || 'Ошибка загрузки 3D модели')
          setLoading(false)
          onError?.(err)
        }
      }
    }

    initViewer()

    // Cleanup при размонтировании
    return () => {
      isMounted = false
      
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy()
        } catch (err) {
          console.error('Ошибка при уничтожении viewer:', err)
        }
        viewerRef.current = null
      }
      modelRef.current = null
    }
  }, [fileUploadId, projectId, versionId, onLoad, onError, onElementSelect, onViewerReady])

  // Сохраняем список ранее выделенных элементов для правильного сброса цвета
  const previouslySelectedEntitiesRef = useRef<any[]>([])
  // Сохраняем оригинальные цвета элементов для восстановления
  const originalColorsRef = useRef<Map<string, any>>(new Map())

  // Функция для получения текущего цвета entity
  const getEntityColor = (entity: any): any => {
    // Пробуем получить цвет из разных источников
    let currentColor: any = null
    
    // Метод 1: через entity.colorize
    if (entity.colorize !== undefined) {
      if (typeof entity.colorize === 'function') {
        // Если это функция, пытаемся получить значение через свойство (если доступно)
        // В Xeokit colorize может быть функцией, но значение может храниться в другом месте
        // Проверяем, есть ли свойство для чтения
        if (entity._colorize !== undefined) {
          currentColor = entity._colorize
        } else {
          // Если нет свойства для чтения, возвращаем null (базовый цвет)
          currentColor = null
        }
      } else {
        currentColor = entity.colorize
      }
    }
    
    // Метод 2: через entity.material.colorize
    if (currentColor === null && entity.material?.colorize !== undefined) {
      currentColor = entity.material.colorize
    }
    
    // Метод 3: через entity.material.color
    if (currentColor === null && entity.material?.color !== undefined) {
      currentColor = entity.material.color
    }
    
    // Проверяем, не является ли текущий цвет синим цветом выделения
    const blueColor: [number, number, number] = [0.23, 0.51, 0.96]
    if (currentColor !== null && Array.isArray(currentColor) && currentColor.length >= 3) {
      const isBlueColor = 
        Math.abs(currentColor[0] - blueColor[0]) < 0.01 &&
        Math.abs(currentColor[1] - blueColor[1]) < 0.01 &&
        Math.abs(currentColor[2] - blueColor[2]) < 0.01
      
      if (isBlueColor) {
        // Если текущий цвет - это синий цвет выделения, возвращаем null (базовый цвет)
        console.log('[Viewer3D] Текущий цвет - синий цвет выделения, возвращаем null (базовый цвет)')
        return null
      }
    }
    
    // Если цвет не найден или это синий цвет выделения, возвращаем null (будет использован базовый цвет)
    return currentColor
  }

  // Функция для восстановления оригинального цвета entity
  const restoreEntityColor = (entity: any, originalColor: any) => {
    try {
      const entityId = entity.id || entity.entityId
      
      console.log('[Viewer3D] restoreEntityColor вызван для entity:', entityId, 'originalColor:', originalColor)
      
      // Если оригинальный цвет null, значит элемент был без цвета - сбрасываем colorize
      if (originalColor === null || originalColor === undefined) {
        console.log('[Viewer3D] Оригинальный цвет null/undefined, сбрасываем к базовому цвету для entity:', entityId)
        
        // Сбрасываем colorize (null означает сброс к базовому цвету)
        if (typeof entity.colorize === 'function') {
          entity.colorize(null) // null = сброс к базовому цвету
          console.log('[Viewer3D] ✅ colorize(null) вызван для entity:', entityId)
        } else if (entity.colorize !== undefined) {
          entity.colorize = null
          console.log('[Viewer3D] ✅ colorize = null установлен для entity:', entityId)
        }
        
        // Также пробуем через scene.setObjectsColorized
        const scene = viewerRef.current?.scene
        if (scene && typeof scene.setObjectsColorized === 'function') {
          try {
            scene.setObjectsColorized([entity], null)
            console.log('[Viewer3D] ✅ scene.setObjectsColorized([entity], null) вызван для entity:', entityId)
          } catch (err) {
            console.warn('[Viewer3D] ⚠️ Ошибка при вызове scene.setObjectsColorized:', err)
          }
        }
        
        console.log('[Viewer3D] ✅ Восстановлен базовый цвет (null) для entity:', entityId)
        return
      }
      
      // Восстанавливаем сохраненный цвет
      // Если originalColor - это Float32Array или массив, используем его значения
      let colorToRestore: any = originalColor
      
      if (originalColor instanceof Float32Array) {
        // Преобразуем Float32Array в обычный массив для совместимости
        colorToRestore = [originalColor[0], originalColor[1], originalColor[2]]
        console.log('[Viewer3D] Преобразован Float32Array в массив:', colorToRestore)
      }
      
      // Метод 1: через entity.colorize
      if (typeof entity.colorize === 'function') {
        entity.colorize(colorToRestore)
        console.log('[Viewer3D] ✅ Цвет восстановлен через entity.colorize() для entity:', entityId, colorToRestore)
      } else if (entity.colorize !== undefined) {
        entity.colorize = colorToRestore
        console.log('[Viewer3D] ✅ Цвет восстановлен через entity.colorize = для entity:', entityId, colorToRestore)
      }
      
      // Метод 2: через entity.material
      if (entity.material) {
        if (entity.material.colorize) {
          if (typeof entity.material.colorize === 'function') {
            entity.material.colorize(colorToRestore)
            console.log('[Viewer3D] ✅ Цвет восстановлен через entity.material.colorize() для entity:', entityId)
          } else {
            entity.material.colorize = colorToRestore
            console.log('[Viewer3D] ✅ Цвет восстановлен через entity.material.colorize = для entity:', entityId)
          }
        } else if (entity.material.color) {
          if (Array.isArray(colorToRestore) && typeof entity.material.color.setRGB === 'function') {
            entity.material.color.setRGB(colorToRestore[0], colorToRestore[1], colorToRestore[2])
            console.log('[Viewer3D] ✅ Цвет восстановлен через entity.material.color.setRGB() для entity:', entityId)
          } else if (typeof entity.material.color.copy === 'function') {
            entity.material.color.copy(originalColor)
            console.log('[Viewer3D] ✅ Цвет восстановлен через entity.material.color.copy() для entity:', entityId)
          } else if (Array.isArray(colorToRestore) && typeof entity.material.color.set === 'function') {
            entity.material.color.set(colorToRestore[0], colorToRestore[1], colorToRestore[2])
            console.log('[Viewer3D] ✅ Цвет восстановлен через entity.material.color.set() для entity:', entityId)
          }
        }
      }
      
      // Метод 3: через scene.setObjectsColorized (дополнительно)
      const scene = viewerRef.current?.scene
      if (scene && typeof scene.setObjectsColorized === 'function') {
        try {
          scene.setObjectsColorized([entity], colorToRestore)
          console.log('[Viewer3D] ✅ Дополнительно: цвет восстановлен через scene.setObjectsColorized для entity:', entityId)
        } catch (err) {
          console.warn('[Viewer3D] ⚠️ Ошибка при вызове scene.setObjectsColorized:', err)
        }
      }
      
      console.log('[Viewer3D] ✅ Восстановлен оригинальный цвет для entity:', entityId, 'цвет:', colorToRestore)
    } catch (err) {
      console.error('[Viewer3D] ❌ Ошибка при восстановлении цвета для entity:', entity.id, err)
    }
  }

  // Утилиты для управления viewer (обернуты в useCallback для стабильности ссылок)
  const selectElements = useCallback((elementIds: string[]) => {
    console.log('[Viewer3D] selectElements вызван:', { elementIds, count: elementIds.length })
    
    if (!viewerRef.current || !modelRef.current) {
      console.warn('[Viewer3D] selectElements: viewerRef или modelRef не готовы')
      return
    }

    const scene = viewerRef.current.scene

    // Очищаем предыдущее выделение и восстанавливаем оригинальный цвет для ВСЕХ ранее выделенных элементов
    const previouslySelected = previouslySelectedEntitiesRef.current
    if (previouslySelected.length > 0) {
      console.log('[Viewer3D] Очищаем предыдущее выделение:', previouslySelected.length, 'элементов')
      
      // Сбрасываем выделение через setObjectsSelected
      scene.setObjectsSelected(previouslySelected, false)
      
      // Восстанавливаем оригинальный цвет для всех ранее выделенных элементов
      previouslySelected.forEach((entity: any) => {
        const entityId = entity.id || entity.entityId
        const originalColor = originalColorsRef.current.get(entityId)
        
        console.log('[Viewer3D] Восстановление цвета для entity:', entityId, 'оригинальный цвет:', originalColor)
        
        if (originalColor !== undefined) {
          restoreEntityColor(entity, originalColor)
          // Удаляем сохраненный цвет после восстановления
          originalColorsRef.current.delete(entityId)
        } else {
          // Если оригинальный цвет не был сохранен, сбрасываем к базовому
          console.log('[Viewer3D] Оригинальный цвет не найден, сбрасываем к базовому для entity:', entityId)
          restoreEntityColor(entity, null)
        }
      })
      
      console.log('[Viewer3D] ✅ Оригинальный цвет восстановлен для', previouslySelected.length, 'ранее выделенных элементов')
      
      // Обновляем сцену после восстановления цвета
      if (scene.update) {
        scene.update()
        console.log('[Viewer3D] Сцена обновлена после восстановления цвета')
      }
      
      // Принудительно обновляем рендеринг
      if (viewerRef.current && typeof viewerRef.current.scene.render === 'function') {
        viewerRef.current.scene.render()
        console.log('[Viewer3D] Рендеринг сцены принудительно обновлен после восстановления цвета')
      }
    }
    
    // Очищаем список ранее выделенных элементов (будет заполнен новыми элементами ниже, если есть)
    previouslySelectedEntitiesRef.current = []

    // Выделяем новые элементы и устанавливаем синий цвет
    // Синий цвет в RGB: [0.23, 0.51, 0.96] (примерно #3b82f6)
    const blueColor: [number, number, number] = [0.23, 0.51, 0.96]
    const entitiesToSelect: any[] = []
    
    // Логируем информацию о модели и сцене для отладки
    console.log('[Viewer3D] Поиск entities:', {
      modelId: modelRef.current?.id,
      elementIds,
      sceneObjectsCount: Object.keys(scene.objects).length,
      sampleEntityIds: Object.keys(scene.objects).slice(0, 5),
    })
    
    elementIds.forEach((elementId) => {
      // Пытаемся найти entity по elementId
      // Формат ID в Xeokit: {modelId}#{elementId}
      const entityId = `${modelRef.current.id}#${elementId}`
      let entity = scene.objects[entityId]
      
      // Если не нашли, пробуем другие варианты формата ID
      if (!entity) {
        // Пробуем без префикса модели
        entity = scene.objects[elementId]
      }
      
      // Если все еще не нашли, ищем по частичному совпадению
      if (!entity) {
        const matchingKey = Object.keys(scene.objects).find(key => 
          key.endsWith(`#${elementId}`) || key === elementId
        )
        if (matchingKey) {
          entity = scene.objects[matchingKey]
          console.log('[Viewer3D] Entity найден по частичному совпадению:', matchingKey)
        }
      }
      
      if (entity) {
        entitiesToSelect.push(entity)
        console.log('[Viewer3D] ✅ Entity найден:', entityId, '→', entity.id || entity.entityId || 'unknown')
      } else {
        console.warn('[Viewer3D] ❌ Entity не найден:', entityId, {
          triedFormats: [
            `${modelRef.current.id}#${elementId}`,
            elementId,
          ],
          availableKeys: Object.keys(scene.objects).filter(k => k.includes(elementId)).slice(0, 5),
        })
      }
    })
    
    console.log('[Viewer3D] Найдено entities для выделения:', entitiesToSelect.length, 'из', elementIds.length)
    
    // Выделяем все элементы сразу
    if (entitiesToSelect.length > 0) {
      // Сначала выделяем через setObjectsSelected
      scene.setObjectsSelected(entitiesToSelect, true)
      console.log('[Viewer3D] Элементы выделены через setObjectsSelected')
      
      // Устанавливаем синий цвет для выделенных элементов
      // ВАЖНО: Сначала сохраняем оригинальный цвет, затем устанавливаем синий
      entitiesToSelect.forEach((entity: any) => {
        try {
          const entityId = entity.id || entity.entityId
          
          // Сохраняем оригинальный цвет, если он еще не сохранен
          // КРИТИЧЕСКИ ВАЖНО: Сохраняем оригинальный цвет ДО установки синего цвета
          if (!originalColorsRef.current.has(entityId)) {
            // Получаем текущий цвет ПЕРЕД любыми изменениями
            const originalColor = getEntityColor(entity)
            
            // Проверяем, не является ли текущий цвет синим цветом выделения
            const blueColor: [number, number, number] = [0.23, 0.51, 0.96]
            let colorToSave = originalColor
            
            if (originalColor !== null) {
              // Если это массив или Float32Array, проверяем значения
              if (Array.isArray(originalColor) || (originalColor instanceof Float32Array)) {
                const r = originalColor[0]
                const g = originalColor[1]
                const b = originalColor[2]
                
                const isBlueColor = 
                  Math.abs(r - blueColor[0]) < 0.01 &&
                  Math.abs(g - blueColor[1]) < 0.01 &&
                  Math.abs(b - blueColor[2]) < 0.01
                
                if (isBlueColor) {
                  // Если текущий цвет - это синий цвет выделения, сохраняем null (базовый цвет)
                  console.log('[Viewer3D] ⚠️ Текущий цвет - синий цвет выделения, сохраняем null (базовый цвет) для entity:', entityId)
                  colorToSave = null
                }
              }
            }
            
            originalColorsRef.current.set(entityId, colorToSave)
            console.log('[Viewer3D] Сохранен оригинальный цвет для entity:', entityId, {
              originalColor,
              savedAs: colorToSave,
              isBlue: colorToSave === null && originalColor !== null
            })
          } else {
            console.log('[Viewer3D] Оригинальный цвет уже сохранен для entity:', entityId, originalColorsRef.current.get(entityId))
          }
          
          console.log('[Viewer3D] Попытка установки цвета для entity:', entity.id, {
            hasColorize: typeof entity.colorize === 'function',
            hasColorizeProp: entity.colorize !== undefined,
            hasMaterial: !!entity.material,
            entityType: entity.constructor?.name,
            entityKeys: Object.keys(entity).slice(0, 10),
          })
          
          // Метод 1: entity.colorize() как метод (приоритетный)
          if (typeof entity.colorize === 'function') {
            entity.colorize(blueColor)
            console.log('[Viewer3D] ✅ Цвет установлен через entity.colorize() для entity:', entity.id, 'цвет:', blueColor)
          } 
          // Метод 2: entity.colorize как свойство
          else if (entity.colorize !== undefined) {
            entity.colorize = blueColor
            console.log('[Viewer3D] ✅ Цвет установлен через entity.colorize = для entity:', entity.id, 'цвет:', blueColor)
          }
          // Метод 3: через entity.highlighted (если доступно)
          else if (entity.highlighted !== undefined) {
            entity.highlighted = true
            console.log('[Viewer3D] ✅ Выделение установлено через entity.highlighted = true для entity:', entity.id)
          }
          // Метод 4: через entity.highlight() метод
          else if (typeof entity.highlight === 'function') {
            entity.highlight(blueColor)
            console.log('[Viewer3D] ✅ Цвет установлен через entity.highlight() для entity:', entity.id, 'цвет:', blueColor)
          }
          // Метод 5: через material.colorize
          else if (entity.material) {
            if (entity.material.colorize) {
              if (typeof entity.material.colorize === 'function') {
                entity.material.colorize(blueColor)
                console.log('[Viewer3D] ✅ Цвет установлен через entity.material.colorize() для entity:', entity.id)
              } else {
                entity.material.colorize = blueColor
                console.log('[Viewer3D] ✅ Цвет установлен через entity.material.colorize = для entity:', entity.id)
              }
            } else if (entity.material.color) {
              if (typeof entity.material.color.setRGB === 'function') {
                entity.material.color.setRGB(blueColor[0], blueColor[1], blueColor[2])
                console.log('[Viewer3D] ✅ Цвет установлен через entity.material.color.setRGB() для entity:', entity.id)
              } else if (typeof entity.material.color.set === 'function') {
                entity.material.color.set(blueColor[0], blueColor[1], blueColor[2])
                console.log('[Viewer3D] ✅ Цвет установлен через entity.material.color.set() для entity:', entity.id)
              } else if (Array.isArray(entity.material.color)) {
                entity.material.color[0] = blueColor[0]
                entity.material.color[1] = blueColor[1]
                entity.material.color[2] = blueColor[2]
                console.log('[Viewer3D] ✅ Цвет установлен через entity.material.color[] для entity:', entity.id)
              }
            }
          }
          // Метод 6: через scene.setObjectsColorized (как fallback, но не полагаемся на него)
          else if (typeof scene.setObjectsColorized === 'function') {
            scene.setObjectsColorized([entity], blueColor)
            console.log('[Viewer3D] ⚠️ Цвет установлен через scene.setObjectsColorized (fallback) для entity:', entity.id)
          }
          else {
            console.warn('[Viewer3D] ❌ Не удалось установить цвет для entity:', entity.id, 'доступные методы не найдены')
          }
        } catch (err) {
          console.error('[Viewer3D] ❌ Ошибка при установке цвета для entity:', entity.id, err)
        }
      })
      
      // Также пробуем через scene.setObjectsColorized для всех элементов сразу (как дополнительный метод)
      if (typeof scene.setObjectsColorized === 'function') {
        try {
          scene.setObjectsColorized(entitiesToSelect, blueColor)
          console.log('[Viewer3D] ✅ Дополнительно: цвет установлен через scene.setObjectsColorized для всех элементов')
        } catch (err) {
          console.warn('[Viewer3D] ⚠️ Ошибка при вызове scene.setObjectsColorized:', err)
        }
      }
      
      console.log('[Viewer3D] ✅ Завершена установка цвета для', entitiesToSelect.length, 'элементов')
      
      // Сохраняем список выделенных entities для следующего сброса цвета
      previouslySelectedEntitiesRef.current = entitiesToSelect
      console.log('[Viewer3D] Сохранен список выделенных entities для следующего сброса:', entitiesToSelect.length)
      
      // Обновляем сцену после изменения выделения
      if (scene.update) {
        scene.update()
        console.log('[Viewer3D] Сцена обновлена')
      }
      
      // Принудительно обновляем рендеринг
      if (viewerRef.current && typeof viewerRef.current.scene.render === 'function') {
        viewerRef.current.scene.render()
        console.log('[Viewer3D] Рендеринг сцены принудительно обновлен')
      }
    } else {
      console.warn('[Viewer3D] Нет entities для выделения')
      // Если нет элементов для выделения, очищаем список ранее выделенных
      previouslySelectedEntitiesRef.current = []
    }
  }, [])

  const hideElements = useCallback((elementIds: string[]) => {
    console.log('[Viewer3D] hideElements вызван:', { elementIds, count: elementIds.length })
    
    if (!viewerRef.current || !modelRef.current) {
      console.warn('[Viewer3D] hideElements: viewerRef или modelRef не готовы')
      return
    }

    const scene = viewerRef.current.scene
    const entitiesToHide: any[] = []
    
    elementIds.forEach((elementId) => {
      // Используем тот же гибкий поиск, что и в selectElements
      const entityId = `${modelRef.current.id}#${elementId}`
      let entity = scene.objects[entityId]
      
      // Если не нашли, пробуем другие варианты формата ID
      if (!entity) {
        entity = scene.objects[elementId]
      }
      
      // Если все еще не нашли, ищем по частичному совпадению
      if (!entity) {
        const matchingKey = Object.keys(scene.objects).find(key => 
          key.endsWith(`#${elementId}`) || key === elementId
        )
        if (matchingKey) {
          entity = scene.objects[matchingKey]
          console.log('[Viewer3D] Entity найден для скрытия по частичному совпадению:', matchingKey)
        }
      }
      
      if (entity) {
        entitiesToHide.push(entity)
        console.log('[Viewer3D] ✅ Entity найден для скрытия:', entityId, '→', entity.id || entity.entityId || 'unknown')
      } else {
        console.warn('[Viewer3D] ❌ Entity не найден для скрытия:', entityId)
      }
    })
    
    console.log('[Viewer3D] Найдено entities для скрытия:', entitiesToHide.length, 'из', elementIds.length)
    
    // Скрываем все элементы сразу
    if (entitiesToHide.length > 0) {
      console.log('[Viewer3D] Попытка скрытия', entitiesToHide.length, 'элементов')
      
      // Пробуем разные методы для скрытия элементов
      let hiddenCount = 0
      
      entitiesToHide.forEach((entity: any) => {
        try {
          // Метод 1: через entity.visible (приоритетный)
          if (entity.visible !== undefined) {
            entity.visible = false
            hiddenCount++
            console.log('[Viewer3D] ✅ Entity скрыт через entity.visible = false:', entity.id)
          } 
          // Метод 2: через entity.setVisible()
          else if (typeof entity.setVisible === 'function') {
            entity.setVisible(false)
            hiddenCount++
            console.log('[Viewer3D] ✅ Entity скрыт через entity.setVisible(false):', entity.id)
          }
          // Метод 3: через entity.culled (альтернативный способ)
          else if (entity.culled !== undefined) {
            entity.culled = true
            hiddenCount++
            console.log('[Viewer3D] ✅ Entity скрыт через entity.culled = true:', entity.id)
          }
          // Метод 4: через entity.setCulled()
          else if (typeof entity.setCulled === 'function') {
            entity.setCulled(true)
            hiddenCount++
            console.log('[Viewer3D] ✅ Entity скрыт через entity.setCulled(true):', entity.id)
          }
          else {
            console.warn('[Viewer3D] ⚠️ Не удалось скрыть entity:', entity.id, 'доступные свойства:', Object.keys(entity).slice(0, 10))
          }
        } catch (err) {
          console.error('[Viewer3D] ❌ Ошибка при скрытии entity:', entity.id, err)
        }
      })
      
      // Также пробуем через scene.setObjectsVisible для всех элементов сразу (как дополнительный метод)
      if (typeof scene.setObjectsVisible === 'function') {
        try {
          scene.setObjectsVisible(entitiesToHide, false)
          console.log('[Viewer3D] ✅ Дополнительно: элементы скрыты через scene.setObjectsVisible')
        } catch (err) {
          console.warn('[Viewer3D] ⚠️ Ошибка при вызове scene.setObjectsVisible:', err)
        }
      }
      
      // Также пробуем через model.setObjectsVisible (если доступно)
      if (modelRef.current && typeof modelRef.current.setObjectsVisible === 'function') {
        try {
          modelRef.current.setObjectsVisible(entitiesToHide, false)
          console.log('[Viewer3D] ✅ Дополнительно: элементы скрыты через model.setObjectsVisible')
        } catch (err) {
          console.warn('[Viewer3D] ⚠️ Ошибка при вызове model.setObjectsVisible:', err)
        }
      }
      
      console.log('[Viewer3D] ✅ Скрыто', hiddenCount, 'из', entitiesToHide.length, 'элементов')
      
      // Обновляем сцену после изменения видимости
      if (scene.update) {
        scene.update()
        console.log('[Viewer3D] Сцена обновлена')
      }
      
      // Принудительно обновляем рендеринг
      if (viewerRef.current && typeof viewerRef.current.scene.render === 'function') {
        viewerRef.current.scene.render()
        console.log('[Viewer3D] Рендеринг сцены принудительно обновлен')
      }
    } else {
      console.warn('[Viewer3D] Нет entities для скрытия')
    }
  }, [])

  const showElements = useCallback((elementIds: string[]) => {
    console.log('[Viewer3D] showElements вызван:', { elementIds, count: elementIds.length })
    
    if (!viewerRef.current || !modelRef.current) {
      console.warn('[Viewer3D] showElements: viewerRef или modelRef не готовы')
      return
    }

    const scene = viewerRef.current.scene
    const entitiesToShow: any[] = []
    
    // Логируем информацию о сцене для отладки
    console.log('[Viewer3D] Поиск entities для показа:', {
      modelId: modelRef.current?.id,
      elementIds,
      sceneObjectsCount: Object.keys(scene.objects).length,
      sampleEntityIds: Object.keys(scene.objects).slice(0, 5),
    })
    
    elementIds.forEach((elementId) => {
      // Используем тот же гибкий поиск, что и в selectElements
      const entityId = `${modelRef.current.id}#${elementId}`
      let entity = scene.objects[entityId]
      
      // Если не нашли, пробуем другие варианты формата ID
      if (!entity) {
        entity = scene.objects[elementId]
      }
      
      // Если все еще не нашли, ищем по частичному совпадению
      if (!entity) {
        const matchingKey = Object.keys(scene.objects).find(key => 
          key.endsWith(`#${elementId}`) || key === elementId
        )
        if (matchingKey) {
          entity = scene.objects[matchingKey]
          console.log('[Viewer3D] Entity найден для показа по частичному совпадению:', matchingKey)
        }
      }
      
      // Если все еще не нашли, пробуем найти через model.objects (если доступно)
      if (!entity && modelRef.current.objects) {
        const modelEntityId = `${modelRef.current.id}#${elementId}`
        entity = modelRef.current.objects[modelEntityId] || modelRef.current.objects[elementId]
        if (entity) {
          console.log('[Viewer3D] Entity найден через model.objects:', modelEntityId)
        }
      }
      
      if (entity) {
        entitiesToShow.push(entity)
        console.log('[Viewer3D] ✅ Entity найден для показа:', entityId, '→', entity.id || entity.entityId || 'unknown')
      } else {
        console.warn('[Viewer3D] ❌ Entity не найден для показа:', entityId, {
          triedFormats: [
            `${modelRef.current.id}#${elementId}`,
            elementId,
          ],
          availableKeys: Object.keys(scene.objects).filter(k => k.includes(elementId)).slice(0, 5),
        })
      }
    })
    
    console.log('[Viewer3D] Найдено entities для показа:', entitiesToShow.length, 'из', elementIds.length)
    
    // Показываем все элементы сразу
    if (entitiesToShow.length > 0) {
      console.log('[Viewer3D] Попытка показа', entitiesToShow.length, 'элементов')
      
      // Пробуем разные методы для показа элементов
      let shownCount = 0
      
      entitiesToShow.forEach((entity: any) => {
        try {
          // Метод 1: через entity.visible (приоритетный)
          if (entity.visible !== undefined) {
            entity.visible = true
            shownCount++
            console.log('[Viewer3D] ✅ Entity показан через entity.visible = true:', entity.id)
          } 
          // Метод 2: через entity.setVisible()
          else if (typeof entity.setVisible === 'function') {
            entity.setVisible(true)
            shownCount++
            console.log('[Viewer3D] ✅ Entity показан через entity.setVisible(true):', entity.id)
          }
          // Метод 3: через entity.culled (альтернативный способ)
          else if (entity.culled !== undefined) {
            entity.culled = false
            shownCount++
            console.log('[Viewer3D] ✅ Entity показан через entity.culled = false:', entity.id)
          }
          // Метод 4: через entity.setCulled()
          else if (typeof entity.setCulled === 'function') {
            entity.setCulled(false)
            shownCount++
            console.log('[Viewer3D] ✅ Entity показан через entity.setCulled(false):', entity.id)
          }
          else {
            console.warn('[Viewer3D] ⚠️ Не удалось показать entity:', entity.id, 'доступные свойства:', Object.keys(entity).slice(0, 10))
          }
        } catch (err) {
          console.error('[Viewer3D] ❌ Ошибка при показе entity:', entity.id, err)
        }
      })
      
      // Также пробуем через scene.setObjectsVisible для всех элементов сразу (как дополнительный метод)
      if (typeof scene.setObjectsVisible === 'function') {
        try {
          scene.setObjectsVisible(entitiesToShow, true)
          console.log('[Viewer3D] ✅ Дополнительно: элементы показаны через scene.setObjectsVisible')
        } catch (err) {
          console.warn('[Viewer3D] ⚠️ Ошибка при вызове scene.setObjectsVisible:', err)
        }
      }
      
      // Также пробуем через model.setObjectsVisible (если доступно)
      if (modelRef.current && typeof modelRef.current.setObjectsVisible === 'function') {
        try {
          modelRef.current.setObjectsVisible(entitiesToShow, true)
          console.log('[Viewer3D] ✅ Дополнительно: элементы показаны через model.setObjectsVisible')
        } catch (err) {
          console.warn('[Viewer3D] ⚠️ Ошибка при вызове model.setObjectsVisible:', err)
        }
      }
      
      console.log('[Viewer3D] ✅ Показано', shownCount, 'из', entitiesToShow.length, 'элементов')
      
      // Восстанавливаем синий цвет для выделенных элементов
      const selected = scene.selectedObjects
      const selectedArray = Array.isArray(selected) ? selected : Object.values(selected || {})
      const selectedIds = new Set(selectedArray.map((obj: any) => obj.id))
      const blueColor: [number, number, number] = [0.23, 0.51, 0.96]
      
      const selectedToShow = entitiesToShow.filter((entity) => selectedIds.has(entity.id))
      if (selectedToShow.length > 0) {
        console.log('[Viewer3D] Восстанавливаем цвет для', selectedToShow.length, 'выделенных элементов')
        
        // Пробуем разные методы для восстановления цвета
        if (typeof scene.setObjectsColorized === 'function') {
          scene.setObjectsColorized(selectedToShow, blueColor)
          console.log('[Viewer3D] ✅ Цвет восстановлен через scene.setObjectsColorized')
        } else {
          // Восстанавливаем цвет напрямую через entity
          selectedToShow.forEach((entity: any) => {
            if (typeof entity.colorize === 'function') {
              entity.colorize(blueColor)
            } else if (entity.colorize !== undefined) {
              entity.colorize = blueColor
            }
          })
          console.log('[Viewer3D] ✅ Цвет восстановлен напрямую через entity.colorize')
        }
      }
      
      // Обновляем сцену после изменения видимости
      if (scene.update) {
        scene.update()
        console.log('[Viewer3D] Сцена обновлена')
      }
      
      // Принудительно обновляем рендеринг
      if (viewerRef.current && typeof viewerRef.current.scene.render === 'function') {
        viewerRef.current.scene.render()
        console.log('[Viewer3D] Рендеринг сцены принудительно обновлен')
      }
    } else {
      console.warn('[Viewer3D] Нет entities для показа')
    }
  }, [])

  const isolateElements = useCallback((elementIds: string[] | null) => {
    console.log('[Viewer3D] isolateElements вызван:', { elementIds, count: elementIds?.length || 0, isNull: elementIds === null })
    
    if (!viewerRef.current || !modelRef.current) {
      console.warn('[Viewer3D] isolateElements: viewerRef или modelRef не готовы')
      return
    }

    const scene = viewerRef.current.scene
    const allObjects = Object.values(scene.objects) as any[]
    
    // Сохраняем выделенные элементы для восстановления цвета
    const selected = scene.selectedObjects
    const selectedArray = Array.isArray(selected) ? selected : Object.values(selected || {})
    const blueColor: [number, number, number] = [0.23, 0.51, 0.96]

    if (elementIds === null) {
      // Показываем все элементы
      console.log('[Viewer3D] Сбрасываем изоляцию, показываем все элементы:', allObjects.length)
      
      // Показываем все элементы через разные методы
      let shownCount = 0
      allObjects.forEach((entity: any) => {
        try {
          if (entity.visible !== undefined) {
            entity.visible = true
            shownCount++
          } else if (typeof entity.setVisible === 'function') {
            entity.setVisible(true)
            shownCount++
          } else if (entity.culled !== undefined) {
            entity.culled = false
            shownCount++
          } else if (typeof entity.setCulled === 'function') {
            entity.setCulled(false)
            shownCount++
          }
        } catch (err) {
          console.warn('[Viewer3D] Ошибка при показе entity:', entity.id, err)
        }
      })
      
      // Также пробуем через scene.setObjectsVisible
      if (typeof scene.setObjectsVisible === 'function') {
        try {
          scene.setObjectsVisible(allObjects, true)
          console.log('[Viewer3D] ✅ Дополнительно: все элементы показаны через scene.setObjectsVisible')
        } catch (err) {
          console.warn('[Viewer3D] ⚠️ Ошибка при вызове scene.setObjectsVisible:', err)
        }
      }
      
      // Также пробуем через model.setObjectsVisible
      if (modelRef.current && typeof modelRef.current.setObjectsVisible === 'function') {
        try {
          modelRef.current.setObjectsVisible(allObjects, true)
          console.log('[Viewer3D] ✅ Дополнительно: все элементы показаны через model.setObjectsVisible')
        } catch (err) {
          console.warn('[Viewer3D] ⚠️ Ошибка при вызове model.setObjectsVisible:', err)
        }
      }
      
      console.log('[Viewer3D] ✅ Показано', shownCount, 'из', allObjects.length, 'элементов')
      
      // Восстанавливаем синий цвет для выделенных элементов
      if (selectedArray.length > 0) {
        console.log('[Viewer3D] Восстанавливаем цвет для', selectedArray.length, 'выделенных элементов')
        if (typeof scene.setObjectsColorized === 'function') {
          scene.setObjectsColorized(selectedArray, blueColor)
          console.log('[Viewer3D] ✅ Цвет восстановлен через setObjectsColorized')
        } else if (typeof scene.setObjectsHighlighted === 'function') {
          scene.setObjectsHighlighted(selectedArray, true)
          console.log('[Viewer3D] ⚠️ Использован альтернативный метод setObjectsHighlighted')
        }
      }
      
      // Обновляем сцену после изменения изоляции
      if (scene.update) {
        scene.update()
        console.log('[Viewer3D] Сцена обновлена')
      }
      
      // Принудительно обновляем рендеринг
      if (viewerRef.current && typeof viewerRef.current.scene.render === 'function') {
        viewerRef.current.scene.render()
        console.log('[Viewer3D] Рендеринг сцены принудительно обновлен')
      }
    } else {
      // Собираем entities для изоляции
      const entitiesToShow: any[] = []
      elementIds.forEach((elementId) => {
        const entityId = `${modelRef.current.id}#${elementId}`
        const entity = scene.objects[entityId]
        if (entity) {
          entitiesToShow.push(entity)
        }
      })
      
      // Скрываем все элементы
      if (allObjects.length > 0) {
        console.log('[Viewer3D] Скрываем все элементы для изоляции:', allObjects.length)
        let hiddenCount = 0
        
        allObjects.forEach((entity: any) => {
          try {
            if (entity.visible !== undefined) {
              entity.visible = false
              hiddenCount++
            } else if (typeof entity.setVisible === 'function') {
              entity.setVisible(false)
              hiddenCount++
            } else if (entity.culled !== undefined) {
              entity.culled = true
              hiddenCount++
            } else if (typeof entity.setCulled === 'function') {
              entity.setCulled(true)
              hiddenCount++
            }
          } catch (err) {
            console.warn('[Viewer3D] Ошибка при скрытии entity:', entity.id, err)
          }
        })
        
        // Также пробуем через scene.setObjectsVisible
        if (typeof scene.setObjectsVisible === 'function') {
          try {
            scene.setObjectsVisible(allObjects, false)
            console.log('[Viewer3D] ✅ Дополнительно: все элементы скрыты через scene.setObjectsVisible')
          } catch (err) {
            console.warn('[Viewer3D] ⚠️ Ошибка при вызове scene.setObjectsVisible:', err)
          }
        }
        
        // Также пробуем через model.setObjectsVisible
        if (modelRef.current && typeof modelRef.current.setObjectsVisible === 'function') {
          try {
            modelRef.current.setObjectsVisible(allObjects, false)
            console.log('[Viewer3D] ✅ Дополнительно: все элементы скрыты через model.setObjectsVisible')
          } catch (err) {
            console.warn('[Viewer3D] ⚠️ Ошибка при вызове model.setObjectsVisible:', err)
          }
        }
        
        console.log('[Viewer3D] ✅ Скрыто', hiddenCount, 'из', allObjects.length, 'элементов')
      }
      
      // Показываем только выбранные
      if (entitiesToShow.length > 0) {
        console.log('[Viewer3D] Показываем изолированные элементы:', entitiesToShow.length)
        let shownCount = 0
        
        entitiesToShow.forEach((entity: any) => {
          try {
            if (entity.visible !== undefined) {
              entity.visible = true
              shownCount++
            } else if (typeof entity.setVisible === 'function') {
              entity.setVisible(true)
              shownCount++
            } else if (entity.culled !== undefined) {
              entity.culled = false
              shownCount++
            } else if (typeof entity.setCulled === 'function') {
              entity.setCulled(false)
              shownCount++
            }
          } catch (err) {
            console.warn('[Viewer3D] Ошибка при показе entity:', entity.id, err)
          }
        })
        
        // Также пробуем через scene.setObjectsVisible
        if (typeof scene.setObjectsVisible === 'function') {
          try {
            scene.setObjectsVisible(entitiesToShow, true)
            console.log('[Viewer3D] ✅ Дополнительно: изолированные элементы показаны через scene.setObjectsVisible')
          } catch (err) {
            console.warn('[Viewer3D] ⚠️ Ошибка при вызове scene.setObjectsVisible:', err)
          }
        }
        
        // Также пробуем через model.setObjectsVisible
        if (modelRef.current && typeof modelRef.current.setObjectsVisible === 'function') {
          try {
            modelRef.current.setObjectsVisible(entitiesToShow, true)
            console.log('[Viewer3D] ✅ Дополнительно: изолированные элементы показаны через model.setObjectsVisible')
          } catch (err) {
            console.warn('[Viewer3D] ⚠️ Ошибка при вызове model.setObjectsVisible:', err)
          }
        }
        
        console.log('[Viewer3D] ✅ Показано', shownCount, 'из', entitiesToShow.length, 'изолированных элементов')
        
        // Устанавливаем синий цвет для изолированных выделенных элементов
        const selectedToShow = entitiesToShow.filter((entity) => 
          selectedArray.some((obj: any) => obj.id === entity.id)
        )
        if (selectedToShow.length > 0) {
          if (typeof scene.setObjectsColorized === 'function') {
            scene.setObjectsColorized(selectedToShow, blueColor)
            console.log('[Viewer3D] ✅ Цвет установлен для изолированных элементов через scene.setObjectsColorized')
          } else {
            selectedToShow.forEach((entity: any) => {
              if (typeof entity.colorize === 'function') {
                entity.colorize(blueColor)
              } else if (entity.colorize !== undefined) {
                entity.colorize = blueColor
              }
            })
            console.log('[Viewer3D] ✅ Цвет установлен для изолированных элементов напрямую через entity.colorize')
          }
        }
      }
      
      // Обновляем сцену после изменения изоляции
      if (scene.update) {
        scene.update()
        console.log('[Viewer3D] Сцена обновлена')
      }
      
      // Принудительно обновляем рендеринг
      if (viewerRef.current && typeof viewerRef.current.scene.render === 'function') {
        viewerRef.current.scene.render()
        console.log('[Viewer3D] Рендеринг сцены принудительно обновлен')
      }
    }
  }, [])

  const setXrayMode = useCallback((enabled: boolean) => {
    console.log('[Viewer3D] setXrayMode вызван:', { enabled })
    
    if (!viewerRef.current || !modelRef.current) {
      console.warn('[Viewer3D] setXrayMode: viewerRef или modelRef не готовы')
      return
    }
    
    const scene = viewerRef.current.scene
    const allObjects = Object.values(scene.objects) as any[]
    
    if (enabled) {
      // Включаем X-ray режим для всех объектов
      console.log('[Viewer3D] Включаем X-ray режим для', allObjects.length, 'объектов')
      if (typeof scene.setObjectsXRayed === 'function') {
        scene.setObjectsXRayed(allObjects, true)
        console.log('[Viewer3D] ✅ X-ray режим включен через setObjectsXRayed')
      } else if (typeof scene.setObjectsHighlighted === 'function') {
        // Альтернативный метод - используем highlight
        scene.setObjectsHighlighted(allObjects, true)
        console.log('[Viewer3D] ⚠️ Использован альтернативный метод setObjectsHighlighted для X-ray')
      } else {
        console.warn('[Viewer3D] ⚠️ Методы setObjectsXRayed и setObjectsHighlighted недоступны')
      }
    } else {
      // Выключаем X-ray режим
      console.log('[Viewer3D] Выключаем X-ray режим для', allObjects.length, 'объектов')
      if (typeof scene.setObjectsXRayed === 'function') {
        scene.setObjectsXRayed(allObjects, false)
        console.log('[Viewer3D] ✅ X-ray режим выключен через setObjectsXRayed')
      } else if (typeof scene.setObjectsHighlighted === 'function') {
        scene.setObjectsHighlighted(allObjects, false)
        console.log('[Viewer3D] ⚠️ Использован альтернативный метод setObjectsHighlighted для выключения X-ray')
      }
      
      // Восстанавливаем синий цвет для выделенных элементов
      const selected = scene.selectedObjects
      const selectedArray = Array.isArray(selected) ? selected : Object.values(selected || {})
      if (selectedArray.length > 0) {
        const blueColor: [number, number, number] = [0.23, 0.51, 0.96]
        console.log('[Viewer3D] Восстанавливаем цвет для', selectedArray.length, 'выделенных элементов')
        if (typeof scene.setObjectsColorized === 'function') {
          scene.setObjectsColorized(selectedArray, blueColor)
          console.log('[Viewer3D] ✅ Цвет восстановлен через setObjectsColorized')
        } else if (typeof scene.setObjectsHighlighted === 'function') {
          scene.setObjectsHighlighted(selectedArray, true)
          console.log('[Viewer3D] ⚠️ Использован альтернативный метод setObjectsHighlighted')
        }
      }
      
      // Обновляем сцену после изменения X-ray режима
      if (scene.update) {
        scene.update()
        console.log('[Viewer3D] Сцена обновлена')
      }
    }
  }, [])

  const setDisplayMode = useCallback((mode: 'wireframe' | 'solid' | 'shaded') => {
    console.log('[Viewer3D] setDisplayMode вызван:', { mode })
    
    if (!viewerRef.current || !modelRef.current) {
      console.warn('[Viewer3D] setDisplayMode: viewerRef или modelRef не готовы')
      return
    }

    const scene = viewerRef.current.scene
    const allObjects = Object.values(scene.objects) as any[]
    
    // Сохраняем выделенные элементы, чтобы восстановить их цвет после изменения режима
    const selected = scene.selectedObjects
    const selectedArray = Array.isArray(selected) ? selected : Object.values(selected || {})
    const selectedIds = new Set(selectedArray.map((obj: any) => obj.id))
    const blueColor: [number, number, number] = [0.23, 0.51, 0.96]

    switch (mode) {
      case 'wireframe':
        console.log('[Viewer3D] Устанавливаем режим wireframe')
        // Включаем edges для всех объектов
        if (typeof scene.setObjectsEdges === 'function') {
          scene.setObjectsEdges(allObjects, true)
          console.log('[Viewer3D] ✅ Edges включены через setObjectsEdges')
        }
        // Для wireframe применяем серый цвет ко всем, кроме выделенных
        if (typeof scene.setObjectsColorized === 'function') {
          const nonSelected = allObjects.filter((obj: any) => !selectedIds.has(obj.id))
          if (nonSelected.length > 0) {
            scene.setObjectsColorized(nonSelected, [0.5, 0.5, 0.5])
            console.log('[Viewer3D] ✅ Серый цвет применен к', nonSelected.length, 'невыделенным элементам')
          }
        }
        break
      case 'solid':
        console.log('[Viewer3D] Устанавливаем режим solid')
        // Выключаем edges
        if (typeof scene.setObjectsEdges === 'function') {
          scene.setObjectsEdges(allObjects, false)
          console.log('[Viewer3D] ✅ Edges выключены через setObjectsEdges')
        }
        // Сбрасываем цвет для всех, кроме выделенных
        if (typeof scene.setObjectsColorized === 'function') {
          const nonSelected = allObjects.filter((obj: any) => !selectedIds.has(obj.id))
          if (nonSelected.length > 0) {
            scene.setObjectsColorized(nonSelected, null)
            console.log('[Viewer3D] ✅ Цвет сброшен для', nonSelected.length, 'невыделенных элементов')
          }
        }
        break
      case 'shaded':
        console.log('[Viewer3D] Устанавливаем режим shaded')
        // Выключаем edges
        if (typeof scene.setObjectsEdges === 'function') {
          scene.setObjectsEdges(allObjects, false)
          console.log('[Viewer3D] ✅ Edges выключены через setObjectsEdges')
        }
        // Сбрасываем цвет для всех, кроме выделенных
        if (typeof scene.setObjectsColorized === 'function') {
          const nonSelected = allObjects.filter((obj: any) => !selectedIds.has(obj.id))
          if (nonSelected.length > 0) {
            scene.setObjectsColorized(nonSelected, null)
            console.log('[Viewer3D] ✅ Цвет сброшен для', nonSelected.length, 'невыделенных элементов')
          }
        }
        break
    }
    
    // Восстанавливаем синий цвет для выделенных элементов
    if (selectedArray.length > 0) {
      console.log('[Viewer3D] Восстанавливаем цвет для', selectedArray.length, 'выделенных элементов')
      if (typeof scene.setObjectsColorized === 'function') {
        scene.setObjectsColorized(selectedArray, blueColor)
        console.log('[Viewer3D] ✅ Цвет восстановлен через setObjectsColorized')
      } else if (typeof scene.setObjectsHighlighted === 'function') {
        scene.setObjectsHighlighted(selectedArray, true)
        console.log('[Viewer3D] ⚠️ Использован альтернативный метод setObjectsHighlighted')
      }
    }
    
    // Обновляем сцену после изменения режима отображения
    if (scene.update) {
      scene.update()
      console.log('[Viewer3D] Сцена обновлена')
    }
  }, [])

  const fitToView = useCallback(() => {
    console.log('[Viewer3D] fitToView вызван')
    
    if (!viewerRef.current || !modelRef.current) {
      console.warn('[Viewer3D] fitToView: viewerRef или modelRef не готовы')
      return
    }

    try {
      // Используем cameraFlight для подгонки модели под экран
      const aabb = modelRef.current.aabb
      console.log('[Viewer3D] AABB модели:', aabb)
      
      if (aabb && viewerRef.current.cameraFlight) {
        // Используем flyTo с aabb для подгонки модели под экран
        console.log('[Viewer3D] Используем cameraFlight.flyTo для подгонки модели')
        viewerRef.current.cameraFlight.flyTo({
          aabb: aabb,
          duration: 1.0,
        })
        console.log('[Viewer3D] ✅ cameraFlight.flyTo вызван')
      } else if (viewerRef.current.cameraControl && aabb) {
        // Альтернативный метод через cameraControl.fitLookAt
        console.log('[Viewer3D] Используем альтернативный метод cameraControl')
        if (typeof viewerRef.current.cameraControl.fitLookAt === 'function') {
          const center = [
            (aabb[0] + aabb[3]) / 2,
            (aabb[1] + aabb[4]) / 2,
            (aabb[2] + aabb[5]) / 2,
          ]
          console.log('[Viewer3D] Центр модели:', center)
          viewerRef.current.cameraControl.fitLookAt(
            aabb,
            center,
            [0, 0, 1],
            { duration: 1.0 }
          )
          console.log('[Viewer3D] ✅ cameraControl.fitLookAt вызван')
        } else if (typeof viewerRef.current.cameraControl.flyTo === 'function') {
          // Еще один альтернативный метод
          viewerRef.current.cameraControl.flyTo({
            aabb: aabb,
            duration: 1.0,
          })
          console.log('[Viewer3D] ✅ cameraControl.flyTo вызван')
        } else {
          console.warn('[Viewer3D] ⚠️ Методы cameraControl.fitLookAt и cameraControl.flyTo недоступны')
        }
      } else {
        console.warn('[Viewer3D] ⚠️ cameraFlight и cameraControl недоступны или AABB отсутствует')
      }
    } catch (err) {
      console.error('[Viewer3D] ❌ Ошибка при подгонке модели под экран:', err)
    }
  }, [])

  // Expose methods via ref
  // Примечание: onRefReady вызывается после загрузки модели, а не здесь
  useImperativeHandle(ref, () => {
    const refObject: Viewer3DRef = {
      viewer: viewerRef.current,
      selectElements,
      hideElements,
      showElements,
      isolateElements,
      setXrayMode,
      setDisplayMode,
      fitToView,
    }
    
    return refObject
  }, [selectElements, hideElements, showElements, isolateElements, setXrayMode, setDisplayMode, fitToView])

  // Синхронизация выделения
  useEffect(() => {
    if (!viewerRef.current || !modelRef.current) return
    selectElements(selectedElementIds)
  }, [selectedElementIds, selectElements])

  // Синхронизация видимости
  useEffect(() => {
    if (!viewerRef.current || !modelRef.current) return
    // Если есть изоляция, не применяем скрытие
    if (isolatedElementIds !== null) return
    
    // Получаем все объекты модели
    const scene = viewerRef.current.scene
    const allObjects = Object.values(scene.objects) as any[]
    const modelId = modelRef.current.id

    // Разделяем объекты на видимые и скрытые
    const objectsToShow: any[] = []
    const objectsToHide: any[] = []
    
    allObjects.forEach((obj: any) => {
      const objId = obj.id
      if (objId.startsWith(`${modelId}#`)) {
        const elementId = objId.split('#').pop()
        const shouldBeHidden = hiddenElementIds.includes(elementId)
        if (shouldBeHidden) {
          objectsToHide.push(obj)
        } else {
          objectsToShow.push(obj)
        }
      }
    })
    
    // Применяем видимость батчами для лучшей производительности
    if (objectsToShow.length > 0) {
      scene.setObjectsVisible(objectsToShow, true)
    }
    if (objectsToHide.length > 0) {
      scene.setObjectsVisible(objectsToHide, false)
    }
    
    // Восстанавливаем синий цвет для выделенных видимых элементов
    const selected = scene.selectedObjects
    const selectedArray = Array.isArray(selected) ? selected : Object.values(selected || {})
    if (selectedArray.length > 0 && scene.setObjectsColorized) {
      const visibleSelected = selectedArray.filter((obj: any) => 
        objectsToShow.some((visibleObj) => visibleObj.id === obj.id)
      )
      if (visibleSelected.length > 0) {
        const blueColor: [number, number, number] = [0.23, 0.51, 0.96]
        scene.setObjectsColorized(visibleSelected, blueColor)
      }
    }
  }, [hiddenElementIds, isolatedElementIds])

  // Синхронизация изоляции
  useEffect(() => {
    if (!viewerRef.current || !modelRef.current) return
    isolateElements(isolatedElementIds)
  }, [isolatedElementIds, isolateElements])

  // Синхронизация X-ray режима
  useEffect(() => {
    if (!viewerRef.current) return
    setXrayMode(xrayMode)
  }, [xrayMode, setXrayMode])

  // Синхронизация режима отображения
  useEffect(() => {
    if (!viewerRef.current || !modelRef.current) return
    setDisplayMode(displayMode)
  }, [displayMode, setDisplayMode])

  return (
    <div className={cn('relative w-full h-full bg-[rgba(0,0,0,0.3)]', className)}>
      {/* Индикатор загрузки */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.5)] z-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <p className="text-white text-sm">Загрузка 3D модели...</p>
          </div>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.5)] z-10">
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto p-6 bg-red-500/10 border border-red-500/50 rounded-lg">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-red-400 text-center">{error}</p>
          </div>
        </div>
      )}

      {/* Контейнер для viewer */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />
    </div>
  )
})

Viewer3D.displayName = 'Viewer3D'

