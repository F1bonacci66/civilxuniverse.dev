import { UniverseLayout } from '@/components/universe/universe-layout'

export default function DataLabLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <UniverseLayout currentApp="datalab">{children}</UniverseLayout>
}






