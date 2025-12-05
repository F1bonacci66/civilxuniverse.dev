'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, Plus, GripVertical, Loader2, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react'
import type {
  AvailableField,
  PivotAggregation,
  AggregationFunction,
} from '@/lib/types/pivot'
import { getFilterValues } from '@/lib/api/pivot'

interface PivotBuilderProps {
  availableFields: AvailableField[]
  availableParameters: string[] // Список доступных параметров (parameter_name)
  selectedParameters: string[] // Выбранные параметры для unpivot
  onSelectedParametersChange: (parameters: string[]) => void
  rows: string[]
  columns: string[]
  values: PivotAggregation[]
  onRowsChange: (rows: string[]) => void
  onColumnsChange: (columns: string[]) => void
  onValuesChange: (values: PivotAggregation[]) => void
  filters: Record<string, string[]> // Фильтры: field -> selected values
  onFiltersChange: (filters: Record<string, string[]>) => void
  onBuild: () => void
  loading?: boolean
  projectId?: string
  versionId?: string
}

export function PivotBuilder({
  availableFields,
  availableParameters,
  selectedParameters,
  onSelectedParametersChange,
  rows,
  columns,
  values,
  filters,
  onRowsChange,
  onColumnsChange,
  onValuesChange,
  onFiltersChange,
  onBuild,
  loading = false,
  projectId,
  versionId,
}: PivotBuilderProps) {
  const [selectedRowField, setSelectedRowField] = useState<string>('')
  const [selectedColumnField, setSelectedColumnField] = useState<string>('')
  const [selectedValueField, setSelectedValueField] = useState<string>('')
  const [parameterSearch, setParameterSearch] = useState<string>('')
  
  // Состояние для фильтров
  const [openFilterField, setOpenFilterField] = useState<string | null>(null)
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({}) // field -> unique values
  const [loadingFilterValues, setLoadingFilterValues] = useState<Record<string, boolean>>({})
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({}) // field -> search query
  const prevFiltersRef = useRef<string>('') // Для отслеживания изменений фильтров

  const addRow = () => {
    if (selectedRowField && !rows.includes(selectedRowField)) {
      onRowsChange([...rows, selectedRowField])
      setSelectedRowField('')
    }
  }

  const removeRow = (field: string) => {
    onRowsChange(rows.filter((f) => f !== field))
  }

  const addColumn = () => {
    if (selectedColumnField && !columns.includes(selectedColumnField)) {
      onColumnsChange([...columns, selectedColumnField])
      setSelectedColumnField('')
    }
  }

  const removeColumn = (field: string) => {
    onColumnsChange(columns.filter((f) => f !== field))
  }

  const addValue = () => {
    if (selectedValueField) {
      const newValue: PivotAggregation = {
        field: selectedValueField,
        function: 'COUNT',
        displayName: `${selectedValueField} (COUNT)`,
      }
      onValuesChange([...values, newValue])
      setSelectedValueField('')
    }
  }

  const removeValue = (index: number) => {
    onValuesChange(values.filter((_, i) => i !== index))
  }

  const updateValueFunction = (index: number, func: AggregationFunction) => {
    const updated = [...values]
    updated[index] = {
      ...updated[index],
      function: func,
      displayName: `${updated[index].field} (${func})`,
    }
    onValuesChange(updated)
  }

  // Обработка выбора параметров
  const handleParameterToggle = (parameter: string) => {
    if (selectedParameters.includes(parameter)) {
      onSelectedParametersChange(selectedParameters.filter((p) => p !== parameter))
    } else {
      onSelectedParametersChange([...selectedParameters, parameter])
    }
  }

  const handleSelectAllParameters = () => {
    // Фильтруем параметры по поиску
    const filteredParams = availableParameters.filter(param =>
      param.toLowerCase().includes(parameterSearch.toLowerCase())
    )
    
    // Проверяем, все ли отфильтрованные параметры выбраны
    const allFilteredSelected = filteredParams.every(param => selectedParameters.includes(param))
    
    if (allFilteredSelected) {
      // Снимаем выбор с отфильтрованных
      onSelectedParametersChange(selectedParameters.filter(param => !filteredParams.includes(param)))
    } else {
      // Выбираем все отфильтрованные (добавляем к уже выбранным)
      const newSelected = [...new Set([...selectedParameters, ...filteredParams])]
      onSelectedParametersChange(newSelected)
    }
  }
  
  // Фильтруем параметры по поиску
  const filteredParameters = availableParameters.filter(param =>
    param.toLowerCase().includes(parameterSearch.toLowerCase())
  )

  // Получаем список всех доступных полей для фильтрации (базовые + выбранные параметры)
  // Исключаем служебные поля, а также "Название параметра" (parameter_name) и "Значение параметра" (parameter_value)
  const filterableFields = [
    ...availableFields
      .filter(f => 
        f.field !== 'selected_parameters' && 
        !f.field.includes('selected_parameters') &&
        f.field !== 'parameter_name' &&
        f.field !== 'parameter_value'
      )
      .map(f => ({ field: f.field, displayName: f.displayName })),
    ...selectedParameters
      .filter(p => p !== 'selected_parameters' && !p.includes('selected_parameters'))
      .filter(p => !availableFields.some(f => f.field === p))
      .map(p => ({
        field: p,
        displayName: p
      }))
  ]

  // Функция для загрузки значений фильтра с учетом других фильтров
  const loadFilterValues = async (field: string, currentFilters?: Record<string, string[]>) => {
    if (!projectId || !versionId) return
    
    // Используем переданные фильтры или текущие из состояния
    const filtersToUse = currentFilters !== undefined ? currentFilters : filters
    
    // Создаем копию фильтров без текущего поля для каскадной фильтрации
    const filtersForRequest = { ...filtersToUse }
    delete filtersForRequest[field]
    
    console.log(`📥 Загрузка значений для поля "${field}" с фильтрами:`, filtersForRequest)
    
    setLoadingFilterValues(prev => ({ ...prev, [field]: true }))
    try {
      const values = await getFilterValues({
        projectId,
        versionId,
        field,
        selectedParameters: selectedParameters.length > 0 ? selectedParameters : undefined,
        filters: Object.keys(filtersForRequest).length > 0 ? filtersForRequest : undefined, // Передаем фильтры без текущего поля
      })
      console.log(`✅ Получены значения для поля "${field}":`, values.length, 'значений')
      setFilterValues(prev => ({ ...prev, [field]: values }))
    } catch (error) {
      console.error(`❌ Ошибка загрузки значений для поля ${field}:`, error)
      setFilterValues(prev => ({ ...prev, [field]: [] }))
    } finally {
      setLoadingFilterValues(prev => ({ ...prev, [field]: false }))
    }
  }

  // Обработчик открытия фильтра для поля
  const handleFilterToggle = async (field: string) => {
    if (openFilterField === field) {
      setOpenFilterField(null)
    } else {
      setOpenFilterField(field)
      
      // Загружаем значения (всегда, так как они могут измениться из-за других фильтров)
      await loadFilterValues(field)
    }
  }

  // Обработчик изменения выбора значений в фильтре
  const handleFilterValueToggle = (field: string, value: string) => {
    // Проверяем, что поле не является служебным
    if (field === 'selected_parameters' || field.includes('selected_parameters')) {
      console.warn(`⚠️ Попытка установить фильтр для служебного поля: ${field}`)
      return
    }
    
    const currentValues = filters[field] || []
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
    
    const newFilters = { ...filters }
    if (newValues.length === 0) {
      delete newFilters[field]
    } else {
      newFilters[field] = newValues
    }
    console.log(`🔍 Фильтр изменен: поле='${field}', значение='${value}', новые значения:`, newFilters[field] || 'удалено')
    onFiltersChange(newFilters)
  }

  // Автоматическая перезагрузка значений фильтров при изменении других фильтров (каскадная фильтрация)
  useEffect(() => {
    // Сравниваем текущие фильтры с предыдущими (сериализуем для сравнения)
    const currentFiltersStr = JSON.stringify(filters)
    
    // Если фильтры не изменились, не перезагружаем
    if (currentFiltersStr === prevFiltersRef.current) {
      return
    }
    
    // Обновляем ссылку на предыдущие фильтры
    prevFiltersRef.current = currentFiltersStr
    
    // Перезагружаем значения для всех полей, которые уже были загружены
    // Это нужно для каскадной фильтрации - когда один фильтр изменяется,
    // значения в других фильтрах должны обновиться
    const reloadFilterValues = async () => {
      // Получаем список полей для перезагрузки:
      // 1. Поля, для которых уже загружены значения (filterValues)
      // 2. Поля, для которых есть сохраненные фильтры (filters) - для восстановления при загрузке вкладки
      const fieldsWithLoadedValues = Object.keys(filterValues)
      const fieldsWithFilters = Object.keys(filters)
      const fieldsToReload = Array.from(new Set([...fieldsWithLoadedValues, ...fieldsWithFilters]))
      
      // Если нет полей для перезагрузки, ничего не делаем
      if (fieldsToReload.length === 0) {
        return
      }
      
      console.log('🔄 Каскадная фильтрация: перезагрузка значений для полей:', fieldsToReload, 'с фильтрами:', filters)
      
      // Перезагружаем значения для всех полей с актуальными фильтрами
      for (const field of fieldsToReload) {
        // Пропускаем, если поле не является фильтруемым
        if (field === 'selected_parameters' || field.includes('selected_parameters')) {
          continue
        }
        
        // Передаем актуальные фильтры явно, чтобы избежать проблем с замыканием
        console.log(`  📊 Перезагрузка значений для поля "${field}" с фильтрами:`, filters)
        await loadFilterValues(field, filters)
      }
    }
    
    // Запускаем перезагрузку только если есть необходимые параметры
    if (projectId && versionId) {
      reloadFilterValues()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, projectId, versionId, selectedParameters])


  // Удаление фильтра для поля
  const handleFilterRemove = (field: string) => {
    const newFilters = { ...filters }
    delete newFilters[field]
    onFiltersChange(newFilters)
    if (openFilterField === field) {
      setOpenFilterField(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Выбор параметров для unpivot */}
      <div className="bg-[rgba(0,0,0,0.4)] rounded-lg p-4 border border-[rgba(255,255,255,0.1)]">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-500" />
          Выбор параметров
        </h3>
        <p className="text-sm text-[#999] mb-3">
          Выберите параметры, которые будут преобразованы в колонки. Только выбранные параметры будут доступны для работы в таблице.
        </p>
        
        {/* Поиск по параметрам */}
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#666]" />
            <input
              type="text"
              value={parameterSearch}
              onChange={(e) => setParameterSearch(e.target.value)}
              placeholder="Поиск параметров..."
              className="w-full pl-10 pr-4 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-primary-500 text-sm"
            />
          </div>
        </div>
        
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={handleSelectAllParameters}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            {filteredParameters.every(param => selectedParameters.includes(param)) && filteredParameters.length > 0
              ? 'Снять все' 
              : 'Выбрать все'}
          </button>
          {parameterSearch && (
            <span className="text-xs text-[#999]">
              Найдено: {filteredParameters.length} из {availableParameters.length}
            </span>
          )}
        </div>
        
        <div className="max-h-[200px] overflow-y-auto space-y-2 border border-[rgba(255,255,255,0.1)] rounded-md p-3 bg-[rgba(0,0,0,0.2)]">
          {availableParameters.length === 0 ? (
            <p className="text-sm text-[#666]">Нет доступных параметров</p>
          ) : filteredParameters.length === 0 ? (
            <p className="text-sm text-[#666]">Параметры не найдены</p>
          ) : (
            filteredParameters.map((parameter) => (
              <label
                key={parameter}
                className="flex items-center gap-2 p-2 hover:bg-[rgba(255,255,255,0.05)] rounded cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedParameters.includes(parameter)}
                  onChange={() => handleParameterToggle(parameter)}
                  className="w-4 h-4 text-primary-500 bg-[rgba(0,0,0,0.6)] border-[rgba(255,255,255,0.2)] rounded focus:ring-primary-500 focus:ring-2"
                />
                <span className="text-sm text-white">{parameter}</span>
              </label>
            ))
          )}
        </div>
        {selectedParameters.length > 0 && (
          <div className="mt-3 text-sm text-primary-400">
            Выбрано: {selectedParameters.length} параметр(ов)
            {parameterSearch && filteredParameters.length > 0 && (
              <span className="text-[#999] ml-2">
                (в отфильтрованных: {filteredParameters.filter(p => selectedParameters.includes(p)).length})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Фильтры */}
      <div className="bg-[rgba(0,0,0,0.4)] rounded-lg p-4 border border-[rgba(255,255,255,0.1)]">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-500" />
          Фильтры
        </h3>
        <p className="text-sm text-[#999] mb-3">
          Выберите значения для фильтрации данных.
        </p>

        {/* Список активных фильтров */}
        {Object.keys(filters).length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(filters).map(([field, values]) => {
              const fieldInfo = filterableFields.find(f => f.field === field)
              return (
                <div
                  key={field}
                  className="bg-primary-500/20 text-primary-200 px-3 py-1 rounded-md flex items-center gap-2"
                >
                  <span className="text-sm">
                    {fieldInfo?.displayName || field}: {values.length} знач.
                  </span>
                  <button
                    onClick={() => handleFilterRemove(field)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Список доступных полей для фильтрации */}
        <div className="space-y-2">
          {filterableFields.map((fieldInfo) => {
            const field = fieldInfo.field
            const isOpen = openFilterField === field
            const selectedValues = filters[field] || []
            const fieldUniqueValues = filterValues[field] || []
            const isLoading = loadingFilterValues[field] || false
            const searchQuery = filterSearch[field] || ''
            
            // Фильтруем значения по поисковому запросу
            const filteredValues = fieldUniqueValues.filter(value =>
              (value || '(пусто)').toLowerCase().includes(searchQuery.toLowerCase())
            )
            
            // Сортируем значения: выбранные вверху, затем остальные
            const sortedValues = [...filteredValues].sort((a, b) => {
              const aSelected = selectedValues.includes(a)
              const bSelected = selectedValues.includes(b)
              
              // Если одно выбрано, а другое нет - выбранное идет первым
              if (aSelected && !bSelected) return -1
              if (!aSelected && bSelected) return 1
              
              // Если оба выбраны или оба не выбраны - сортируем по алфавиту
              const aStr = (a || '(пусто)').toLowerCase()
              const bStr = (b || '(пусто)').toLowerCase()
              return aStr.localeCompare(bStr, 'ru')
            })
            
            // Ограничиваем отображение до 10 значений
            const displayValues = sortedValues.slice(0, 10)
            const hasMore = sortedValues.length > 10
            
            const allFilteredSelected = filteredValues.length > 0 && 
              filteredValues.every(v => selectedValues.includes(v))

            return (
              <div
                key={field}
                className="border border-[rgba(255,255,255,0.1)] rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => handleFilterToggle(field)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">
                      {fieldInfo.displayName}
                    </span>
                    {selectedValues.length > 0 && (
                      <span className="bg-primary-500/30 text-primary-200 px-2 py-0.5 rounded text-xs">
                        {selectedValues.length}
                      </span>
                    )}
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#999]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#999]" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-3 border-t border-[rgba(255,255,255,0.1)]">
                    {isLoading ? (
                      <div className="py-4 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                        <span className="ml-2 text-sm text-[#999]">Загрузка значений...</span>
                      </div>
                    ) : fieldUniqueValues.length === 0 ? (
                      <p className="py-4 text-sm text-[#666] text-center">
                        Нет доступных значений
                      </p>
                    ) : (
                      <>
                        {/* Поиск по значениям фильтра */}
                        <div className="mb-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#666]" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setFilterSearch(prev => ({ ...prev, [field]: e.target.value }))}
                              placeholder="Поиск значений..."
                              className="w-full pl-10 pr-4 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-primary-500 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            onClick={() => {
                              // Применяем выбор только к отфильтрованным значениям
                              const newFilters = { ...filters }
                              if (allFilteredSelected) {
                                // Снимаем выбор с отфильтрованных
                                const newSelected = selectedValues.filter(v => !filteredValues.includes(v))
                                if (newSelected.length === 0) {
                                  delete newFilters[field]
                                } else {
                                  newFilters[field] = newSelected
                                }
                              } else {
                                // Выбираем все отфильтрованные (добавляем к уже выбранным)
                                const newSelected = [...new Set([...selectedValues, ...filteredValues])]
                                newFilters[field] = newSelected
                              }
                              onFiltersChange(newFilters)
                            }}
                            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                          >
                            {allFilteredSelected ? 'Снять все' : 'Выбрать все'}
                          </button>
                          <span className="text-xs text-[#999]">
                            {searchQuery ? (
                              <>Найдено: {filteredValues.length} из {fieldUniqueValues.length}</>
                            ) : (
                              <>Всего: {fieldUniqueValues.length}</>
                            )}
                          </span>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto space-y-1 border border-[rgba(255,255,255,0.1)] rounded-md p-2 bg-[rgba(0,0,0,0.2)]">
                          {displayValues.length === 0 ? (
                            <p className="py-2 text-sm text-[#666] text-center">
                              Значения не найдены
                            </p>
                          ) : (
                            <>
                              {displayValues.map((value) => {
                                const isSelected = selectedValues.includes(value)
                                return (
                                  <label
                                    key={value}
                                    className="flex items-center gap-2 p-2 hover:bg-[rgba(255,255,255,0.05)] rounded cursor-pointer transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleFilterValueToggle(field, value)}
                                      className="w-4 h-4 text-primary-500 bg-[rgba(0,0,0,0.6)] border-[rgba(255,255,255,0.2)] rounded focus:ring-primary-500 focus:ring-2"
                                    />
                                    <span className="text-sm text-white flex-1 truncate">
                                      {value || '(пусто)'}
                                    </span>
                                  </label>
                                )
                              })}
                              {hasMore && (
                                <div className="py-2 text-center">
                                  <span className="text-xs text-[#666]">
                                    Показано {displayValues.length} из {filteredValues.length}. Используйте поиск для уточнения.
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Строки (Rows) */}
      <div className="bg-[rgba(0,0,0,0.4)] rounded-lg p-4 border border-[rgba(255,255,255,0.1)]">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <GripVertical className="w-5 h-5 text-primary-500" />
          Строки (Rows)
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {rows.map((field) => {
            const fieldInfo = availableFields.find((f) => f.field === field)
            return (
              <div
                key={field}
                className="bg-primary-500/20 text-primary-200 px-3 py-1 rounded-md flex items-center gap-2"
              >
                <span>{fieldInfo?.displayName || field}</span>
                <button
                  onClick={() => removeRow(field)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2">
          <select
            value={selectedRowField}
            onChange={(e) => setSelectedRowField(e.target.value)}
            className="flex-1 bg-[rgba(0,0,0,0.6)] border border-[rgba(255,255,255,0.2)] rounded-md px-3 py-2 text-white [&>option]:bg-white [&>option]:text-black"
          >
            <option value="">Выберите поле...</option>
            {availableFields
              .filter((f) => !rows.includes(f.field))
              .map((field) => (
                <option key={field.field} value={field.field}>
                  {field.displayName}
                </option>
              ))}
          </select>
          <Button onClick={addRow} className="bg-transparent border border-[rgba(255,255,255,0.2)] text-white hover:bg-[rgba(255,255,255,0.1)] h-9 px-3">
            <Plus className="w-4 h-4 mr-1" />
            Добавить
          </Button>
        </div>
      </div>

      {/* Колонки (Columns) */}
      <div className="bg-[rgba(0,0,0,0.4)] rounded-lg p-4 border border-[rgba(255,255,255,0.1)]">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <GripVertical className="w-5 h-5 text-primary-500" />
          Колонки (Columns)
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {columns.map((field) => {
            const fieldInfo = availableFields.find((f) => f.field === field)
            return (
              <div
                key={field}
                className="bg-primary-500/20 text-primary-200 px-3 py-1 rounded-md flex items-center gap-2"
              >
                <span>{fieldInfo?.displayName || field}</span>
                <button
                  onClick={() => removeColumn(field)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2">
          <select
            value={selectedColumnField}
            onChange={(e) => setSelectedColumnField(e.target.value)}
            className="flex-1 bg-[rgba(0,0,0,0.6)] border border-[rgba(255,255,255,0.2)] rounded-md px-3 py-2 text-white [&>option]:bg-white [&>option]:text-black"
          >
            <option value="">Выберите поле...</option>
            {availableFields
              .filter((f) => !columns.includes(f.field))
              .map((field) => (
                <option key={field.field} value={field.field}>
                  {field.displayName}
                </option>
              ))}
          </select>
          <Button onClick={addColumn} className="bg-transparent border border-[rgba(255,255,255,0.2)] text-white hover:bg-[rgba(255,255,255,0.1)] h-9 px-3">
            <Plus className="w-4 h-4 mr-1" />
            Добавить
          </Button>
        </div>
      </div>

      {/* Значения (Values) */}
      <div className="bg-[rgba(0,0,0,0.4)] rounded-lg p-4 border border-[rgba(255,255,255,0.1)]">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <GripVertical className="w-5 h-5 text-primary-500" />
          Значения (Values)
        </h3>
        <div className="space-y-2 mb-3">
          {values.map((value, index) => {
            const fieldInfo = availableFields.find((f) => f.field === value.field)
            return (
              <div
                key={index}
                className="bg-primary-500/20 text-primary-200 px-3 py-2 rounded-md flex items-center gap-3"
              >
                <span className="flex-1">
                  {fieldInfo?.displayName || value.field}
                </span>
                <select
                  value={value.function}
                  onChange={(e) =>
                    updateValueFunction(index, e.target.value as AggregationFunction)
                  }
                  className="bg-[rgba(0,0,0,0.6)] border border-[rgba(255,255,255,0.2)] rounded-md px-2 py-1 text-white text-sm [&>option]:bg-white [&>option]:text-black"
                >
                  <option value="COUNT">COUNT</option>
                  <option value="SUM">SUM</option>
                  <option value="AVG">AVG</option>
                  <option value="MIN">MIN</option>
                  <option value="MAX">MAX</option>
                  <option value="COUNT_DISTINCT">COUNT_DISTINCT</option>
                </select>
                <button
                  onClick={() => removeValue(index)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2">
          <select
            value={selectedValueField}
            onChange={(e) => setSelectedValueField(e.target.value)}
            className="flex-1 bg-[rgba(0,0,0,0.6)] border border-[rgba(255,255,255,0.2)] rounded-md px-3 py-2 text-white [&>option]:bg-white [&>option]:text-black"
          >
            <option value="">Выберите поле...</option>
            {availableFields.map((field) => (
              <option key={field.field} value={field.field}>
                {field.displayName}
              </option>
            ))}
          </select>
          <Button onClick={addValue} className="bg-transparent border border-[rgba(255,255,255,0.2)] text-white hover:bg-[rgba(255,255,255,0.1)] h-9 px-3">
            <Plus className="w-4 h-4 mr-1" />
            Добавить
          </Button>
        </div>
      </div>

      {/* Кнопка построения */}
      <Button
        onClick={onBuild}
        disabled={loading || (rows.length === 0 && columns.length === 0)}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Построение...
          </>
        ) : (
          'Построить Сводную таблицу'
        )}
      </Button>
    </div>
  )
}

