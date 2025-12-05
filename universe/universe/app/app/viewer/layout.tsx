import { UniverseLayout } from '@/components/universe/universe-layout'

export default function ViewerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <UniverseLayout currentApp="viewer">{children}</UniverseLayout>
}

