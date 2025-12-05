'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { Viewer3D } from '@/components/datalab/Viewer3D'
import { getFileUploads } from '@/lib/api/upload'
import { getViewerStatus } from '@/lib/api/viewer'
import type { FileUpload } from '@/lib/types/upload'
import { getProject, getProjectVersion } from '@/lib/api/projects'

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

  return (
    <div className="p-8">
      <div className="max-w-[1920px] mx-auto">
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
          <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg border border-[rgba(255,255,255,0.1)] overflow-hidden">
            <div className="h-[calc(100vh-250px)] min-h-[600px]">
              <Viewer3D fileUploadId={fileUpload.id} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

