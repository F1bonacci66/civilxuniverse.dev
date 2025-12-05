import { UniverseLayout } from '@/components/universe/universe-layout'

export default function ModelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UniverseLayout currentApp="datalab">
      {children}
    </UniverseLayout>
  )
}

