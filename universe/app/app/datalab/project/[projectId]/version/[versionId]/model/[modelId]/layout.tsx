import { ReactNode } from 'react'

export default function ModelLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { projectId: string; versionId: string; modelId: string }
}) {
  return <>{children}</>
}






