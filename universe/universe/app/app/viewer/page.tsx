'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Box, Loader2, Upload, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getProjects, getProjectVersions, type Project } from '@/lib/api/projects'
import { getFileUploads } from '@/lib/api/upload'
import { getViewerStatus } from '@/lib/api/viewer'
import type { FileUpload } from '@/lib/types/upload'

export default function ViewerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [findingModel, setFindingModel] = useState(false)

  // Пытаемся найти первую доступную модель с XKT
  useEffect(() => {
    const findFirstModel = async () => {
      try {
        setFindingModel(true)
        
        // Получаем все проекты
        const projects = await getProjects()
        
        // Ищем в каждом проекте модели с XKT
        for (const project of projects) {
          try {
            const versions = await getProjectVersions(project.id)
            
            for (const version of versions) {
              const projectRouteId = project.shortId?.toString() ?? project.id
              const versionRouteId = version.shortId?.toString() ?? version.id
              
              // Получаем файлы для версии
              const files = await getFileUploads(projectRouteId, versionRouteId)
              
              // Ищем RVT или IFC файлы
              const rvtIfcFiles = files.filter(
                (f) => f.fileType === 'RVT' || f.fileType === 'IFC'
              )
              
              // Проверяем каждый файл на наличие XKT
              for (const file of rvtIfcFiles) {
                try {
                  const status = await getViewerStatus(file.id)
                  if (status.has_xkt) {
                    // Нашли модель с XKT - переходим на страницу viewer
                    const modelId = file.modelId || file.id
                    router.push(
                      `/app/datalab/project/${projectRouteId}/version/${versionRouteId}/model/${modelId}/viewer`
                    )
                    return
                  }
                } catch (err: any) {
                  // Игнорируем ошибки авторизации - редирект уже произошел
                  if (err.isAuthRedirect) {
                    return
                  }
                  // Продолжаем проверку других файлов
                }
              }
            }
          } catch (err: any) {
            // Игнорируем ошибки авторизации - редирект уже произошел
            if (err.isAuthRedirect) {
              return
            }
            // Продолжаем проверку других проектов
          }
        }
        
        // Если не нашли модель, показываем пустое состояние
        setLoading(false)
      } catch (err: any) {
        console.error('Ошибка поиска модели с XKT:', err)
        // Игнорируем ошибки авторизации - редирект уже произошел
        if (err.isAuthRedirect) {
          return
        }
        setLoading(false)
      } finally {
        setFindingModel(false)
      }
    }

    findFirstModel()
  }, [router])

  if (loading || findingModel) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <span className="ml-3 text-[#ccc]">Поиск 3D моделей...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gradient mb-2">3D Viewer</h1>
          <p className="text-[#ccc] text-lg">3D визуализация BIM-моделей</p>
        </div>

        {/* Пустое состояние */}
        <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-12 border border-[rgba(255,255,255,0.1)] text-center">
          <Box className="w-16 h-16 mx-auto text-[#999] mb-4" />
          <h2 className="text-2xl font-semibold text-white mb-2">
            Нет доступных 3D моделей
          </h2>
          <p className="text-[#999] text-sm mb-6 max-w-2xl mx-auto">
            Для просмотра 3D моделей загрузите RVT файл через DataLab и выберите опцию "Конвертировать в IFC (3D визуализация)". После завершения конвертации модель будет доступна для просмотра в 3D.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/app/datalab/upload">
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Загрузить файл
              </Button>
            </Link>
            <Link href="/app/datalab">
              <Button variant="outline">
                Перейти в DataLab
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

