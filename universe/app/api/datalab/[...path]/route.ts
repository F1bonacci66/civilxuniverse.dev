import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const getBackendBaseUrl = () => {
  const internalUrl = process.env.INTERNAL_API_URL
  const publicUrl = process.env.NEXT_PUBLIC_API_URL

  // Логируем для отладки
  console.log('[Proxy] getBackendBaseUrl:', {
    INTERNAL_API_URL: internalUrl,
    NEXT_PUBLIC_API_URL: publicUrl,
    DOCKER_CONTAINER: process.env.DOCKER_CONTAINER,
    NODE_ENV: process.env.NODE_ENV,
  })

  let base =
    internalUrl ||
    (publicUrl && publicUrl.startsWith('http') ? publicUrl : '') ||
    ''

  if (!base || base.startsWith('/')) {
    const isDocker = process.env.DOCKER_CONTAINER === 'true'
    const defaultHost =
      process.env.NODE_ENV === 'production' || isDocker
        ? 'http://172.17.0.1:8000/api/datalab'
        : 'http://localhost:8000/api/datalab'
    base = defaultHost
  }

  const result = base.replace(/\/$/, '')
  console.log('[Proxy] Используется BACKEND_BASE_URL:', result)
  return result
}

type RouteParams = {
  params: {
    path?: string[]
  }
}

async function proxyRequest(request: NextRequest, { params }: RouteParams) {
  // Логируем все запросы для отладки
  let segmentedPath = (params.path?.join('/') ?? '').replace(/\/$/, '')
  
  // КРИТИЧНО: Для DELETE запросов убираем trailing slash из pathname, если Next.js добавил его
  // Это предотвращает редирект 308, который браузеры не обрабатывают для DELETE
  if (request.method === 'DELETE' && request.nextUrl.pathname.endsWith('/')) {
    // Убираем trailing slash из pathname для DELETE запросов
    const pathWithoutSlash = request.nextUrl.pathname.replace(/\/$/, '')
    // Пересоздаем URL без trailing slash
    const newUrl = new URL(pathWithoutSlash + request.nextUrl.search, request.url)
    // Обновляем segmentedPath на основе нового URL
    const pathParts = pathWithoutSlash.replace('/api/datalab/', '').split('/').filter(Boolean)
    segmentedPath = pathParts.join('/')
    console.log(`[Proxy] DELETE запрос: убран trailing slash из pathname`, {
      originalPath: request.nextUrl.pathname,
      newPath: pathWithoutSlash,
      segmentedPath,
    })
  }
  
  console.log(`[Proxy] ${request.method} запрос:`, {
    method: request.method,
    path: request.nextUrl.pathname,
    segmentedPath,
    query: request.nextUrl.search,
    hasBody: !!request.body,
  })
  
  // Вычисляем BACKEND_BASE_URL каждый раз (на случай изменения переменных окружения)
  const BACKEND_BASE_URL = getBackendBaseUrl()
  
  // Убираем trailing slash из segmentedPath (Next.js может добавлять его из-за trailingSlash: true)
  const queryString = request.nextUrl.search
  const targetUrl = `${BACKEND_BASE_URL}${segmentedPath ? `/${segmentedPath}` : ''}${queryString}`
  
  console.log(`[Proxy] Проксируем на: ${targetUrl}`)

  const backendHeaders = new Headers()
  // Для endpoints авторизации (login, register, signup) не копируем заголовок Authorization
  // чтобы избежать проблем с невалидными токенами
  const isAuthEndpoint = segmentedPath.startsWith('auth/login') || 
                         segmentedPath.startsWith('auth/register') || 
                         segmentedPath.startsWith('auth/signup')
  
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    // Пропускаем служебные заголовки
    if (['host', 'content-length', 'connection'].includes(lowerKey)) {
      return
    }
    // Для endpoints авторизации не копируем Authorization заголовок
    if (isAuthEndpoint && lowerKey === 'authorization') {
      return
    }
    backendHeaders.set(key, value)
  })

  const init: RequestInit = {
    method: request.method,
    headers: backendHeaders,
    cache: 'no-store',
    redirect: 'manual',
  }

  // Для POST/PUT/PATCH/DELETE запросов с body используем duplex: 'half'
  // keepalive не используется, так как может вызывать проблемы с POST запросами
  const hasBody = !['GET', 'HEAD'].includes(request.method) && request.body
  if (hasBody) {
    init.body = request.body as any
    ;(init as any).duplex = 'half'
  }

  try {
    // Добавляем таймаут для запросов
    // Определяем таймаут в зависимости от типа endpoint
    let timeoutMs = 30000 // По умолчанию 30 секунд (увеличено с 10)
    
    // Для queue/status увеличиваем таймаут до 60 секунд (проверка Windows сервера и БД может занимать время)
    if (segmentedPath === 'conversion/queue/status') {
      timeoutMs = 60000
    }
    // Для viewer endpoints увеличиваем таймаут до 180 секунд (загрузка больших XKT файлов и metadata может занимать много времени)
    else if (segmentedPath.startsWith('viewer/')) {
      // Для XKT файлов нужен больший таймаут
      if (segmentedPath.endsWith('/xkt')) {
        timeoutMs = 180000 // 180 секунд для больших XKT файлов
      } else {
        timeoutMs = 120000 // 120 секунд для остальных viewer endpoints (status, metadata, groups)
      }
    }
    // Для медленных endpoints увеличиваем таймаут до 120 секунд (запросы могут быть медленными на больших данных)
    else if (segmentedPath.startsWith('pivot/') || 
             segmentedPath === 'pivot' ||
             segmentedPath === 'data' ||
             segmentedPath.startsWith('data/') ||
             segmentedPath.startsWith('conversion/project/') ||
             segmentedPath === 'projects' ||
             segmentedPath.startsWith('projects/')) {
      timeoutMs = 120000 // 120 секунд для медленных запросов (увеличено с 60)
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    // Используем fetch с увеличенными таймаутами
    // keepalive не используется, так как может вызывать проблемы с POST запросами
    const fetchOptions: RequestInit = {
      ...init,
      signal: controller.signal,
    }

    const backendResponse = await fetch(targetUrl, fetchOptions)

    clearTimeout(timeoutId)

    const responseHeaders = new Headers(backendResponse.headers)
    responseHeaders.delete('transfer-encoding')

    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    })
  } catch (error: any) {
    console.error('[Proxy] Ошибка запроса:', {
      targetUrl,
      method: request.method,
      error: error?.message || error,
      errorName: error?.name,
      errorCode: error?.code,
      errorCause: error?.cause,
    })

    // Если это таймаут (AbortError или fetch failed из-за таймаута), возвращаем 504
    if (error?.name === 'AbortError' || 
        error?.message?.includes('aborted') ||
        error?.message?.includes('timeout') ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ECONNABORTED') {
      return NextResponse.json(
        {
          detail: 'Таймаут запроса к backend',
          targetUrl,
        },
        { status: 504 }
      )
    }

    // Если это ошибка подключения (сеть, DNS, недоступен сервер), возвращаем 502
    if (error?.code === 'ECONNREFUSED' ||
        error?.code === 'ENOTFOUND' ||
        error?.code === 'ECONNRESET' ||
        error?.message?.includes('fetch failed') ||
        error?.message?.includes('network')) {
      return NextResponse.json(
        {
          detail: 'Ошибка подключения к backend',
          targetUrl,
          errorCode: error?.code,
        },
        { status: 502 }
      )
    }

    // Для всех остальных ошибок возвращаем 500
    return NextResponse.json(
      {
        detail: 'Внутренняя ошибка прокси',
        targetUrl,
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export {
  proxyRequest as GET,
  proxyRequest as POST,
  proxyRequest as PUT,
  proxyRequest as PATCH,
  proxyRequest as DELETE,
  proxyRequest as OPTIONS,
}


