import { redirect } from 'next/navigation'
import { mockProjects } from '@/lib/mock-data'

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

export default function ModelPage({
  params,
}: {
  params: { projectId: string; versionId: string; modelId: string }
}) {
  redirect(
    `/app/datalab/project/${params.projectId}/version/${params.versionId}/model/${params.modelId}/data`
  )
}
