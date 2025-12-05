import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Health check endpoint для Docker health checks
 * Используется для мониторинга состояния контейнера
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      service: 'civilx-universe',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
}






