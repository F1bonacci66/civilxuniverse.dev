'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { DataTable } from '@/components/datalab/DataTable'
import { getFileUploads } from '@/lib/api/upload'
import type { FileUpload } from '@/lib/types/upload'
import { getProject, getProjectVersion } from '@/lib/api/projects'
import { deleteProjectVersionData, type DeleteProjectVersionDataResult } from '@/lib/api/data'
import { ConversionStatusList } from '@/components/datalab/ConversionStatusList'

export default function VersionDataPage({
  params,
}: {
  params: { projectId: string; versionId: string }
}) {
  const [loading, setLoading] = useState(true)
  const [csvFile, setCsvFile] = useState<FileUpload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string>(params.projectId)
  const [versionName, setVersionName] = useState<string>(params.versionId)
  const [projectApiId, setProjectApiId] = useState<string>(params.projectId)
  const [versionApiId, setVersionApiId] = useState<string>(params.versionId)
  const [loadingNames, setLoadingNames] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeletingData, setIsDeletingData] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteSummary, setDeleteSummary] = useState<DeleteProjectVersionDataResult | null>(null)
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null)
  
  // Загружаем названия проекта и версии из API
  useEffect(() => {
    const loadNames = async () => {
      try {
        setLoadingNames(true)
        const [project, version] = await Promise.all([
          getProject(params.projectId),
          getProjectVersion(params.projectId, params.versionId)
        ])
        setProjectName(project.name)
        setVersionName(version.name)
        setProjectApiId(project.id)
        setVersionApiId(version.id)
      } catch (err) {
        console.error('Ошибка загрузки названий проекта/версии:', err)
        // Оставляем UUID если не удалось загрузить
      } finally {
        setLoadingNames(false)
      }
    }
    loadNames()
  }, [params.projectId, params.versionId])

  // Загружаем CSV файлы для этой версии
  useEffect(() => {
    const loadCSVFiles = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔍 Загрузка CSV файлов для:', {
          projectId: params.projectId,
          versionId: params.versionId,
        })
        
        let files = await getFileUploads(params.projectId, params.versionId)
        
        console.log('📁 Полученные файлы для версии:', files)
        
        // Если файлы не найдены для этой версии, пробуем найти все CSV файлы
        if (files.length === 0) {
          console.log('⚠️ Файлы не найдены для этой версии. Пробуем найти все CSV файлы...')
          files = await getFileUploads() // Без фильтров - все файлы
          console.log('📁 Все файлы в системе:', files)
        }
        
        // Берем первый CSV файл
        // Проверяем по типу файла и по расширению
        const csvFiles = files.filter(f => {
          const fileType = f.fileType || (f as any).file_type || ''
          const filename = f.originalFilename || ''
          
          // Проверяем тип файла или расширение
          const isCSV = fileType.toUpperCase() === 'CSV' || 
                       filename.toLowerCase().endsWith('.csv')
          
          return isCSV
        })
        
        console.log('📊 Все файлы с типами:', files.map(f => ({
          id: f.id,
          name: f.originalFilename,
          type: f.fileType || (f as any).file_type,
          projectId: f.projectId || (f as any).project_id,
          versionId: f.versionId || (f as any).version_id,
        })))
        console.log('📊 CSV файлы:', csvFiles)
        
        if (csvFiles.length === 0) {
          console.warn('⚠️ CSV файлы не найдены. Все файлы:', files.map(f => ({ 
            id: f.id, 
            type: f.fileType, 
            name: f.originalFilename,
            projectId: f.projectId,
            versionId: f.versionId,
          })))
        } else {
          // Если нашли CSV файлы, используем первый (или тот, который соответствует версии)
          const matchingFile = csvFiles.find(f => 
            f.versionId === params.versionId || 
            f.projectId === params.projectId
          ) || csvFiles[0]
          
          console.log('✅ Используем CSV файл:', {
            id: matchingFile.id,
            name: matchingFile.originalFilename,
            projectId: matchingFile.projectId,
            versionId: matchingFile.versionId,
          })
          
          setCsvFile(matchingFile)
          return // Выходим, если нашли файл
        }
        
        setCsvFile(null)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки файлов'
        console.error('❌ Error loading CSV files:', err)
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadCSVFiles()
  }, [params.projectId, params.versionId, reloadKey])

  const handleDeleteData = async () => {
    if (isDeletingData) {
      return
    }

    setDeleteStatus(null)
    setDeleteModalError(null)
    setIsDeletingData(true)

    try {
      console.log('🗑️ Запуск удаления данных версии', {
        projectId: params.projectId,
        versionId: params.versionId,
      })

      const result = await deleteProjectVersionData(params.projectId, params.versionId)
      setDeleteSummary(result)

      const details: string[] = []
      if (typeof result.deletedFiles === 'number') {
        details.push(`файлов: ${result.deletedFiles}`)
      }
      if (typeof result.deletedIfcs === 'number') {
        details.push(`IFC: ${result.deletedIfcs}`)
      }
      if (typeof result.deletedCsv === 'number') {
        details.push(`CSV: ${result.deletedCsv}`)
      }
      if (typeof result.deletedRows === 'number') {
        details.push(`строк данных: ${result.deletedRows}`)
      }

      setDeleteStatus({
        type: 'success',
        message:
          result.message ||
          `Все данные версии успешно удалены${details.length ? ` (${details.join(', ')})` : ''}`,
      })

      setCsvFile(null)
      setIsDeleteModalOpen(false)
      setReloadKey((prev) => prev + 1)
    } catch (err: any) {
      console.error('❌ Ошибка удаления данных версии:', err)
      // Игнорируем ошибки авторизации - редирект уже произошел
      if (err.isAuthRedirect) {
        return // Не показываем ошибку, редирект уже выполнен
      }
      setDeleteSummary(null)
      const message = err instanceof Error ? err.message : 'Не удалось удалить данные проекта'
      setDeleteModalError(message)
      setDeleteStatus({
        type: 'error',
        message,
      })
    } finally {
      setIsDeletingData(false)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-[1920px] mx-auto">
        <div className="mb-6">
          <Link
            href={`/app/datalab/project/${params.projectId}/version/${params.versionId}`}
            className="text-primary-500 hover:text-primary-400 text-sm mb-4 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к версии
          </Link>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-bold text-gradient mb-2">Таблица данных</h1>
              <p className="text-[#ccc] text-lg">
                Проект: <span className="text-white font-semibold">{projectName}</span> | Версия: <span className="text-white font-semibold">{versionName}</span>
              </p>
            </div>
            <button
              onClick={() => {
                setDeleteModalError(null)
                setIsDeleteModalOpen(true)
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#ef4444] via-[#dc2626] to-[#b91c1c] shadow-[0_15px_35px_rgba(239,68,68,0.35)] hover:from-[#f87171] hover:via-[#ef4444] hover:to-[#dc2626] transition-all duration-300 border border-red-500/40 shine-effect disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading || isDeletingData}
            >
              <Trash2 className="w-5 h-5" />
              Удалить данные
            </button>
          </div>
        </div>

        {deleteStatus && (
          <div
            className={`mb-6 rounded-2xl border px-5 py-4 backdrop-blur-md ${
              deleteStatus.type === 'success'
                ? 'border-green-500/40 bg-green-500/10'
                : 'border-red-500/40 bg-red-500/10'
            }`}
          >
            <div className="flex items-start gap-3">
              {deleteStatus.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-1" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400 mt-1" />
              )}
              <div>
                <p className="text-sm text-white/90">{deleteStatus.message}</p>
                {deleteStatus.type === 'success' && deleteSummary && (
                  <ul className="mt-3 text-xs text-[#b5b5b5] space-y-1 list-disc list-inside">
                    {typeof deleteSummary.deletedFiles === 'number' && (
                      <li>
                        Удалено файлов: <span className="text-white">{deleteSummary.deletedFiles}</span>
                      </li>
                    )}
                    {typeof deleteSummary.deletedIfcs === 'number' && (
                      <li>
                        Удалено IFC: <span className="text-white">{deleteSummary.deletedIfcs}</span>
                      </li>
                    )}
                    {typeof deleteSummary.deletedCsv === 'number' && (
                      <li>
                        Удалено CSV: <span className="text-white">{deleteSummary.deletedCsv}</span>
                      </li>
                    )}
                    {typeof deleteSummary.deletedRows === 'number' && (
                      <li>
                        Очистка строк таблицы: <span className="text-white">{deleteSummary.deletedRows}</span>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <ConversionStatusList
          projectId={projectApiId}
          versionId={versionApiId}
          pollInterval={4000}
          limit={30}
          className="mb-8"
        />

        {loading ? (
          <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-12 border border-[rgba(255,255,255,0.1)] text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-500" />
            <p className="text-[#999]">Загрузка данных...</p>
          </div>
        ) : error ? (
          <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
            <p className="text-red-400 mb-2">Ошибка загрузки</p>
            <p className="text-[#999] text-sm">{error}</p>
          </div>
        ) : !csvFile ? (
          <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
            <div className="space-y-4">
              <p className="text-[#999]">
                CSV файлы не найдены для версии{' '}
                <span className="text-white font-semibold">{versionName}</span>
              </p>
              <div className="space-y-2">
                <p className="text-sm text-[#ccc]">Возможные причины:</p>
                <ul className="list-disc list-inside text-sm text-[#999] space-y-1 ml-4">
                  <li>Файлы еще не загружены для этой версии</li>
                  <li>Конвертация RVT→IFC→CSV еще не завершена</li>
                  <li>Данные еще не загружены в БД</li>
                </ul>
              </div>
              <div className="pt-4">
                <Link 
                  href="/app/datalab/upload" 
                  className="inline-block px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Загрузить файл
                </Link>
              </div>
              <div className="pt-4 border-t border-[rgba(255,255,255,0.1)]">
                <p className="text-xs text-[#666]">
                  💡 Совет: Проверьте, что вы загружали файл с правильными projectId и versionId
                </p>
              </div>
            </div>
          </div>
        ) : (
          <DataTable
            projectId={params.projectId}
            versionId={params.versionId}
          />
        )}
      </div>
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-red-500/30 bg-[rgba(12,12,12,0.95)] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center gap-3 mb-4 text-red-300">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-xl font-semibold">Подтвердите удаление данных</h3>
            </div>
            <p className="text-[#ccc] text-sm mb-4">
              Действие очистит все выгруженные IFC/CSV файлы и табличные данные проекта{' '}
              <span className="text-white font-semibold">{projectName}</span>, версия{' '}
              <span className="text-white font-semibold">{versionName}</span>. Восстановить данные будет
              невозможно.
            </p>
            <ul className="text-sm text-[#999] space-y-2 mb-6 list-disc list-inside">
              <li>Выбранные IFC модели и преобразованные CSV файлы</li>
              <li>Записи таблицы данных и связанные показатели</li>
              <li>Журналы загрузок и статусы конвертации</li>
            </ul>
            {deleteModalError && (
              <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                {deleteModalError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isDeletingData) return
                  setIsDeleteModalOpen(false)
                }}
                className="px-4 py-2 text-[#bbb] hover:text-white transition-colors"
                disabled={isDeletingData}
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteData}
                className="px-5 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-[#ef4444] via-[#dc2626] to-[#b91c1c] shadow-[0_15px_35px_rgba(239,68,68,0.35)] hover:from-[#f87171] hover:via-[#ef4444] hover:to-[#dc2626] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isDeletingData}
              >
                {isDeletingData ? 'Удаляем...' : 'Удалить данные'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

