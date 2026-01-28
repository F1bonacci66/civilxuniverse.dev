'use client'

import { useState, useEffect } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, BarChart3, FileBarChart, CheckSquare, Upload, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getProject, getProjectVersion, type Project, type ProjectVersion } from '@/lib/api/projects'

export default function VersionPage({
  params,
}: {
  params: { projectId: string; versionId: string }
}) {
  const [project, setProject] = useState<Project | null>(null)
  const [version, setVersion] = useState<ProjectVersion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [projectData, versionData] = await Promise.all([
          getProject(params.projectId),
          getProjectVersion(params.projectId, params.versionId)
        ])
        setProject(projectData)
        setVersion(versionData)
      } catch (err) {
        console.error('Ошибка загрузки данных проекта/версии:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [params.projectId, params.versionId])

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <span className="ml-3 text-[#ccc]">Загрузка...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!project || !version) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-red-400 text-center py-12">
            <p>Проект или версия не найдены</p>
          </div>
        </div>
      </div>
    )
  }


  const projectRouteId = project.shortId?.toString() ?? project.id
  const versionRouteId = version.shortId?.toString() ?? version.id

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/app/datalab/project/${projectRouteId}`}
            className="text-primary-500 hover:text-primary-400 text-sm mb-4 inline-block"
          >
            ← Назад к версиям проекта
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gradient mb-2">{version.name}</h1>
              <p className="text-[#ccc] text-lg mb-2">
                Проект: {project.name}
              </p>
              {version.description && (
                <p className="text-[#999] text-sm mb-2">{version.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-[#999]">
                <span>
                  Создано: {new Date(version.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Данные версии</h2>
          <Link href="/app/datalab/upload">
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Загрузить файл
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href={`/app/datalab/project/${projectRouteId}/version/${versionRouteId}/data`}>
            <Card className="cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Database className="w-6 h-6 text-primary-500" />
                  <div>
                    <CardTitle className="text-lg">Таблица данных</CardTitle>
                    <CardDescription className="text-sm">Просмотр и фильтрация</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link href={`/app/datalab/project/${projectRouteId}/version/${versionRouteId}/pivot`}>
            <Card className="cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-primary-500" />
                  <div>
                    <CardTitle className="text-lg">Сводный расчет</CardTitle>
                    <CardDescription className="text-sm">Группировки и агрегаты</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link href={`/app/datalab/project/${projectRouteId}/version/${versionRouteId}/reports`}>
            <Card className="cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileBarChart className="w-6 h-6 text-primary-500" />
                  <div>
                    <CardTitle className="text-lg">Отчёты</CardTitle>
                    <CardDescription className="text-sm">Спецификации и экспорт</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link href={`/app/datalab/project/${projectRouteId}/version/${versionRouteId}/checks`}>
            <Card className="cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CheckSquare className="w-6 h-6 text-primary-500" />
                  <div>
                    <CardTitle className="text-lg">Проверки</CardTitle>
                    <CardDescription className="text-sm">Проверка параметров</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
