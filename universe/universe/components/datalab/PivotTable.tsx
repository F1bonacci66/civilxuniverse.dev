'use client'

import { useMemo, useState, useCallback } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { PivotResponse } from '@/lib/types/pivot'

// Флаг для отладочного логирования (только в dev режиме)
const DEBUG = process.env.NODE_ENV === 'development'

interface PivotTableProps {
  data: PivotResponse
}

interface HierarchicalRow {
  rowKey: string
  values: string[] // Разделенные значения полей
  level: number // Уровень вложенности (0, 1, 2, ...)
  rowspans: number[] // Количество строк для каждого уровня (rowspan для каждого поля)
  isFirstInGroup: boolean[] // Первая строка в группе для каждого уровня
}

export function PivotTable({ data }: PivotTableProps) {
  const dataAny = data as any
  let { rows, columns, cells, aggregations, rowsFields } = dataAny
  
  // КРИТИЧЕСКАЯ ПРОВЕРКА: если rowsFields нет, но rows содержат разделитель " | ", 
  // значит нужно извлечь rowsFields из структуры данных
  // Также проверяем, можем ли мы определить количество полей
  if (!rowsFields && rows.length > 0) {
    const firstRow = rows[0]
    if (firstRow && typeof firstRow === 'string' && firstRow.includes(' | ')) {
      // Если строка содержит разделитель, значит есть несколько полей
      const partsCount = firstRow.split(' | ').length
      console.warn('⚠️ rowsFields отсутствует в данных, но строки содержат разделитель " | "', {
        firstRow,
        partsCount,
        sampleRows: rows.slice(0, 3),
        fullData: data
      })
      
      // Создаем заглушку для rowsFields на основе количества частей
      // Это не идеально, но позволит отобразить иерархию
      rowsFields = Array.from({ length: partsCount }, (_, i) => `Поле ${i + 1}`)
      console.warn('⚠️ Создана заглушка rowsFields:', rowsFields)
    }
  }
  
  // Используем actualRowsFields вместо rowsFields для единообразия
  const actualRowsFields = rowsFields

  // Состояние для отслеживания свернутых групп
  // Ключ: "level:groupKey" (например, "0:Category1" или "1:Category1 | Subcategory1")
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Переключение состояния свернутости группы
  const toggleGroup = useCallback((level: number, groupKey: string) => {
    const key = `${level}:${groupKey}`
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // Проверка, свернута ли группа
  const isGroupCollapsed = useCallback((level: number, groupKey: string) => {
    const key = `${level}:${groupKey}`
    return collapsedGroups.has(key)
  }, [collapsedGroups])

  // Отладочное логирование (только в dev режиме)
  if (DEBUG) {
    console.log('📊 PivotTable получил данные:', {
      rowsCount: rows.length,
      columnsCount: columns.length,
      cellsCount: cells.length,
      rowsFields: rowsFields,
      actualRowsFields: actualRowsFields,
    })
  }

  // Создаем мапу для быстрого доступа к ячейкам (мемоизировано)
  const cellMap = useMemo(() => {
    const map = new Map<string, Record<string, any>>()
    cells.forEach((cell: any) => {
      const key = `${cell.rowKey}|${cell.columnKey}`
      map.set(key, cell.values || {})
    })
    return map
  }, [cells])

  // Получаем ключи агрегаций для заголовков (мемоизировано)
  const aggregationKeys = useMemo(
    () => aggregations.map(
      (agg: any) => agg.displayName || `${agg.function}(${agg.field})`
    ),
    [aggregations]
  )

  // Строим иерархическую структуру строк, если есть несколько полей
  const hierarchicalRows = useMemo(() => {
    // Определяем локальную переменную для rowsFields внутри useMemo
    let localRowsFields = actualRowsFields
    
    // Проверяем, есть ли разделитель в строках - это индикатор иерархии
    const hasSeparator = rows.length > 0 && rows[0] && typeof rows[0] === 'string' && rows[0].includes(' | ')
    
    if (DEBUG) {
      console.log('🔍 Построение иерархических строк:', {
        rowsFields: actualRowsFields,
        rowsCount: rows.length,
        hasSeparator
      })
    }
    
    // Если rowsFields нет, но есть разделитель - создаем заглушку
    if (!localRowsFields && hasSeparator) {
      const partsCount = rows[0].split(' | ').length
      localRowsFields = Array.from({ length: partsCount }, (_, i) => `Поле ${i + 1}`)
      console.log('⚠️ rowsFields отсутствует, но есть разделитель. Создана заглушка для', partsCount, 'полей:', localRowsFields)
    }
    
    if (!localRowsFields || localRowsFields.length <= 1) {
      if (DEBUG) {
        console.log('⚠️ Иерархия не используется: rowsFields отсутствует или содержит <= 1 поле')
      }
      // Если одно поле или нет информации о полях, возвращаем простой список
      return rows.map((row: any) => ({
        rowKey: row,
        values: [row],
        level: 0,
        rowspans: [1],
        isFirstInGroup: [true],
      }))
    }
    
    if (DEBUG) {
      console.log('✅ Используется иерархическое отображение с', localRowsFields.length, 'полями')
    }

    // Парсим строки вида "value1 | value2 | value3"
    const parsedRows: HierarchicalRow[] = rows.map((row: any) => {
      const values = row.split(' | ')
      return {
        rowKey: row,
        values,
        level: values.length - 1, // Последний уровень
        rowspans: new Array(localRowsFields.length).fill(1),
        isFirstInGroup: new Array(localRowsFields.length).fill(false),
      }
    })

    // Вычисляем rowspan для каждого уровня
    // Для каждого уровня группируем строки по значениям предыдущих уровней
    for (let level = 0; level < localRowsFields.length; level++) {
      let currentGroup: string | null = null
      let groupStartIndex = 0
      let groupCount = 0

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i]
        // Формируем ключ группы из значений предыдущих уровней (до текущего уровня)
        const groupKey = row.values.slice(0, level + 1).join(' | ')

        if (groupKey !== currentGroup) {
          // Новая группа
          if (currentGroup !== null && groupCount > 0) {
            // Устанавливаем rowspan для первой строки предыдущей группы на текущем уровне
            parsedRows[groupStartIndex].rowspans[level] = groupCount
          }
          currentGroup = groupKey
          groupStartIndex = i
          groupCount = 1
          parsedRows[i].isFirstInGroup[level] = true
        } else {
          // Продолжение группы
          groupCount++
          parsedRows[i].isFirstInGroup[level] = false
        }
      }

      // Обрабатываем последнюю группу
      if (currentGroup !== null && groupCount > 0) {
        parsedRows[groupStartIndex].rowspans[level] = groupCount
      }
    }

    if (DEBUG) {
      console.log('✅ Иерархические строки построены:', {
        totalRows: parsedRows.length,
      })
    }

    return parsedRows
  }, [rows, actualRowsFields])

  // Фильтруем строки в зависимости от свернутых групп и пересчитываем rowspan
  const visibleRows = useMemo(() => {
    // Определяем количество полей из hierarchicalRows (если они построены)
    const fieldsCount = hierarchicalRows.length > 0 && hierarchicalRows[0].values.length > 1 
      ? hierarchicalRows[0].values.length 
      : (actualRowsFields?.length || 0)
    
    if (fieldsCount <= 1) {
      return hierarchicalRows
    }

    const visible: HierarchicalRow[] = []
    
    // Сначала фильтруем строки
    for (let i = 0; i < hierarchicalRows.length; i++) {
      const row = hierarchicalRows[i]
      let shouldShow = true

      // Проверяем все уровни выше текущего
      // Если на каком-то уровне группа свернута, скрываем только дочерние строки
      // Родительская строка (первая строка группы) должна оставаться видимой
      for (let level = 0; level < row.values.length - 1; level++) {
        // Формируем ключ группы для этого уровня
        const groupKey = row.values.slice(0, level + 1).join(' | ')
        
        // Если группа на этом уровне свернута
        if (isGroupCollapsed(level, groupKey)) {
          // Проверяем, является ли эта строка первой строкой группы на этом уровне
          // Сравниваем с предыдущей строкой - если ключ группы изменился, это первая строка
          let isFirstInGroup = true
          if (i > 0) {
            const prevRow = hierarchicalRows[i - 1]
            const prevGroupKey = prevRow.values.slice(0, level + 1).join(' | ')
            if (prevGroupKey === groupKey) {
              // Предыдущая строка имеет тот же ключ группы - это не первая строка
              isFirstInGroup = false
            }
          }
          
          if (!isFirstInGroup) {
            // Это дочерняя строка внутри свернутой группы - скрываем
            shouldShow = false
            break
          }
          // Если это первая строка группы, продолжаем проверку следующих уровней
        }
      }

      if (shouldShow) {
        visible.push({ ...row })
      }
    }

    // Пересчитываем rowspan для видимых строк
    if (visible.length > 0 && fieldsCount > 1) {
      for (let level = 0; level < fieldsCount; level++) {
        let currentGroup: string | null = null
        let groupStartIndex = 0
        let groupCount = 0

        for (let i = 0; i < visible.length; i++) {
          const row = visible[i]
          // Формируем ключ группы из значений до текущего уровня включительно
          const groupKey = row.values.slice(0, level + 1).join(' | ')

          if (groupKey !== currentGroup) {
            // Новая группа
            if (currentGroup !== null && groupCount > 0) {
              // Устанавливаем rowspan для первой строки предыдущей группы
              visible[groupStartIndex].rowspans[level] = groupCount
              visible[groupStartIndex].isFirstInGroup[level] = true
            }
            currentGroup = groupKey
            groupStartIndex = i
            groupCount = 1
            visible[i].isFirstInGroup[level] = true
          } else {
            // Продолжение группы
            groupCount++
            visible[i].isFirstInGroup[level] = false
          }
        }

        // Обрабатываем последнюю группу
        if (currentGroup !== null && groupCount > 0) {
          visible[groupStartIndex].rowspans[level] = groupCount
        }
      }
    }

    return visible
  }, [hierarchicalRows, actualRowsFields, isGroupCollapsed])

  // Предвычисляем hasChildren для каждой строки и уровня (мемоизировано)
  const hasChildrenMap = useMemo(() => {
    const map = new Map<string, boolean>() // key: "rowIndex:fieldIndex"
    const fieldsCount = hierarchicalRows.length > 0 && hierarchicalRows[0].values.length > 1 
      ? hierarchicalRows[0].values.length 
      : (actualRowsFields?.length || 0)
    
    if (fieldsCount <= 1) return map
    
    hierarchicalRows.forEach((row: HierarchicalRow, rowIndex: number) => {
      for (let fieldIndex = 0; fieldIndex < fieldsCount - 1; fieldIndex++) {
        const groupKey = row.values.slice(0, fieldIndex + 1).join(' | ')
        const key = `${rowIndex}:${fieldIndex}`
        
        // Проверяем, есть ли дочерние элементы
        const hasChildren = hierarchicalRows.some((r: HierarchicalRow, idx: number) => {
          if (idx === rowIndex) return false // Не сравниваем с самим собой
          if (r.values.length <= fieldIndex + 1) return false
          const childGroupKey = r.values.slice(0, fieldIndex + 1).join(' | ')
          return childGroupKey === groupKey
        })
        
        map.set(key, hasChildren)
      }
    })
    
    return map
  }, [hierarchicalRows, actualRowsFields])

  // Предвычисляем агрегации для свернутых групп (мемоизировано)
  const collapsedGroupAggregations = useMemo(() => {
    const map = new Map<string, Record<string, number>>() // key: "rowKey:colKey:aggKey" -> {col: value} или {"Все": value}
    const fieldsCount = actualRowsFields?.length || (hierarchicalRows.length > 0 ? hierarchicalRows[0].values.length : 0)
    
    if (fieldsCount <= 1 || collapsedGroups.size === 0) return map
    
    // Находим все свернутые группы
    const collapsedGroupsList: Array<{ level: number; groupKey: string; parentRowKey: string }> = []
    
    hierarchicalRows.forEach((row: HierarchicalRow, rowIndex: number) => {
      for (let level = 0; level < fieldsCount - 1; level++) {
        const groupKey = row.values.slice(0, level + 1).join(' | ')
        const key = `${level}:${groupKey}`
        
        if (collapsedGroups.has(key)) {
          // Проверяем, является ли эта строка первой строкой группы
          let isFirstInGroup = true
          if (rowIndex > 0) {
            const prevRow = hierarchicalRows[rowIndex - 1]
            const prevGroupKey = prevRow.values.slice(0, level + 1).join(' | ')
            if (prevGroupKey === groupKey) {
              isFirstInGroup = false
            }
          }
          
          if (isFirstInGroup) {
            collapsedGroupsList.push({
              level,
              groupKey,
              parentRowKey: row.rowKey
            })
          }
        }
      }
    })
    
    // Вычисляем агрегации для каждой свернутой группы
    collapsedGroupsList.forEach(({ level, groupKey, parentRowKey }) => {
      const childRows = hierarchicalRows.filter((r: HierarchicalRow) => {
        if (r.values.length <= level + 1) return false
        const childGroupKey = r.values.slice(0, level + 1).join(' | ')
        return childGroupKey === groupKey && r.rowKey !== parentRowKey
      })
      
      // Обрабатываем колонки
      const colsToProcess = columns.length > 0 ? columns : ['Все']
      colsToProcess.forEach((col: string) => {
        aggregationKeys.forEach((aggKey: string) => {
          const aggFunction = aggregations.find((agg: any) => 
            (agg.displayName || `${agg.function}(${agg.field})`) === aggKey
          )?.function || 'SUM'
          
          const values: number[] = []
          childRows.forEach((childRow: HierarchicalRow) => {
            const childKey = `${childRow.rowKey}|${col}`
            const childCellValues = cellMap.get(childKey) || {}
            const childValue = childCellValues[aggKey]
            if (typeof childValue === 'number') {
              values.push(childValue)
            }
          })
          
          if (values.length > 0) {
            let aggregatedValue: number
            switch (aggFunction.toUpperCase()) {
              case 'SUM':
                aggregatedValue = values.reduce((sum, v) => sum + v, 0)
                break
              case 'AVG':
              case 'AVERAGE':
                aggregatedValue = values.reduce((sum, v) => sum + v, 0) / values.length
                break
              case 'COUNT':
                aggregatedValue = values.reduce((sum, v) => sum + v, 0)
                break
              case 'MIN':
                aggregatedValue = Math.min(...values)
                break
              case 'MAX':
                aggregatedValue = Math.max(...values)
                break
              default:
                aggregatedValue = values.reduce((sum, v) => sum + v, 0)
            }
            
            const mapKey = `${parentRowKey}:${col}:${aggKey}`
            map.set(mapKey, { [col]: aggregatedValue })
          }
        })
      })
    })
    
    return map
  }, [hierarchicalRows, collapsedGroups, columns, aggregationKeys, aggregations, cellMap, actualRowsFields])

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-[rgba(0,0,0,0.4)] rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-[rgba(0,0,0,0.6)]">
            {/* Заголовки для строк (иерархические, если есть несколько полей) */}
            {((actualRowsFields && actualRowsFields.length > 1) || (rows.length > 0 && rows[0]?.includes?.(' | '))) ? (
              (actualRowsFields || (rows.length > 0 ? Array.from({ length: rows[0].split(' | ').length }, (_, i) => `Поле ${i + 1}`) : [])).map((field: any, index: number) => (
                <th
                  key={field}
                  className="px-4 py-3 text-left border-b border-[rgba(255,255,255,0.1)] text-primary-300 font-semibold"
                >
                  {field}
                </th>
              ))
            ) : (
              <th className="px-4 py-3 text-left border-b border-[rgba(255,255,255,0.1)] text-primary-300 font-semibold">
                {rows.length > 0 ? 'Строки' : 'Все'}
              </th>
            )}
            {/* Заголовки для колонок */}
            {columns.length > 0 ? (
              columns.map((col: any) => (
                <th
                  key={col}
                  className="px-4 py-3 text-center border-b border-[rgba(255,255,255,0.1)] text-primary-300 font-semibold"
                  colSpan={aggregationKeys.length}
                >
                  {col}
                </th>
              ))
            ) : (
              <th
                className="px-4 py-3 text-center border-b border-[rgba(255,255,255,0.1)] text-primary-300 font-semibold"
                colSpan={aggregationKeys.length}
              >
                Все
              </th>
            )}
          </tr>
          {/* Подзаголовки для агрегаций */}
          {aggregationKeys.length > 1 && (
            <tr className="bg-[rgba(0,0,0,0.5)]">
              {/* Пустые ячейки для строк (соответствуют количеству полей строк) */}
              {actualRowsFields && actualRowsFields.length > 1 ? (
                actualRowsFields.map((field: any) => (
                  <th key={field} className="px-4 py-2 border-b border-[rgba(255,255,255,0.1)]"></th>
                ))
              ) : (
                <th className="px-4 py-2 border-b border-[rgba(255,255,255,0.1)]"></th>
              )}
              {columns.length > 0
                ? columns.flatMap((col: any) =>
                    aggregationKeys.map((aggKey: any) => (
                      <th
                        key={`${col}-${aggKey}`}
                        className="px-4 py-2 text-center border-b border-[rgba(255,255,255,0.1)] text-sm text-gray-400"
                      >
                        {aggKey}
                      </th>
                    ))
                  )
                : aggregationKeys.map((aggKey: any) => (
                    <th
                      key={aggKey}
                      className="px-4 py-2 text-center border-b border-[rgba(255,255,255,0.1)] text-sm text-gray-400"
                    >
                      {aggKey}
                    </th>
                  ))}
            </tr>
          )}
        </thead>
        <tbody>
          {visibleRows.length > 0 ? (
            visibleRows.map((hierRow: HierarchicalRow, rowIndex: number) => (
              <tr key={hierRow.rowKey} className="hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                {/* Иерархическое отображение строк */}
                {((actualRowsFields && actualRowsFields.length > 1) || (hierRow.values && hierRow.values.length > 1)) ? (
                  (actualRowsFields || (hierRow.values ? Array.from({ length: hierRow.values.length }, (_, i) => `Поле ${i + 1}`) : [])).map((field: any, fieldIndex: number) => {
                    // Показываем ячейку только если это первая строка в группе для данного уровня
                    const shouldShow = hierRow.isFirstInGroup[fieldIndex]
                    if (!shouldShow) {
                      // Не рендерим ячейку, так как она уже объединена через rowspan
                      // В HTML таблицах ячейка с rowspan физически занимает несколько строк
                      return null
                    }

                    const value = hierRow.values[fieldIndex] || ''
                    const rowspan = hierRow.rowspans[fieldIndex] > 1 ? hierRow.rowspans[fieldIndex] : undefined
                    const indentLevel = fieldIndex * 24 // Отступ 24px на уровень
                    
                    // Формируем ключ группы для этого уровня
                    const groupKey = hierRow.values.slice(0, fieldIndex + 1).join(' | ')
                    
                    // Используем предвычисленное значение hasChildren
                    const hasChildrenKey = `${rowIndex}:${fieldIndex}`
                    const hasChildren = hasChildrenMap.get(hasChildrenKey) || false
                    
                    // Проверяем, свернута ли группа
                    const isCollapsed = hasChildren && isGroupCollapsed(fieldIndex, groupKey)
                    
                    return (
                      <td
                        key={`${hierRow.rowKey}-${fieldIndex}`}
                        className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)] font-medium text-white"
                        rowSpan={rowspan}
                        style={{
                          paddingLeft: `${16 + indentLevel}px`,
                          verticalAlign: 'top',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {hasChildren ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleGroup(fieldIndex, groupKey)
                              }}
                              className="flex items-center justify-center w-5 h-5 hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
                              title={isCollapsed ? 'Развернуть' : 'Свернуть'}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-primary-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-primary-400" />
                              )}
                            </button>
                          ) : (
                            <span className="w-5 h-5 flex items-center justify-center">
                              {fieldIndex > 0 && (
                                <span className="text-primary-400 text-xs">└</span>
                              )}
                            </span>
                          )}
                          {/* Скрываем значение в столбцах иерархии, если группа свернута на уровне выше */}
                          {(() => {
                            // Проверяем, свернута ли группа на любом уровне выше текущего столбца
                            let shouldHideValue = false
                            
                            // Проверяем все уровни выше текущего столбца (fieldIndex)
                            for (let checkLevel = 0; checkLevel < fieldIndex; checkLevel++) {
                              const checkGroupKey = hierRow.values.slice(0, checkLevel + 1).join(' | ')
                              if (isGroupCollapsed(checkLevel, checkGroupKey)) {
                                // Группа на этом уровне свернута
                                // Проверяем, является ли текущая строка первой строкой этой свернутой группы
                                // Сравниваем с предыдущей видимой строкой
                                let isFirstInGroup = true
                                if (rowIndex > 0) {
                                  const prevRow = visibleRows[rowIndex - 1]
                                  const prevGroupKey = prevRow.values.slice(0, checkLevel + 1).join(' | ')
                                  if (prevGroupKey === checkGroupKey) {
                                    // Предыдущая строка имеет тот же ключ группы - это не первая строка
                                    isFirstInGroup = false
                                  }
                                }
                                
                                // Если это не первая строка свернутой группы, скрываем значение
                                // ИЛИ если это первая строка, но мы находимся в столбце ниже свернутого уровня
                                if (!isFirstInGroup) {
                                  shouldHideValue = true
                                  break
                                }
                                // Если это первая строка свернутой группы, но мы в столбце ниже - тоже скрываем
                                // (например, если модель свернута, скрываем значение категории)
                                if (isFirstInGroup && checkLevel < fieldIndex) {
                                  shouldHideValue = true
                                  break
                                }
                              }
                            }
                            
                            
                            return shouldHideValue ? (
                              <span className="text-gray-500 italic">...</span>
                            ) : (
                              <span>{value || '(пусто)'}</span>
                            )
                          })()}
                        </div>
                      </td>
                    )
                  }).filter(Boolean)
                ) : (
                  <td className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)] font-medium text-white">
                    {hierRow.rowKey}
                  </td>
                )}
                {columns.length > 0
                  ? columns.flatMap((col: any) =>
                      aggregationKeys.map((aggKey: any) => {
                        // Проверяем, является ли эта строка родительской для свернутой группы
                        // Если да, вычисляем агрегированные значения по всем дочерним строкам
                        let value: any = '-'
                        
                        // Находим все свернутые группы, к которым относится эта строка
                        let isParentOfCollapsedGroup = false
                        let collapsedGroupKey: string | null = null
                        let collapsedLevel = -1
                        
                        const fieldsCount = actualRowsFields?.length || hierRow.values.length
                        for (let level = 0; level < fieldsCount - 1; level++) {
                          const groupKey = hierRow.values.slice(0, level + 1).join(' | ')
                          if (isGroupCollapsed(level, groupKey)) {
                            // Проверяем, является ли текущая строка первой строкой этой свернутой группы
                            let isFirstInGroup = true
                            if (rowIndex > 0) {
                              const prevRow = visibleRows[rowIndex - 1]
                              const prevGroupKey = prevRow.values.slice(0, level + 1).join(' | ')
                              if (prevGroupKey === groupKey) {
                                isFirstInGroup = false
                              }
                            }
                            
                            if (isFirstInGroup) {
                              isParentOfCollapsedGroup = true
                              collapsedGroupKey = groupKey
                              collapsedLevel = level
                              break
                            }
                          }
                        }
                        
                        if (isParentOfCollapsedGroup && collapsedGroupKey) {
                          // Используем предвычисленную агрегацию
                          const mapKey = `${hierRow.rowKey}:${col}:${aggKey}`
                          const aggregated = collapsedGroupAggregations.get(mapKey)
                          if (aggregated && aggregated[col] !== undefined) {
                            value = aggregated[col]
                          } else {
                            value = '-'
                          }
                        } else {
                          // Обычное значение для развернутой строки
                          const key = `${hierRow.rowKey}|${col}`
                          const cellValues = cellMap.get(key) || {}
                          value = cellValues[aggKey] ?? '-'
                        }
                        
                        return (
                          <td
                            key={`${hierRow.rowKey}-${col}-${aggKey}`}
                            className="px-4 py-3 text-center border-b border-[rgba(255,255,255,0.1)] text-white"
                          >
                            {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
                          </td>
                        )
                      })
                    )
                  : aggregationKeys.map((aggKey: any) => {
                      // Проверяем, является ли эта строка родительской для свернутой группы
                      let value: any = '-'
                      
                      // Находим все свернутые группы, к которым относится эта строка
                      let isParentOfCollapsedGroup = false
                      let collapsedGroupKey: string | null = null
                      let collapsedLevel = -1
                      
                      const fieldsCount = actualRowsFields?.length || hierRow.values.length
                      for (let level = 0; level < fieldsCount - 1; level++) {
                        const groupKey = hierRow.values.slice(0, level + 1).join(' | ')
                        if (isGroupCollapsed(level, groupKey)) {
                          // Проверяем, является ли текущая строка первой строкой этой свернутой группы
                          let isFirstInGroup = true
                          if (rowIndex > 0) {
                            const prevRow = visibleRows[rowIndex - 1]
                            const prevGroupKey = prevRow.values.slice(0, level + 1).join(' | ')
                            if (prevGroupKey === groupKey) {
                              isFirstInGroup = false
                            }
                          }
                          
                          if (isFirstInGroup) {
                            isParentOfCollapsedGroup = true
                            collapsedGroupKey = groupKey
                            collapsedLevel = level
                            break
                          }
                        }
                      }
                      
                      if (isParentOfCollapsedGroup && collapsedGroupKey) {
                        // Используем предвычисленную агрегацию
                        const mapKey = `${hierRow.rowKey}:Все:${aggKey}`
                        const aggregated = collapsedGroupAggregations.get(mapKey)
                        if (aggregated && aggregated['Все'] !== undefined) {
                          value = aggregated['Все']
                        } else {
                          value = '-'
                        }
                      } else {
                        // Обычное значение для развернутой строки
                        const key = `${hierRow.rowKey}|Все`
                        const cellValues = cellMap.get(key) || {}
                        value = cellValues[aggKey] ?? '-'
                      }
                      
                      return (
                        <td
                          key={`${hierRow.rowKey}-${aggKey}`}
                          className="px-4 py-3 text-center border-b border-[rgba(255,255,255,0.1)] text-white"
                        >
                          {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
                        </td>
                      )
                    })}
              </tr>
            ))
          ) : (
            <tr className="hover:bg-[rgba(255,255,255,0.05)] transition-colors">
              {/* Пустые ячейки для строк (соответствуют количеству полей строк) */}
              {((actualRowsFields && actualRowsFields.length > 1) || (rows.length > 0 && rows[0]?.includes?.(' | '))) ? (
                (actualRowsFields || (rows.length > 0 ? Array.from({ length: rows[0].split(' | ').length }, (_, i) => `Поле ${i + 1}`) : [])).map((field: any, index: number) => (
                  <td key={field} className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)] font-medium text-white">
                    {index === 0 ? 'Все' : ''}
                  </td>
                ))
              ) : (
                <td className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)] font-medium text-white">
                  Все
                </td>
              )}
              {columns.length > 0
                ? columns.flatMap((col: string) =>
                    aggregationKeys.map((aggKey: string) => {
                      const key = `Все|${col}`
                      const cellValues = cellMap.get(key) || {}
                      const value = cellValues[aggKey] ?? '-'
                      return (
                        <td
                          key={`${col}-${aggKey}`}
                          className="px-4 py-3 text-center border-b border-[rgba(255,255,255,0.1)] text-white"
                        >
                          {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
                        </td>
                      )
                    })
                  )
                : aggregationKeys.map((aggKey: string) => {
                    const key = `Все|Все`
                    const cellValues = cellMap.get(key) || {}
                    const value = cellValues[aggKey] ?? '-'
                    return (
                      <td
                        key={aggKey}
                        className="px-4 py-3 text-center border-b border-[rgba(255,255,255,0.1)] text-white"
                      >
                        {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
                      </td>
                    )
                  })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

