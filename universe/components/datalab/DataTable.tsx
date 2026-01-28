'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, Loader2, Filter, X } from 'lucide-react'
import { getCSVData, type CSVDataRow, type CSVDataFilters } from '@/lib/api/data'
import { Button } from '@/components/ui/button'

interface DataTableProps {
  fileUploadId?: string
  projectId?: string
  versionId?: string
  userId?: string
}

type SortField = 'row_number' | 'model_name' | 'element_id' | 'category' | 'parameter_name' | 'parameter_value'
type SortOrder = 'asc' | 'desc'

export function DataTable({ fileUploadId, projectId, versionId, userId }: DataTableProps) {
  const [data, setData] = useState<CSVDataRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit] = useState(100)
  const [hasMore, setHasMore] = useState(false)

  // Фильтры и поиск
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [parameterFilter, setParameterFilter] = useState<string>('')
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [availableParameters, setAvailableParameters] = useState<string[]>([])

  // Сортировка
  const [sortBy, setSortBy] = useState<SortField>('row_number')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // Логирование пропсов при изменении
  useEffect(() => {
    console.log('📋 DataTable props:', { fileUploadId, projectId, versionId, userId })
  }, [fileUploadId, projectId, versionId, userId])

  // Загрузка данных
  const loadData = async (resetOffset = false) => {
    try {
      setLoading(true)
      setError(null)

      const currentOffset = resetOffset ? 0 : offset

      const filters: CSVDataFilters = {
        fileUploadId,
        projectId,
        versionId,
        userId,
        search: search || undefined,
        category: categoryFilter || undefined,
        parameterName: parameterFilter || undefined,
        sortBy,
        sortOrder,
        limit,
        offset: currentOffset,
      }

      console.log('📊 Загрузка CSV данных с фильтрами:', filters)

      const response = await getCSVData(filters)

      console.log('✅ Получены данные:', {
        total: response.total,
        received: response.data.length,
        hasMore: response.hasMore,
      })

      if (resetOffset) {
        setData(response.data)
        setOffset(0)
      } else {
        setData((prev) => [...prev, ...response.data])
      }

      setTotal(response.total)
      setHasMore(response.hasMore)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки данных'
      console.error('❌ Error loading data:', err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Загрузка при изменении фильтров
  useEffect(() => {
    setOffset(0)
    loadData(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, parameterFilter, sortBy, sortOrder, fileUploadId, projectId, versionId])

  // Загрузка уникальных значений для фильтров
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const filters: CSVDataFilters = {
          fileUploadId,
          projectId,
          versionId,
          userId,
          limit: 1000, // Получаем больше для подсчета уникальных значений
        }

        const response = await getCSVData(filters)
        
        // Извлекаем уникальные категории и параметры
        const categories = new Set<string>()
        const parameters = new Set<string>()

        response.data.forEach((row) => {
          if (row.category) categories.add(row.category)
          if (row.parameterName) parameters.add(row.parameterName)
        })

        setAvailableCategories(Array.from(categories).sort())
        setAvailableParameters(Array.from(parameters).sort())
      } catch (err) {
        console.error('Error loading filters:', err)
      }
    }

    if (fileUploadId || projectId || versionId) {
      loadFilters()
    }
  }, [fileUploadId, projectId, versionId])

  // Обработка сортировки
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  // Сброс фильтров
  const resetFilters = () => {
    setSearch('')
    setCategoryFilter('')
    setParameterFilter('')
  }

  // Загрузка следующей страницы
  const loadMore = async () => {
    if (!loading && hasMore) {
      const newOffset = offset + limit
      setOffset(newOffset)
      
      try {
        setLoading(true)
        const filters: CSVDataFilters = {
          fileUploadId,
          projectId,
          versionId,
          userId,
          search: search || undefined,
          category: categoryFilter || undefined,
          parameterName: parameterFilter || undefined,
          sortBy,
          sortOrder,
          limit,
          offset: newOffset,
        }

        const response = await getCSVData(filters)
        setData((prev) => [...prev, ...response.data])
        setHasMore(response.hasMore)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных')
      } finally {
        setLoading(false)
      }
    }
  }

  // Отображение пустых значений
  const formatValue = (value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-[#666] italic">—</span>
    }
    return value
  }

  // Индикатор сортировки
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    )
  }

  const hasActiveFilters = search || categoryFilter || parameterFilter

  return (
    <div className="space-y-4">
      {/* Панель фильтров и поиска */}
      <div className="bg-[rgba(0,0,0,0.4)] backdrop-blur-[10px] rounded-lg p-4 border border-[rgba(255,255,255,0.1)]">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Поиск */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-[#ccc] mb-2">Поиск</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#666]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по всем полям..."
                className="w-full pl-10 pr-4 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          {/* Фильтр по категории */}
          <div className="min-w-[150px]">
            <label className="block text-sm text-[#ccc] mb-2">Категория</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-white focus:outline-none focus:border-primary-500 [&>option]:bg-white [&>option]:text-black"
            >
              <option value="">Все категории</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Фильтр по параметру */}
          <div className="min-w-[150px]">
            <label className="block text-sm text-[#ccc] mb-2">Параметр</label>
            <select
              value={parameterFilter}
              onChange={(e) => setParameterFilter(e.target.value)}
              className="w-full px-4 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-white focus:outline-none focus:border-primary-500 [&>option]:bg-white [&>option]:text-black"
            >
              <option value="">Все параметры</option>
              {availableParameters.map((param) => (
                <option key={param} value={param}>
                  {param}
                </option>
              ))}
            </select>
          </div>

          {/* Кнопка сброса фильтров */}
          {hasActiveFilters && (
            <Button
              onClick={resetFilters}
              className="border-[rgba(255,255,255,0.2)] text-[#ccc] hover:bg-[rgba(255,255,255,0.1)] bg-transparent"
            >
              <X className="w-4 h-4 mr-2" />
              Сбросить
            </Button>
          )}
        </div>

        {/* Статистика */}
        <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.1)]">
          <div className="flex gap-6 text-sm text-[#999]">
            <span>Всего записей: <span className="text-white font-semibold">{total.toLocaleString()}</span></span>
            <span>Отображено: <span className="text-white font-semibold">{data.length.toLocaleString()}</span></span>
            {hasActiveFilters && (
              <span className="text-primary-400">
                <Filter className="w-3 h-3 inline mr-1" />
                Фильтры активны
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg border border-[rgba(255,255,255,0.1)] overflow-hidden">
        {loading && data.length === 0 ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-500" />
            <p className="text-[#999]">Загрузка данных...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-400 mb-2">Ошибка загрузки данных</p>
            <p className="text-[#999] text-sm">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[#999]">Данные не найдены</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[rgba(255,255,255,0.05)] border-b border-[rgba(255,255,255,0.1)]">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-sm font-semibold text-[#ccc] cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                      onClick={() => handleSort('row_number')}
                    >
                      №
                      <SortIcon field="row_number" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-sm font-semibold text-[#ccc] cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                      onClick={() => handleSort('model_name')}
                    >
                      Модель
                      <SortIcon field="model_name" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-sm font-semibold text-[#ccc] cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                      onClick={() => handleSort('element_id')}
                    >
                      ID элемента
                      <SortIcon field="element_id" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-sm font-semibold text-[#ccc] cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                      onClick={() => handleSort('category')}
                    >
                      Категория
                      <SortIcon field="category" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-sm font-semibold text-[#ccc] cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                      onClick={() => handleSort('parameter_name')}
                    >
                      Параметр
                      <SortIcon field="parameter_name" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-sm font-semibold text-[#ccc] cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                      onClick={() => handleSort('parameter_value')}
                    >
                      Значение
                      <SortIcon field="parameter_value" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
                  {data.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-[#ccc]">{row.rowNumber}</td>
                      <td className="px-4 py-3 text-sm text-white">{formatValue(row.modelName)}</td>
                      <td className="px-4 py-3 text-sm text-white font-mono">{formatValue(row.elementId)}</td>
                      <td className="px-4 py-3 text-sm text-white">{formatValue(row.category)}</td>
                      <td className="px-4 py-3 text-sm text-white">{formatValue(row.parameterName)}</td>
                      <td className="px-4 py-3 text-sm text-white max-w-md truncate" title={row.parameterValue || ''}>
                        {formatValue(row.parameterValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Пагинация */}
            {hasMore && (
              <div className="p-4 border-t border-[rgba(255,255,255,0.1)] text-center">
                <Button
                  onClick={loadMore}
                  disabled={loading}
                  className="border-[rgba(255,255,255,0.2)] text-[#ccc] hover:bg-[rgba(255,255,255,0.1)]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    'Загрузить еще'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

