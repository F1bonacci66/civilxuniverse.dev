'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProject, getProjectVersion } from '@/lib/api/projects'

export default function VersionReportsPage({
  params,
}: {
  params: { projectId: string; versionId: string }
}) {
  const [projectName, setProjectName] = useState<string>(params.projectId)
  const [versionName, setVersionName] = useState<string>(params.versionId)
  
  useEffect(() => {
    const loadNames = async () => {
      try {
        const [project, version] = await Promise.all([
          getProject(params.projectId),
          getProjectVersion(params.projectId, params.versionId)
        ])
        setProjectName(project.name)
        setVersionName(version.name)
      } catch (err) {
        console.error('Ошибка загрузки названий проекта/версии:', err)
      }
    }
    loadNames()
  }, [params.projectId, params.versionId])
  
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/app/datalab/project/${params.projectId}/version/${params.versionId}`}
            className="text-primary-500 hover:text-primary-400 text-sm mb-4 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к версии
          </Link>
          <h1 className="text-4xl font-bold text-gradient mb-2">Отчёты / Спецификации</h1>
          <p className="text-[#ccc] text-lg">
            Проект: <span className="text-white font-semibold">{projectName}</span> | Версия: <span className="text-white font-semibold">{versionName}</span>
          </p>
        </div>

        <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
          <p className="text-[#999]">
            Отчёты и спецификации будут реализованы позже.
          </p>
        </div>
      </div>
    </div>
  )
}

