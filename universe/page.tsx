'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Upload,
  Folder,
  GitBranch,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { getProjects, getProjectVersions, type Project, type ProjectVersion } from '@/lib/api/projects'
import { Button } from '@/components/ui/button'
import { useFileUpload } from '@/lib/hooks/useFileUpload'
import type { UploadProgress } from '@/lib/types/upload'
import { cn } from '@/lib/utils'
import { uploadFilesWithConcurrencyLimit } from '@/lib/utils/parallelUpload'
import { ConversionStatusList } from '@/components/datalab/ConversionStatusList'

interface FileItem {
  id: string
  file: File
  progress?: UploadProgress
}

export default function UploadPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Состояние для проектов и версий
  const [projects, setProjects] = useState<Project[]>([])
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadingAll, setIsUploadingAll] = useState(false)
  
  // Ref для предотвращения повторных вызовов
  const isLoadingProjectsRef = useRef(false)

  const loadProjects = useCallback(async () => {
    // Предотвращаем повторные вызовы
    if (isLoadingProjectsRef.current) {
      return
    }
    
    try {
      isLoadingProjectsRef.current = true
      setIsLoadingProjects(true)
      setError(null)
      const projectsData = await getProjects()
      setProjects(projectsData)
    } catch (err: any) {
      console.error('Ошибка загрузки проектов:', err)
      // Игнорируем ошибки авторизации - редирект уже произошел
      if (err.isAuthRedirect) {
        return
      }
      setError(err.message || 'Не удалось загрузить проекты')
    } finally {
      setIsLoadingProjects(false)
      isLoadingProjectsRef.current = false
    }
  }, [])

  const loadVersions = useCallback(async (projectId: string) => {
    try {
      setIsLoadingVersions(true)
      setError(null)
      const versionsData = await getProjectVersions(projectId)
      setVersions(versionsData)
      // Сбрасываем выбранную версию, если она больше не существует в новом списке версий
      setSelectedVersionId((currentVersionId) => {
        if (currentVersionId && !versionsData.find((v) => v.id === currentVersionId)) {
          return ''
        }
        return currentVersionId
      })
    } catch (err: any) {
      console.error('Ошибка загрузки версий:', err)
      // Игнорируем ошибки авторизации - редирект уже произошел
      if (err.isAuthRedirect) {
        return
      }
      setError(err.message || 'Не удалось загрузить версии проекта')
      setVersions([])
    } finally {
      setIsLoadingVersions(false)
    }
  }, [])

  // Загружаем проекты при монтировании компонента
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Загружаем версии при выборе проекта
  useEffect(() => {
    if (selectedProjectId) {
      loadVersions(selectedProjectId)
    } else {
      setVersions([])
      setSelectedVersionId('')
    }
  }, [selectedProjectId, loadVersions])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const selectedVersion = versions.find((v) => v.id === selectedVersionId)

  const { upload, isUploading, uploadProgress, error: uploadError } = useFileUpload({
    onProgress: (progress) => {
      // Обновляем прогресс для соответствующего файла
      setFiles((prev) =>
        prev.map((f) =>
          f.id === progress.fileUploadId || f.progress?.fileUploadId === progress.fileUploadId
            ? { ...f, progress }
            : f
        )
      )
    },
    onComplete: (result) => {
      console.log('Файл загружен:', result)
    },
    onError: (err) => {
      console.error('Ошибка загрузки:', err)
    },
  })

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles || selectedFiles.length === 0) return

      const newFiles: FileItem[] = Array.from(selectedFiles).map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
      }))

      setFiles((prev) => [...prev, ...newFiles])
    },
    []
  )

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (!selectedProjectId || !selectedVersionId) {
        return
      }

      handleFileSelect(e.dataTransfer.files)
    },
    [selectedProjectId, selectedVersionId, handleFileSelect]
  )

  const handleUpload = async (fileItem: FileItem) => {
    const canUploadNow = selectedProjectId && selectedVersionId && files.length > 0
    console.log('handleUpload вызван:', {
      fileItem: fileItem.file.name,
      selectedProjectId,
      selectedVersionId,
      canUpload: canUploadNow,
    })

    if (!selectedProjectId || !selectedVersionId) {
      console.warn('Проект или версия не выбраны:', {
        selectedProjectId,
        selectedVersionId,
      })
      alert('Пожалуйста, выберите проект и версию перед загрузкой файла')
      return
    }

    const versionIdToUse = selectedVersionId

    const fileName = fileItem.file.name.toLowerCase()
    const shouldAutoConvert = fileName.endsWith('.rvt') || fileName.endsWith('.ifc')
    
    console.log('Начинаем загрузку файла:', {
      fileName: fileItem.file.name,
      projectId: selectedProjectId,
      versionId: versionIdToUse,
      autoConvert: shouldAutoConvert,
    })

    try {
      // Получаем названия проекта и версии для читаемых путей
      const project = projects.find((p) => p.id === selectedProjectId)
      const version = versions.find((v) => v.id === versionIdToUse)
      
      const result = await upload({
        projectId: selectedProjectId,
        versionId: versionIdToUse,
        projectName: project?.name,  // Передаем название проекта
        versionName: version?.name,  // Передаем название версии
        file: fileItem.file,
        autoConvert: shouldAutoConvert, // автоматически конвертировать RVT и IFC
      })
      console.log('Загрузка завершена успешно:', result)
    } catch (err) {
      console.error('Ошибка при загрузке файла:', err)
      alert(`Ошибка загрузки: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleUploadAll = async () => {
    if (!selectedProjectId || !selectedVersionId) {
      alert('Пожалуйста, выберите проект и версию перед загрузкой файлов')
      return
    }

    // Получаем файлы, которые нужно загрузить
    const filesToUpload = files.filter(
      (f) => !f.progress || f.progress.uploadStatus === 'pending'
    )

    if (filesToUpload.length === 0) {
      return
    }

    console.log('📤 [handleUploadAll] Начинаем загрузку файлов:', {
      filesCount: filesToUpload.length,
    })

    setIsUploadingAll(true)
    setError(null)

    try {
      const versionIdToUse = selectedVersionId

      const project = projects.find((p) => p.id === selectedProjectId)
      const version = versions.find((v) => v.id === versionIdToUse)

      // Подготавливаем данные для параллельной загрузки
      const uploadRequests = filesToUpload.map((fileItem) => {
        const fileName = fileItem.file.name.toLowerCase()
        const shouldAutoConvert = fileName.endsWith('.rvt') || fileName.endsWith('.ifc')

        return {
          id: fileItem.id,
          file: fileItem.file,
          request: {
            projectId: selectedProjectId,
            versionId: versionIdToUse,
            projectName: project?.name,
            versionName: version?.name,
            autoConvert: shouldAutoConvert,
          } as Omit<Parameters<typeof uploadFilesWithConcurrencyLimit>[0][0]['request'], 'file'>,
        }
      })

      // Запускаем параллельную загрузку с лимитом 3 файла одновременно
      // и сортировкой по размеру (сначала маленькие)
      const results = await uploadFilesWithConcurrencyLimit(uploadRequests, {
        concurrency: 3,
        sortBySize: true,
        pollInterval: 2000,
        onFileProgress: (fileId, progress) => {
          // Обновляем прогресс для соответствующего файла
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId || f.progress?.fileUploadId === progress.fileUploadId
                ? { ...f, progress }
                : f
            )
          )
        },
        onFileComplete: (fileId, result) => {
          console.log(`✅ Файл ${fileId} загружен успешно:`, result)
        },
        onFileError: (fileId, error) => {
          console.error(`❌ Ошибка загрузки файла ${fileId}:`, error)
          // Обновляем статус файла с ошибкой
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    progress: {
                      ...(f.progress || {
                        fileUploadId: 'error',
                        uploadStatus: 'pending' as any,
                        uploadProgress: 0,
                        conversionStatus: undefined,
                        conversionProgress: 0,
                      }),
                      uploadStatus: 'failed' as any,
                      errorMessage: error.message,
                    },
                  }
                : f
            )
          )
        },
      })

      // Подсчитываем результаты
      const successCount = Array.from(results.values()).filter((r) => r.success).length
      const errorCount = Array.from(results.values()).filter((r) => !r.success).length

      if (errorCount > 0) {
        setError(
          `Загружено успешно: ${successCount}, ошибок: ${errorCount}. Проверьте статус файлов в списке.`
        )
      } else {
        console.log(`✅ Все файлы загружены успешно (${successCount} шт.)`)
      }
    } catch (err) {
      console.error('Ошибка при параллельной загрузке файлов:', err)
      setError(
        `Ошибка загрузки: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setIsUploadingAll(false)
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' Б'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
  }

  const getStatusIcon = (progress?: UploadProgress) => {
    if (!progress) return null

    if (progress.uploadStatus === 'completed') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />
    }
    if (progress.uploadStatus === 'failed') {
      return <AlertCircle className="w-5 h-5 text-red-500" />
    }
    if (progress.uploadStatus === 'uploading' || progress.conversionStatus === 'processing') {
      return <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
    }
    return null
  }

  const getStatusText = (progress?: UploadProgress) => {
    if (!progress) return 'Ожидает загрузки'

    if (progress.uploadStatus === 'uploading') {
      return `Загрузка... ${progress.uploadProgress}%`
    }
    if (progress.uploadStatus === 'completed') {
      if (progress.conversionStatus === 'processing') {
        return `Конвертация... ${progress.conversionProgress || 0}%`
      }
      if (progress.conversionStatus === 'completed') {
        return 'Готово'
      }
      if (progress.conversionStatus === 'failed') {
        return 'Ошибка конвертации'
      }
      return 'Загружено'
    }
    if (progress.uploadStatus === 'failed') {
      return 'Ошибка загрузки'
    }
    return 'Ожидает загрузки'
  }

  const canUpload = selectedProjectId && selectedVersionId && files.length > 0
  const filesToUpload = files.filter(
    (f) => !f.progress || f.progress.uploadStatus === 'pending'
  )
  const hasFilesToUpload = filesToUpload.length > 0
  const monitorVersionId = selectedVersionId || undefined
  const monitorProjectId = selectedProjectId || undefined

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href="/app/datalab"
            className="text-primary-500 hover:text-primary-400 text-sm mb-4 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к DataLab
          </Link>
          <h1 className="text-4xl font-bold text-gradient mb-2">Загрузка файлов</h1>
          <p className="text-[#ccc] text-lg">
            Загрузите Revit файлы для анализа
          </p>
        </div>

        {/* Выбор проекта и версии */}
        <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)] mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Выберите проект и версию</h2>
          
          {/* Ошибка загрузки */}
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="w-5 h-5" />
                <p className="font-medium">Ошибка загрузки данных</p>
              </div>
              <p className="text-sm text-red-400 mt-1">{error}</p>
              <Button
                onClick={() => {
                  if (selectedProjectId) {
                    loadVersions(selectedProjectId)
                  } else {
                    loadProjects()
                  }
                }}
                className="mt-2 h-8 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Обновить
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#ccc] mb-2">
                <Folder className="w-4 h-4 inline mr-2" />
                Проект
              </label>
              <div className="relative">
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value)
                    setSelectedVersionId('') // Сбрасываем выбор версии при смене проекта
                  }}
                  disabled={isLoadingProjects}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {isLoadingProjects ? 'Загрузка проектов...' : 'Выберите проект'}
                  </option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {isLoadingProjects && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#ccc] mb-2">
                <GitBranch className="w-4 h-4 inline mr-2" />
                Версия
              </label>
              <div className="relative">
                <select
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  disabled={!selectedProjectId || isLoadingVersions}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedProjectId 
                      ? 'Сначала выберите проект' 
                      : isLoadingVersions 
                        ? 'Загрузка версий...' 
                        : 'Выберите версию'}
                  </option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
                </select>
                {isLoadingVersions && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                  </div>
                )}
              </div>
            </div>
          </div>
          {!selectedProjectId && !isLoadingProjects && projects.length === 0 && (
            <p className="text-sm text-[#999] mt-4">
              Проекты не найдены. Создайте проект, чтобы начать загрузку файлов.
            </p>
          )}
          {selectedProjectId && !isLoadingVersions && versions.length === 0 && (
            <p className="text-sm text-[#999] mt-4">
              У этого проекта пока нет версий.
            </p>
          )}
        </div>

        {/* Область загрузки */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-12 border-2 border-dashed transition-all duration-200',
            isDragging
              ? 'border-primary-500 bg-[rgba(20,184,166,0.1)]'
              : 'border-[rgba(255,255,255,0.2)] border-primary-500/30',
            !selectedProjectId || !selectedVersionId
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer'
          )}
          onClick={() => {
            if (!selectedProjectId || !selectedVersionId) return
            fileInputRef.current?.click()
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".rvt,.ifc,.csv"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="text-center">
            <Upload
              className={cn(
                'w-16 h-16 mx-auto mb-6 transition-colors',
                isDragging ? 'text-primary-500' : 'text-primary-500/70'
              )}
            />
            <h2 className="text-2xl font-bold text-white mb-4">
              {isDragging ? 'Отпустите для загрузки' : 'Перетащите файлы сюда'}
            </h2>
            <p className="text-[#999] mb-6">или выберите файлы для загрузки</p>
            <Button
              disabled={!selectedProjectId || !selectedVersionId}
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              className="inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed bg-primary-gradient text-black hover:bg-primary-gradient-hover shadow-[0_4px_15px_rgba(20,184,166,0.3)] hover:shadow-[0_8px_25px_rgba(20,184,166,0.4)] hover:-translate-y-[3px] active:translate-y-[-1px] shine-effect h-12 px-8 py-3"
            >
              Выбрать файлы
            </Button>
            <p className="text-sm text-[#999] mt-4">
              Поддерживаемые форматы: .rvt
            </p>
            {selectedProjectId && selectedVersionId && (
              <p className="text-sm text-primary-500 mt-2">
                Файлы будут загружены в проект "{selectedProject?.name}" версия "
                {selectedVersion?.name || 'неизвестная версия'}
                "
              </p>
            )}
          </div>
        </div>

        {/* Список выбранных файлов */}
        {files.length > 0 && (
          <div className="mt-6 bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Выбранные файлы ({files.length})</h2>
              {hasFilesToUpload && canUpload && (
                <Button
                  onClick={handleUploadAll}
                  disabled={isUploading || isUploadingAll}
                  className="inline-flex items-center gap-2 rounded-xl font-semibold transition-all duration-300 bg-primary-gradient text-black hover:bg-primary-gradient-hover shadow-[0_4px_15px_rgba(20,184,166,0.3)] hover:shadow-[0_8px_25px_rgba(20,184,166,0.4)] h-10 px-6"
                >
                  {isUploading || isUploadingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Загрузка... ({files.filter((f) => f.progress?.uploadStatus === 'uploading' || f.progress?.conversionStatus === 'processing').length}/{files.length})
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Загрузить все ({filesToUpload.length})
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {files.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="bg-[rgba(255,255,255,0.05)] rounded-lg p-4 border border-[rgba(255,255,255,0.1)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium truncate">{fileItem.file.name}</p>
                          {getStatusIcon(fileItem.progress)}
                        </div>
                        <p className="text-sm text-[#999] mb-2">
                          {formatFileSize(fileItem.file.size)}
                        </p>
                        <p className="text-sm text-[#ccc]">{getStatusText(fileItem.progress)}</p>
                        {/* Прогресс-бар загрузки */}
                        {fileItem.progress?.uploadStatus === 'uploading' && (
                          <div className="mt-2 w-full bg-[rgba(255,255,255,0.1)] rounded-full h-2">
                            <div
                              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${fileItem.progress.uploadProgress || 0}%` }}
                            />
                          </div>
                        )}
                        {/* Прогресс-бар конвертации */}
                        {fileItem.progress?.conversionStatus === 'processing' && (
                          <div className="mt-2 w-full bg-[rgba(255,255,255,0.1)] rounded-full h-2">
                            <div
                              className="bg-primary-400 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${fileItem.progress.conversionProgress || 0}%` }}
                            />
                          </div>
                        )}
                        {/* Ошибка */}
                        {fileItem.progress?.errorMessage && (
                          <p className="text-sm text-red-500 mt-2">
                            {fileItem.progress.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(!fileItem.progress || fileItem.progress.uploadStatus === 'pending') && (
                        <Button
                          onClick={() => handleUpload(fileItem)}
                          disabled={!canUpload || isUploading}
                          className="rounded-lg h-8 px-4 bg-primary-gradient text-black hover:bg-primary-gradient-hover text-sm"
                        >
                          Загрузить
                        </Button>
                      )}
                      <button
                        onClick={() => removeFile(fileItem.id)}
                        className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors"
                        disabled={
                          fileItem.progress?.uploadStatus === 'uploading' ||
                          fileItem.progress?.conversionStatus === 'processing'
                        }
                      >
                        <X className="w-4 h-4 text-[#999]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ошибка загрузки файла */}
        {uploadError && (
          <div className="mt-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">Ошибка загрузки файла</p>
            </div>
            <p className="text-sm text-red-400 mt-1">{uploadError.message}</p>
          </div>
        )}

        {monitorProjectId && (
          <div className="mt-8">
            <ConversionStatusList
              projectId={monitorProjectId}
              versionId={monitorVersionId}
              pollInterval={4000}
              limit={25}
              title="Мониторинг конвертации проекта"
            />
          </div>
        )}
      </div>
    </div>
  )
}

