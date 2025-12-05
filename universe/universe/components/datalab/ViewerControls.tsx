'use client'

import { useState } from 'react'
import { Eye, EyeOff, Focus, X, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewerControlsProps {
  selectedElementIds: string[]
  hiddenElementIds: string[]
  isolatedElementIds: string[] | null
  xrayMode: boolean
  displayMode: 'wireframe' | 'solid' | 'shaded'
  onHide: () => void
  onShow: () => void
  onIsolate: () => void
  onReset: () => void
  onXrayToggle: () => void
  onDisplayModeChange: (mode: 'wireframe' | 'solid' | 'shaded') => void
  onFitToView: () => void
  className?: string
}

export function ViewerControls({
  selectedElementIds,
  hiddenElementIds,
  isolatedElementIds,
  xrayMode,
  displayMode,
  onHide,
  onShow,
  onIsolate,
  onReset,
  onXrayToggle,
  onDisplayModeChange,
  onFitToView,
  className,
}: ViewerControlsProps) {
  const hasSelection = selectedElementIds.length > 0
  const hasHidden = hiddenElementIds.length > 0
  const isIsolated = isolatedElementIds !== null

  return (
    <div
      className={cn(
        'bg-[rgba(31,41,55,0.6)] backdrop-blur-[10px] rounded-lg border border-[rgba(255,255,255,0.1)] p-4 space-y-4',
        className
      )}
    >
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
        Управление
      </h3>

      {/* Кнопки управления видимостью */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onHide}
            disabled={!hasSelection}
            className={cn(
              'flex-1 px-3 py-2 bg-[rgba(55,65,81,0.8)] hover:bg-[rgba(75,85,99,0.8)] disabled:bg-[rgba(55,65,81,0.4)] disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2',
              hasSelection && 'hover:border-[rgba(20,184,166,0.3)]'
            )}
            title="Скрыть выбранные элементы"
          >
            <EyeOff className="w-4 h-4" />
            Скрыть
          </button>
          <button
            onClick={onShow}
            disabled={!hasHidden}
            className={cn(
              'flex-1 px-3 py-2 bg-[rgba(55,65,81,0.8)] hover:bg-[rgba(75,85,99,0.8)] disabled:bg-[rgba(55,65,81,0.4)] disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2',
              hasHidden && 'hover:border-[rgba(20,184,166,0.3)]'
            )}
            title="Показать скрытые элементы"
          >
            <Eye className="w-4 h-4" />
            Показать
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onIsolate}
            disabled={!hasSelection}
            className={cn(
              'flex-1 px-3 py-2 bg-[rgba(55,65,81,0.8)] hover:bg-[rgba(75,85,99,0.8)] disabled:bg-[rgba(55,65,81,0.4)] disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2',
              hasSelection && 'hover:border-[rgba(20,184,166,0.3)]'
            )}
            title="Изолировать выбранные элементы"
          >
            <Focus className="w-4 h-4" />
            Изолировать
          </button>
          <button
            onClick={onReset}
            disabled={!hasHidden && !isIsolated}
            className={cn(
              'flex-1 px-3 py-2 bg-[rgba(55,65,81,0.8)] hover:bg-[rgba(75,85,99,0.8)] disabled:bg-[rgba(55,65,81,0.4)] disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2',
              (hasHidden || isIsolated) && 'hover:border-[rgba(20,184,166,0.3)]'
            )}
            title="Сбросить видимость"
          >
            <X className="w-4 h-4" />
            Сбросить
          </button>
        </div>
      </div>

      {/* Режим X-ray */}
      <div className="pt-2 border-t border-[rgba(255,255,255,0.1)]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={xrayMode}
            onChange={onXrayToggle}
            className="w-4 h-4 rounded border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.3)] text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
          />
          <span className="text-sm text-white">X-ray режим</span>
        </label>
      </div>

      {/* Режимы отображения */}
      <div className="pt-2 border-t border-[rgba(255,255,255,0.1)]">
        <p className="text-xs text-[#999] uppercase tracking-wider mb-2">
          Режим отображения
        </p>
        <div className="flex gap-2">
          {(['wireframe', 'solid', 'shaded'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onDisplayModeChange(mode)}
              className={cn(
                'flex-1 px-3 py-2 text-xs font-medium rounded transition-colors',
                displayMode === mode
                  ? 'bg-primary-500 text-white'
                  : 'bg-[rgba(55,65,81,0.8)] hover:bg-[rgba(75,85,99,0.8)] text-[#ccc]'
              )}
            >
              {mode === 'wireframe'
                ? 'Каркас'
                : mode === 'solid'
                ? 'Сплошной'
                : 'Тени'}
            </button>
          ))}
        </div>
      </div>

      {/* Кнопка Fit to View */}
      <div className="pt-2 border-t border-[rgba(255,255,255,0.1)]">
        <button
          onClick={onFitToView}
          className="w-full px-3 py-2 bg-[rgba(55,65,81,0.8)] hover:bg-[rgba(75,85,99,0.8)] hover:border-[rgba(20,184,166,0.3)] text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
          title="Подогнать модель под экран"
        >
          <Layers className="w-4 h-4" />
          Подогнать под экран
        </button>
      </div>
    </div>
  )
}

