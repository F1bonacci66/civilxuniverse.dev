'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GitBranch, Upload, User, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { getProject, getProjectVersions, type Project, type ProjectVersion } from '@/lib/api/projects'

export default function ProjectPage({
  params,
}: {
  params: { projectId: string } | Promise<{ projectId: string }>
}) {
  const router = useRouter()
  const [resolvedParams, setResolvedParams] = useState<{ projectId: string } | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Обрабатываем params как Promise (Next.js 15) или объект (Next.js 14)
  useEffect(() => {
    if (params instanceof Promise) {
      params.then(setResolvedParams)
    } else {
      setResolvedParams(params)
    }
  }, [params])

  useEffect(() => {
    if (!resolvedParams?.projectId) return

    const loadProjectData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Загружаем проект и версии параллельно
        const [projectData, versionsData] = await Promise.all([
          getProject(resolvedParams.projectId),
          getProjectVersions(resolvedParams.projectId).catch(() => []) // Если версий нет, возвращаем пустой массив
        ])
        
        setProject(projectData)
        setVersions(versionsData)
      } catch (err: any) {
        console.error('Ошибка загрузки проекта:', err)
        // Игнорируем ошибки авторизации - редирект уже произошел
        if (err.isAuthRedirect) {
          return
        }
        setError(err.message || 'Не удалось загрузить проект')
      } finally {
        setIsLoading(false)
      }
    }

    loadProjectData()
  }, [resolvedParams])

  if (!resolvedParams || isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <span className="ml-3 text-white">Загрузка проекта...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Ошибка загрузки проекта</h3>
            <p className="text-red-400 mb-6">{error || 'Проект не найден'}</p>
            <Button onClick={() => router.push('/app/datalab')}>
              ← Назад к проектам
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const projectRouteId = project.shortId?.toString() ?? project.id

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href="/app/datalab"
            className="text-primary-500 hover:text-primary-400 text-sm mb-4 inline-block"
          >
            ← Назад к проектам
          </Link>
          <h1 className="text-4xl font-bold text-gradient mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-[#ccc] text-lg">{project.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Версии проекта</h2>
          <Link href={`/app/datalab/upload?projectId=${projectRouteId}`}>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Загрузить в новую версию
            </Button>
          </Link>
        </div>

        {versions.length === 0 ? (
          <div className="text-center py-12">
            <GitBranch className="w-16 h-16 mx-auto text-[#666] mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Нет версий проекта</h3>
            <p className="text-[#999] mb-6">Создайте первую версию, загрузив файл</p>
            <Link href={`/app/datalab/upload?projectId=${projectRouteId}`}>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Загрузить файл
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {versions.map((version) => {
              const versionRouteId = version.shortId?.toString() ?? version.id
              return (
                <Card key={version.id} className="cursor-pointer hover:border-primary-500 transition-colors">
                  <Link href={`/app/datalab/project/${projectRouteId}/version/${versionRouteId}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <GitBranch className="w-6 h-6 text-primary-500" />
                        <div>
                          <CardTitle className="text-xl mb-1">{version.name}</CardTitle>
                          <CardDescription className="text-sm">
                            Версия проекта
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {version.description && (
                        <p className="text-sm text-[#ccc]">{version.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-[#999]">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>Создано</span>
                        </div>
                        <span>
                          {new Date(version.createdAt).toLocaleDateString('ru-RU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  </Link>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
