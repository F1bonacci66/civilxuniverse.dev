'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Folder, Plus, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getProjects, getProjectVersions, type Project } from '@/lib/api/projects'

export default function DataLabPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsWithVersions, setProjectsWithVersions] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const projectsData = await getProjects()
      setProjects(projectsData)

      // Загружаем количество версий для каждого проекта
      const versionsCount: Record<string, number> = {}
      await Promise.all(
        projectsData.map(async (project) => {
          try {
            const versions = await getProjectVersions(project.id)
            versionsCount[project.id] = versions.length
          } catch (err) {
            console.error(`Ошибка загрузки версий проекта ${project.id}:`, err)
            versionsCount[project.id] = 0
          }
        })
      )
      setProjectsWithVersions(versionsCount)
    } catch (err: any) {
      console.error('Ошибка загрузки проектов:', err)
      // Игнорируем ошибки авторизации - редирект уже произошел
      if (err.isAuthRedirect) {
        return
      }
      setError(err.message || 'Не удалось загрузить проекты')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('ru-RU')
    } catch {
      return dateString
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gradient mb-2">DataLab</h1>
            <p className="text-[#ccc] text-lg">Анализ и визуализация данных</p>
          </div>
          <Button onClick={() => router.push('/app/datalab/upload')}>
            <Plus className="w-4 h-4 mr-2" />
            Новый проект
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <span className="ml-3 text-[#ccc]">Загрузка проектов...</span>
          </div>
        ) : error ? (
          <div className="text-red-400 text-center py-12">
            <p>{error}</p>
            <Button onClick={loadProjects} className="mt-4">
              Попробовать снова
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="w-16 h-16 mx-auto text-[#666] mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Нет проектов</h3>
            <p className="text-[#999] mb-6">Создайте первый проект, чтобы начать работу</p>
            <Button onClick={() => router.push('/app/datalab/upload')}>
              <Plus className="w-4 h-4 mr-2" />
              Создать проект
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const projectRouteId = project.shortId?.toString() ?? project.id
              return (
            <Card
              key={project.id}
              className="hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:border-[rgba(20,184,166,0.3)] before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-[rgba(20,184,166,0.1)] before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 cursor-pointer"
            >
              <Link href={`/app/datalab/project/${projectRouteId}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Folder className="w-6 h-6 text-primary-500" />
                      <div>
                        <CardTitle className="text-xl mb-1">{project.name}</CardTitle>
                        {project.description && (
                          <CardDescription className="text-sm mt-1">
                            {project.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-[#999]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>
                        {projectsWithVersions[project.id] ?? 0}{' '}
                        {projectsWithVersions[project.id] === 1 ? 'версия' : 'версий'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.1)]">
                    <div className="text-xs text-[#999]">
                      Создан: {formatDate(project.createdAt)}
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

