'use client'

import { usePathname } from 'next/navigation'
import { GlobalHeader } from './global-header'
import { Sidebar } from './sidebar'
import { ToastContainer } from '@/components/ui/toast'

interface UniverseLayoutProps {
  children: React.ReactNode
  currentApp?: 'datalab'
}

export function UniverseLayout({
  children,
  currentApp: propCurrentApp,
}: UniverseLayoutProps) {
  const pathname = usePathname()

  // Автоматически определяем currentApp на основе pathname, если не передан явно
  let currentApp = propCurrentApp || 'datalab'
  if (pathname.startsWith('/app/datalab')) {
    currentApp = 'datalab'
  }

  // Извлекаем projectId и versionId из пути
  const pathSegments = pathname.split('/')
  const projectIndex = pathSegments.indexOf('project')
  const versionIndex = pathSegments.indexOf('version')
  
  const projectId = projectIndex !== -1 && pathSegments[projectIndex + 1] 
    ? pathSegments[projectIndex + 1] 
    : undefined
  
  const versionId = versionIndex !== -1 && pathSegments[versionIndex + 1] 
    ? pathSegments[versionIndex + 1] 
    : undefined

  return (
    <div className="min-h-screen bg-body-gradient">
      <GlobalHeader currentApp={currentApp} />
      <Sidebar projectId={projectId} versionId={versionId} currentApp={currentApp} />
      <main className="ml-64 pt-16 min-h-screen">
        {children}
      </main>
      <ToastContainer />
    </div>
  )
}
