import { mockProjects } from '@/lib/mock-data'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function generateStaticParams() {
  return mockProjects.flatMap((project) =>
    project.versions.flatMap((version) =>
      version.models.map((model) => ({
        projectId: project.id,
        versionId: version.id,
        modelId: model.id,
      }))
    )
  )
}

export default function ModelChecksPage({
  params,
}: {
  params: { projectId: string; versionId: string; modelId: string }
}) {
  const project = mockProjects.find((p) => p.id === params.projectId)
  const version = project?.versions.find((v) => v.id === params.versionId)
  const model = version?.models.find((m) => m.id === params.modelId)

  if (!project || !version || !model) {
    notFound()
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/app/datalab/project/${params.projectId}/version/${params.versionId}`}
            className="text-primary-500 hover:text-primary-400 text-sm mb-4 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к моделям
          </Link>
          <h1 className="text-4xl font-bold text-gradient mb-2">{model.name}</h1>
          <p className="text-[#ccc] text-lg">
            Проект: {project.name} | Версия: {version.name}
          </p>
        </div>

        <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
          <h2 className="text-2xl font-bold text-white mb-4">Проверки параметров</h2>
          <p className="text-[#999]">
            Здесь будет отображаться список проверок параметров модели. Реализация будет добавлена
            позже.
          </p>
        </div>
      </div>
    </div>
  )
}
