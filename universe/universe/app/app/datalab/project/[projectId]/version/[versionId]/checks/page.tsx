'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProject, getProjectVersion } from '@/lib/api/projects'

// Примечание: generateStaticParams не может быть использован в 'use client' компонентах
// Для статического экспорта динамические страницы будут генерироваться на клиенте

export default function VersionChecksPage({
  params,
}: {
  params: { projectId: string; versionId: string } | Promise<{ projectId: string; versionId: string }>
}) {
  // Обрабатываем params как Promise (Next.js 15) или объект (Next.js 14)
  const [resolvedParams, setResolvedParams] = useState<{ projectId: string; versionId: string } | null>(null)
  
  useEffect(() => {
    if (params instanceof Promise) {
      params.then(setResolvedParams)
    } else {
      setResolvedParams(params)
    }
  }, [params])
  
  const [projectName, setProjectName] = useState<string>('')
  const [versionName, setVersionName] = useState<string>('')
  
  useEffect(() => {
    if (!resolvedParams) return
    
    const loadNames = async () => {
      try {
        const [project, version] = await Promise.all([
          getProject(resolvedParams.projectId),
          getProjectVersion(resolvedParams.projectId, resolvedParams.versionId)
        ])
        setProjectName(project.name)
        setVersionName(version.name)
      } catch (err) {
        console.error('Ошибка загрузки названий проекта/версии:', err)
      }
    }
    loadNames()
  }, [resolvedParams])
  
  if (!resolvedParams) {
    return <div className="p-8">Загрузка...</div>
  }
  
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/app/datalab/project/${resolvedParams.projectId}/version/${resolvedParams.versionId}`}
            className="text-primary-500 hover:text-primary-400 text-sm mb-4 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к версии
          </Link>
          <h1 className="text-4xl font-bold text-gradient mb-2">Проверки параметров</h1>
          <p className="text-[#ccc] text-lg">
            Проект: <span className="text-white font-semibold">{projectName}</span> | Версия: <span className="text-white font-semibold">{versionName}</span>
          </p>
        </div>

        <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
          <p className="text-[#999]">
            Проверки параметров будут реализованы позже.
          </p>
        </div>
      </div>
    </div>
  )
}

