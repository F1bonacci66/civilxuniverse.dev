'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronRight, ChevronDown, Search, Eye, EyeOff } from 'lucide-react'
import type { ViewerMetadata } from '@/lib/api/viewer'
import { cn } from '@/lib/utils'

interface ViewerTreeProps {
  metadata: ViewerMetadata | null
  selectedElementIds: string[]
  hiddenElementIds: string[]
  onElementSelect: (elementId: string) => void
  onElementToggleVisibility: (elementId: string, visible: boolean) => void
  onElementsSelect: (elementIds: string[]) => void
  className?: string
}

interface TreeNode {
  id: string
  name: string
  type: 'category' | 'family' | 'element'
  children?: TreeNode[]
  elementIds?: string[] // Для категорий и семейств - все elementIds в поддереве
  parent?: TreeNode
}

export function ViewerTree({
  metadata,
  selectedElementIds,
  hiddenElementIds,
  onElementSelect,
  onElementToggleVisibility,
  onElementsSelect,
  className,
}: ViewerTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Построение дерева из metadata
  // Структура: Категории → Семейства → Элементы
  const tree = useMemo(() => {
    if (!metadata || !metadata.elements) return null

    const categoryMap = new Map<string, Map<string, string[]>>()
    // Структура: category -> family -> elementIds[]

    // Группируем элементы по категориям и семействам
    Object.entries(metadata.elements).forEach(([elementId, element]) => {
      const category = element.category || 'Без категории'
      const family = element.family || 'Без семейства'

      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Map())
      }
      const familyMap = categoryMap.get(category)!

      if (!familyMap.has(family)) {
        familyMap.set(family, [])
      }
      familyMap.get(family)!.push(elementId)
    })

    // Строим дерево
    const buildTree = (): TreeNode[] => {
      const rootNodes: TreeNode[] = []

      categoryMap.forEach((familyMap, category) => {
        const categoryNode: TreeNode = {
          id: `category-${category}`,
          name: category,
          type: 'category',
          children: [],
          elementIds: [],
        }

        familyMap.forEach((elementIds, family) => {
          const familyNode: TreeNode = {
            id: `family-${category}-${family}`,
            name: family,
            type: 'family',
            children: [],
            elementIds: elementIds,
            parent: categoryNode,
          }

          // Добавляем элементы как листья
          elementIds.forEach((elementId) => {
            // Пытаемся получить имя элемента из properties
            const element = metadata.elements[elementId]
            const elementName =
              element?.properties?.Name ||
              element?.properties?.ElementId ||
              elementId

            const elementNode: TreeNode = {
              id: elementId,
              name: elementName,
              type: 'element',
              parent: familyNode,
            }
            familyNode.children!.push(elementNode)
          })

          categoryNode.children!.push(familyNode)
          categoryNode.elementIds!.push(...elementIds)
        })

        rootNodes.push(categoryNode)
      })

      return rootNodes
    }

    return buildTree()
  }, [metadata])

  // Фильтрация дерева по поисковому запросу
  const filteredTree = useMemo(() => {
    if (!tree || !searchQuery.trim()) return tree

    const query = searchQuery.toLowerCase().trim()
    const filterNode = (node: TreeNode): TreeNode | null => {
      // Проверяем, соответствует ли узел запросу
      const matchesQuery =
        node.name.toLowerCase().includes(query) ||
        (node.type === 'element' && node.id.toLowerCase().includes(query))

      if (node.type === 'element') {
        // Для элементов проверяем только сам элемент
        return matchesQuery ? node : null
      }

      // Для категорий и семейств проверяем детей
      const filteredChildren: TreeNode[] = []
      if (node.children) {
        node.children.forEach((child) => {
          const filteredChild = filterNode(child)
          if (filteredChild) {
            filteredChildren.push(filteredChild)
          }
        })
      }

      // Если узел соответствует запросу или есть подходящие дети
      if (matchesQuery || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        }
      }

      return null
    }

    const filtered: TreeNode[] = []
    tree.forEach((node) => {
      const filteredNode = filterNode(node)
      if (filteredNode) {
        filtered.push(filteredNode)
      }
    })

    return filtered
  }, [tree, searchQuery])

  // Переключение развернутости узла
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  // Обработка клика на элемент
  const handleElementClick = useCallback(
    (elementId: string, event: React.MouseEvent) => {
      event.stopPropagation()
      
      // Если зажат Ctrl/Cmd, добавляем к выделению, иначе заменяем
      if (event.ctrlKey || event.metaKey) {
        // Множественный выбор
        if (selectedElementIds.includes(elementId)) {
          // Убираем из выделения
          const newSelection = selectedElementIds.filter((id) => id !== elementId)
          onElementsSelect(newSelection)
        } else {
          // Добавляем к выделению
          onElementsSelect([...selectedElementIds, elementId])
        }
      } else {
        // Одиночный выбор
        onElementSelect(elementId)
      }
    },
    [onElementSelect, onElementsSelect, selectedElementIds]
  )

  // Обработка переключения видимости
  const handleVisibilityToggle = useCallback(
    (elementId: string, event: React.MouseEvent) => {
      event.stopPropagation()
      const isHidden = hiddenElementIds.includes(elementId)
      onElementToggleVisibility(elementId, isHidden)
    },
    [hiddenElementIds, onElementToggleVisibility]
  )

  // Рендер узла дерева
  const renderNode = useCallback(
    (node: TreeNode, level: number = 0): React.ReactNode => {
      const isExpanded = expandedNodes.has(node.id)
      const hasChildren = node.children && node.children.length > 0
      const isElement = node.type === 'element' && !hasChildren
      const isSelected = isElement && selectedElementIds.includes(node.id)
      const isHidden = isElement && hiddenElementIds.includes(node.id)

      return (
        <div key={node.id}>
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[rgba(20,184,166,0.05)] transition-colors',
              isSelected && 'bg-[rgba(20,184,166,0.1)] text-primary-400',
              isHidden && 'opacity-50'
            )}
            style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
            onClick={(e) => {
              if (hasChildren) {
                toggleNode(node.id)
              } else if (isElement) {
                handleElementClick(node.id, e)
              }
            }}
          >
            {/* Иконка развернутости */}
            {hasChildren ? (
              <button
                className="w-4 h-4 flex items-center justify-center hover:bg-[rgba(255,255,255,0.1)] rounded"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleNode(node.id)
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            ) : (
              <div className="w-4 h-4" />
            )}

            {/* Иконка видимости для элементов */}
            {isElement && (
              <button
                className="w-4 h-4 flex items-center justify-center hover:bg-[rgba(255,255,255,0.1)] rounded"
                onClick={(e) => handleVisibilityToggle(node.id, e)}
                title={isHidden ? 'Показать' : 'Скрыть'}
              >
                {isHidden ? (
                  <EyeOff className="w-3 h-3 text-[#999]" />
                ) : (
                  <Eye className="w-3 h-3 text-[#999]" />
                )}
              </button>
            )}

            {/* Название узла */}
            <span className="flex-1 truncate">{node.name}</span>

            {/* Количество элементов для категорий и семейств */}
            {!isElement && node.elementIds && (
              <span className="text-xs text-[#999]">
                ({node.elementIds.length})
              </span>
            )}
          </div>

          {/* Дети узла */}
          {hasChildren && isExpanded && (
            <div>{node.children!.map((child) => renderNode(child, level + 1))}</div>
          )}
        </div>
      )
    },
    [
      expandedNodes,
      selectedElementIds,
      hiddenElementIds,
      toggleNode,
      handleElementClick,
      handleVisibilityToggle,
    ]
  )

  if (!metadata || !filteredTree) {
    return (
      <div
        className={cn(
          'bg-[rgba(31,41,55,0.6)] backdrop-blur-[10px] rounded-lg border border-[rgba(255,255,255,0.1)] p-4',
          className
        )}
      >
        <p className="text-[#999] text-sm">Нет данных для отображения</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-[rgba(31,41,55,0.6)] backdrop-blur-[10px] rounded-lg border border-[rgba(255,255,255,0.1)] flex flex-col h-full',
        className
      )}
    >
      {/* Заголовок */}
      <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)]">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Дерево элементов
        </h3>
      </div>

      {/* Поиск */}
      <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
          <input
            type="text"
            placeholder="Поиск элементов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-lg text-white text-sm placeholder-[#999] focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>
      </div>

      {/* Дерево */}
      <div className="flex-1 overflow-y-auto">
        {filteredTree.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-[#999] text-sm">Элементы не найдены</p>
          </div>
        ) : (
          <div className="py-2">
            {filteredTree.map((node) => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  )
}

