import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/auth/auth-provider'

export const metadata: Metadata = {
  title: 'CivilX.Universe - Платформа цифровых сервисов для BIM-анализа',
  description: 'Единое пространство цифровых сервисов для проектировщиков, инженеров и BIM-координаторов',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}



