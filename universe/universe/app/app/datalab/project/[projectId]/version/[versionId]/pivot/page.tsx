'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'
import { getProject, getProjectVersion } from '@/lib/api/projects'
import { PivotBuilder } from '@/components/datalab/PivotBuilder'
import { PivotTable } from '@/components/datalab/PivotTable'
import { PivotTabs } from '@/components/datalab/PivotTabs'
import { createPivotTable, getAvailableFields, updatePivotReport } from '@/lib/api/pivot'
import { getAvailableParameters } from '@/lib/api/data'
import type {
  AvailableField,
  PivotRequest,
  PivotResponse,
  PivotAggregation,
  PivotReport,
} from '@/lib/types/pivot'

export default function VersionPivotPage({
  params,
}: {
  params: { projectId: string; versionId: string } | Promise<{ projectId: string; versionId: string }>
}) {
  // Получаем начальные значения из params (только для синхронной инициализации)
  const getInitialProjectId = () => {
    if (!params || params instanceof Promise) return ''
    return params.projectId || ''
  }
  
  const getInitialVersionId = () => {
    if (!params || params instanceof Promise) return ''
    return params.versionId || ''
  }
  
  const [projectId, setProjectId] = useState<string>(getInitialProjectId)
  const [versionId, setVersionId] = useState<string>(getInitialVersionId)
  const [projectName, setProjectName] = useState<string>('')
  const [versionName, setVersionName] = useState<string>('')
  
  // Ref для отслеживания, были ли уже обработаны params
  const paramsProcessedRef = useRef(false)
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([])
  const [loadingFields, setLoadingFields] = useState(true)
  const [fieldsError, setFieldsError] = useState<string | null>(null)
  
  // Доступные параметры для unpivot
  const [availableParameters, setAvailableParameters] = useState<string[]>([])
  const [loadingParameters, setLoadingParameters] = useState(true)

  // Текущая активная вкладка
  const [activeTab, setActiveTab] = useState<PivotReport | null>(null)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // Pivot-конфигурация текущей вкладки
  const [selectedParameters, setSelectedParameters] = useState<string[]>([])
  const [rows, setRows] = useState<string[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [values, setValues] = useState<PivotAggregation[]>([])
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  
  // Логирование изменений фильтров для отладки
  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      console.log('📊 Фильтры изменены:', filters)
      Object.entries(filters).forEach(([field, values]) => {
        if (field === 'selected_parameters' || field.includes('selected_parameters')) {
          console.warn(`⚠️ Обнаружен фильтр для selected_parameters: ${field} = ${values.length} значений`)
        }
      })
    }
  }, [filters])

  // Pivot-результаты текущей вкладки
  const [pivotData, setPivotData] = useState<PivotResponse | null>(null)
  const [loadingPivot, setLoadingPivot] = useState(false)
  const [pivotError, setPivotError] = useState<string | null>(null)
  
  // Флаг для предотвращения автосохранения во время загрузки вкладки
  const isLoadingTabRef = useRef(false)
  // Флаг для отслеживания изменений, требующих сохранения
  const hasUnsavedChangesRef = useRef(false)

  // Инициализация params, если это Promise (асинхронно)
  useEffect(() => {
    if (!params) return
    
    // Если params - Promise, обрабатываем его асинхронно
    if (params instanceof Promise) {
      if (paramsProcessedRef.current) return // Уже обрабатываем
      
      paramsProcessedRef.current = true
      let isMounted = true
      
      const initParams = async () => {
        try {
          const resolved = await params
          if (!isMounted) return
          
          // Обновляем состояние только если значения изменились
          setProjectId((prev) => {
            const newId = resolved.projectId || ''
            return prev !== newId ? newId : prev
          })
          setVersionId((prev) => {
            const newId = resolved.versionId || ''
            return prev !== newId ? newId : prev
          })
        } catch (err) {
          console.error('Ошибка инициализации params:', err)
          paramsProcessedRef.current = false
        }
      }
      
      initParams()
      
      return () => {
        isMounted = false
        paramsProcessedRef.current = false
      }
    }
    
    // Если params - объект, обновляем значения асинхронно через setTimeout
    // чтобы избежать setState во время рендера
    const timer = setTimeout(() => {
      const newProjectId = params.projectId || ''
      const newVersionId = params.versionId || ''
      
      setProjectId((prev) => {
        if (prev !== newProjectId) {
          return newProjectId
        }
        return prev
      })
      
      setVersionId((prev) => {
        if (prev !== newVersionId) {
          return newVersionId
        }
        return prev
      })
    }, 0)
    
    return () => {
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Загрузка названий проекта и версии
  useEffect(() => {
    if (!projectId || !versionId) return
    
    const loadNames = async () => {
      try {
        const [project, version] = await Promise.all([
          getProject(projectId),
          getProjectVersion(projectId, versionId),
        ])
        setProjectName(project.name)
        setVersionName(version.name)
      } catch (err) {
        console.error('Ошибка загрузки названий проекта/версии:', err)
        // Не устанавливаем ошибку, чтобы не блокировать UI
      }
    }
    loadNames()
  }, [projectId, versionId])

  // Загрузка доступных полей
  useEffect(() => {
    if (!projectId || !versionId) return
    
    const loadFields = async () => {
      try {
        setLoadingFields(true)
        setFieldsError(null)
        const response = await getAvailableFields({
          projectId,
          versionId,
        })
        setAvailableFields(response.fields)
      } catch (err: any) {
        console.error('Ошибка загрузки полей:', err)
        // Игнорируем ошибки авторизации - редирект уже произошел
        if (err.isAuthRedirect) {
          return
        }
        setFieldsError(err.message || 'Ошибка загрузки доступных полей')
      } finally {
        setLoadingFields(false)
      }
    }
    loadFields()
  }, [projectId, versionId])

  // Объединяем базовые поля с выбранными параметрами (после unpivot они становятся доступными полями)
  const extendedAvailableFields = useMemo(() => {
    const baseFields = [...availableFields]
    
    // Добавляем выбранные параметры как доступные поля
    const parameterFields = selectedParameters
      .filter(param => !baseFields.some(f => f.field === param)) // Не добавляем, если уже есть
      .map(param => ({
        field: param,
        displayName: param,
        type: 'string',
        sampleValues: [],
        uniqueCount: 0,
      }))
    
    return [...baseFields, ...parameterFields]
  }, [availableFields, selectedParameters])

  // Загрузка доступных параметров для unpivot
  useEffect(() => {
    if (!projectId || !versionId) return
    
    const loadParameters = async () => {
      try {
        setLoadingParameters(true)
        const parameters = await getAvailableParameters({
          projectId,
          versionId,
        })
        setAvailableParameters(parameters)
        console.log('📋 Загружены параметры для unpivot:', parameters)
      } catch (err: any) {
        console.error('Ошибка загрузки параметров:', err)
        // Игнорируем ошибки авторизации - редирект уже произошел
        if (err.isAuthRedirect) {
          return
        }
        // Не блокируем UI, просто логируем ошибку
        setAvailableParameters([])
      } finally {
        setLoadingParameters(false)
      }
    }
    loadParameters()
  }, [projectId, versionId])

  // Автосохранение при изменении конфигурации или результатов
  useEffect(() => {
    if (!activeTab || isLoadingTabRef.current) return
    
    // Отмечаем, что есть несохраненные изменения
    hasUnsavedChangesRef.current = true
    
    // Сохраняем с задержкой (debounce)
    const saveTimer = setTimeout(async () => {
      if (!activeTab || isLoadingTabRef.current) return
      
      try {
        // Очищаем фильтры от служебных полей перед сохранением
        const cleanedFiltersForSave: Record<string, string[]> = {}
        Object.entries(filters).forEach(([field, values]) => {
          if (field !== 'selected_parameters' && !field.includes('selected_parameters')) {
            cleanedFiltersForSave[field] = values
          }
        })
        
        await updatePivotReport(activeTab.id, {
          selectedParameters,
          rows,
          columns,
          values,
          filters: Object.keys(cleanedFiltersForSave).length > 0 ? cleanedFiltersForSave : undefined,
          pivotData: pivotData || undefined,
        })
        hasUnsavedChangesRef.current = false
        console.log('✅ Автосохранение вкладки выполнено (включая фильтры)')
      } catch (err: any) {
        console.error('❌ Ошибка автосохранения вкладки:', err)
      }
    }, 1000) // Сохраняем через 1 секунду после последнего изменения
    
    return () => clearTimeout(saveTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParameters, rows, columns, values, filters, pivotData, activeTab?.id])

  // Автоматическое пересобирание pivot при изменении фильтров
  useEffect(() => {
    // Пересобираем только если есть активная вкладка и уже были построены результаты
    // И если мы не загружаем вкладку (чтобы избежать пересобирания при загрузке)
    if (activeTab && pivotData && !isLoadingTabRef.current) {
      // Проверяем, что есть хотя бы rows или columns для построения
      if (rows.length > 0 || columns.length > 0) {
        // Используем debounce для избежания множественных пересборок
        const timer = setTimeout(() => {
          handleBuildPivot()
        }, 500)
        return () => clearTimeout(timer)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  // Обработчик переключения вкладки
  const handleTabChange = async (tab: PivotReport) => {
    // Сохраняем текущую вкладку перед переключением
    if (activeTab && hasUnsavedChangesRef.current) {
      try {
        // Очищаем фильтры от служебных полей перед сохранением
        const cleanedFiltersForSave: Record<string, string[]> = {}
        Object.entries(filters).forEach(([field, values]) => {
          if (field !== 'selected_parameters' && !field.includes('selected_parameters')) {
            cleanedFiltersForSave[field] = values
          }
        })
        
        await updatePivotReport(activeTab.id, {
          selectedParameters,
          rows,
          columns,
          values,
          filters: Object.keys(cleanedFiltersForSave).length > 0 ? cleanedFiltersForSave : undefined,
          pivotData: pivotData || undefined,
        })
        hasUnsavedChangesRef.current = false
      } catch (err: any) {
        console.error('❌ Ошибка сохранения перед переключением:', err)
      }
    }
    
    // Загружаем данные новой вкладки
    isLoadingTabRef.current = true
    setActiveTab(tab)
    setActiveTabId(tab.id)
    setSelectedParameters(tab.selectedParameters || [])
    setRows(tab.rows || [])
    setColumns(tab.columns || [])
    setValues(tab.values || [])
    const loadedFilters = tab.filters || {}
    console.log('📂 Загрузка фильтров из вкладки:', loadedFilters)
    // Очищаем фильтры для selected_parameters, если они есть (это не должно быть фильтруемым полем)
    const cleanedFilters: Record<string, string[]> = {}
    Object.entries(loadedFilters).forEach(([field, values]) => {
      if (field !== 'selected_parameters' && !field.includes('selected_parameters')) {
        cleanedFilters[field] = values
      } else {
        console.warn(`⚠️ Пропущен фильтр для selected_parameters: ${field}`)
      }
    })
    setFilters(cleanedFilters)
    setPivotData(tab.pivotData || null)
    setPivotError(null)
    isLoadingTabRef.current = false
  }

  // Обработчик создания новой вкладки
  const handleTabCreate = (tab: PivotReport) => {
    setActiveTab(tab)
    setActiveTabId(tab.id)
    setSelectedParameters([])
    setRows([])
    setColumns([])
    setValues([])
    setFilters({})
    setPivotData(null)
    setPivotError(null)
    hasUnsavedChangesRef.current = false
  }

  // Обработчик удаления вкладки
  const handleTabDelete = (tabId: string) => {
    if (activeTabId === tabId) {
      // Если удалена активная вкладка, состояние будет обновлено в PivotTabs
      setActiveTab(null)
      setActiveTabId(null)
      setSelectedParameters([])
      setRows([])
      setColumns([])
      setValues([])
      setPivotData(null)
    }
  }

  // Построение pivot-таблицы
  const handleBuildPivot = async () => {
    try {
      setLoadingPivot(true)
      setPivotError(null)

      if (!projectId || !versionId) {
        setPivotError('Не указан projectId или versionId')
        setLoadingPivot(false)
        return
      }

      if (!activeTab) {
        setPivotError('Не выбрана активная вкладка')
        setLoadingPivot(false)
        return
      }

      // Проверяем, что есть хотя бы rows или columns
      if (rows.length === 0 && columns.length === 0) {
        setPivotError('Необходимо указать хотя бы одну строку или колонку')
        setLoadingPivot(false)
        return
      }

      // Если values не указаны, используем первое доступное поле или дефолтное значение
      let finalValues = values
      if (values.length === 0) {
        // Используем extendedAvailableFields (включает выбранные параметры)
        if (extendedAvailableFields.length > 0) {
          // Если есть выбранные параметры, предпочтительно используем первый из них
          const preferredField = selectedParameters.length > 0 
            ? extendedAvailableFields.find(f => f.field === selectedParameters[0])
            : null
          
          const fieldToUse = preferredField || extendedAvailableFields[0]
          finalValues = [{ 
            field: fieldToUse.field, 
            function: 'COUNT' as const, 
            displayName: `${fieldToUse.displayName} (COUNT)` 
          }]
        } else if (availableFields.length > 0) {
          // Fallback на обычные поля
          finalValues = [{ 
            field: availableFields[0].field, 
            function: 'COUNT' as const, 
            displayName: `${availableFields[0].displayName} (COUNT)` 
          }]
        } else {
          // Если полей нет, используем дефолтное (но это маловероятно)
          finalValues = [{ field: 'element_id', function: 'COUNT' as const, displayName: 'Количество' }]
        }
      }

      // Очищаем фильтры от служебных полей перед отправкой
      const cleanedFilters: Record<string, string[]> = {}
      Object.entries(filters).forEach(([field, values]) => {
        if (field !== 'selected_parameters' && !field.includes('selected_parameters')) {
          cleanedFilters[field] = values
        }
      })
      
      const request: PivotRequest = {
        projectId,
        versionId,
        rows,
        columns,
        values: finalValues,
        selectedParameters: selectedParameters.length > 0 ? selectedParameters : undefined,
        filters: Object.keys(cleanedFilters).length > 0 ? cleanedFilters : undefined,
      }

      console.log('📊 Построение pivot-таблицы:', {
        ...request,
        valuesFields: request.values.map(v => v.field),
        selectedParameters: request.selectedParameters,
        filters: request.filters,
        filtersKeys: request.filters ? Object.keys(request.filters) : [],
        filtersSample: request.filters ? Object.entries(request.filters).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]) : [],
      })
      const response = await createPivotTable(request)
      console.log('✅ Pivot-таблица построена:', response)
      const responseAny = response as any
      console.log('🔍 Проверка rowsFields и columnsFields в ответе:', {
        hasRowsFields: 'rowsFields' in responseAny,
        rowsFields: responseAny.rowsFields,
        hasColumnsFields: 'columnsFields' in responseAny,
        columnsFields: responseAny.columnsFields,
        rows: response.rows?.slice(0, 3),
        requestRows: rows,
        requestColumns: columns
      })
      
      // Если rowsFields отсутствует, но rows в запросе есть, добавляем их вручную
      if (!responseAny.rowsFields && rows.length > 0) {
        console.warn('⚠️ rowsFields отсутствует в ответе, добавляем вручную из request.rows:', rows)
        responseAny.rowsFields = rows
      }
      if (!responseAny.columnsFields && columns.length > 0) {
        console.warn('⚠️ columnsFields отсутствует в ответе, добавляем вручную из request.columns:', columns)
        responseAny.columnsFields = columns
      }
      
      setPivotData(response)
      
      // Обновляем values, если они были автоматически добавлены
      if (values.length === 0) {
        setValues(finalValues)
      }
    } catch (err: any) {
      console.error('❌ Ошибка построения pivot-таблицы:', err)
      // Игнорируем ошибки авторизации - редирект уже произошел
      if (err.isAuthRedirect) {
        return
      }
      setPivotError(err.message || 'Ошибка построения pivot-таблицы')
    } finally {
      setLoadingPivot(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Вкладки */}
      {projectId && versionId && (
        <PivotTabs
          projectId={projectId}
          versionId={versionId}
          activeTabId={activeTabId}
          onTabChange={handleTabChange}
          onTabCreate={handleTabCreate}
          onTabDelete={handleTabDelete}
        />
      )}

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            {projectId && versionId && (
              <Link
                href={`/app/datalab/project/${projectId}/version/${versionId}`}
                className="text-primary-500 hover:text-primary-400 text-sm mb-4 inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Назад к версии
              </Link>
            )}
            <h1 className="text-4xl font-bold text-gradient mb-2">Сводный расчет</h1>
            <p className="text-[#ccc] text-lg">
              Проект: <span className="text-white font-semibold">{projectName}</span> | Версия:{' '}
              <span className="text-white font-semibold">{versionName}</span>
            </p>
          </div>

          {/* Ошибка загрузки полей */}
          {fieldsError && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div className="flex-1">
                <p className="text-red-400 font-semibold">Ошибка загрузки полей</p>
                <p className="text-red-300 text-sm">{fieldsError}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Конструктор Pivot-таблицы */}
          {loadingFields ? (
            <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
              <p className="text-[#999]">Загрузка доступных полей...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
                <h2 className="text-xl font-semibold mb-4">Конструктор Сводной-таблицы</h2>
                {activeTab && (
                  <div className="mb-4 bg-primary-500/10 border border-primary-500/50 rounded-lg p-3">
                    <p className="text-primary-400 font-medium text-sm">
                      Вкладка: <span className="text-white">{activeTab.name}</span>
                    </p>
                  </div>
                )}
                <PivotBuilder
                  availableFields={extendedAvailableFields}
                  availableParameters={availableParameters}
                  selectedParameters={selectedParameters}
                  onSelectedParametersChange={setSelectedParameters}
                  rows={rows}
                  columns={columns}
                  values={values}
                  filters={filters}
                  onRowsChange={setRows}
                  onColumnsChange={setColumns}
                  onValuesChange={setValues}
                  onFiltersChange={setFilters}
                  onBuild={handleBuildPivot}
                  loading={loadingPivot}
                  projectId={projectId}
                  versionId={versionId}
                />
              </div>

              {/* Информация о доступных полях */}
              <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
                <h2 className="text-xl font-semibold mb-4">Доступные поля</h2>
                {selectedParameters.length > 0 && (
                  <div className="mb-3 p-2 bg-primary-500/10 border border-primary-500/50 rounded text-sm text-primary-300">
                    Выбранные параметры (доступны после unpivot): {selectedParameters.join(', ')}
                  </div>
                )}
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {extendedAvailableFields.map((field) => {
                    const isUnpivotParameter = selectedParameters.includes(field.field)
                    return (
                      <div
                        key={field.field}
                        className={`rounded-md p-3 border ${
                          isUnpivotParameter
                            ? 'bg-primary-500/10 border-primary-500/50'
                            : 'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white">
                            {field.displayName}
                            {isUnpivotParameter && (
                              <span className="ml-2 text-xs text-primary-400 bg-primary-500/20 px-2 py-0.5 rounded">
                                Unpivot
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-gray-400 bg-[rgba(255,255,255,0.1)] px-2 py-1 rounded">
                            {field.field}
                          </span>
                        </div>
                        {!isUnpivotParameter && (
                          <p className="text-sm text-gray-400">
                            Уникальных значений: {field.uniqueCount}
                          </p>
                        )}
                        {isUnpivotParameter && (
                          <p className="text-xs text-primary-300">
                            Параметр из unpivot (преобразован в колонку)
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Ошибка построения pivot */}
          {pivotError && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div className="flex-1">
                <p className="text-red-400 font-semibold">Ошибка построения pivot-таблицы</p>
                <p className="text-red-300 text-sm">{pivotError}</p>
              </div>
            </div>
          )}

          {/* Результаты Pivot-таблицы */}
          {pivotData && (
            <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Результаты Pivot-таблицы</h2>
                <span className="text-sm text-gray-400">
                  Всего строк: {pivotData.totalRows}
                </span>
              </div>
              <PivotTable data={pivotData} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
