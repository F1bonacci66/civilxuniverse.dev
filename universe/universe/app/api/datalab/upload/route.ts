// Next.js API Route для проксирования запросов загрузки файлов
// Это обходит проблему CORS, так как запрос идет на тот же домен

import { NextRequest, NextResponse } from 'next/server'

// Увеличиваем таймаут для больших файлов
export const maxDuration = 300 // 5 минут
export const runtime = 'nodejs'

// Используем INTERNAL_API_URL из переменных окружения (как в основном route.ts)
// Это обеспечивает правильное подключение к backend в Docker сети
const getBackendBaseUrl = () => {
  const internalUrl = process.env.INTERNAL_API_URL
  const publicUrl = process.env.NEXT_PUBLIC_API_URL

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

  return base.replace(/\/$/, '')
}

// Вычисляем BACKEND_BASE_URL при каждом запросе (на случай изменения переменных окружения)
// Не используем константу, чтобы всегда получать актуальное значение
const getBackendUrl = () => {
  const base = getBackendBaseUrl()
  const url = `${base}/upload`
  console.log('[Upload Route] getBackendUrl:', {
    base,
    url,
    INTERNAL_API_URL: process.env.INTERNAL_API_URL,
    DOCKER_CONTAINER: process.env.DOCKER_CONTAINER,
  })
  return url
}

const getBackendHealthUrl = () => {
  const base = getBackendBaseUrl()
  return `${base.replace('/api/datalab', '')}/health`
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`📥 [${requestId}] Next.js API route: POST /api/datalab/upload получен`)
  
  try {
    // Проверяем подключение к backend перед отправкой (опционально)
    // Убираем проверку, так как она может вызывать проблемы с таймаутом
    // Если backend недоступен, запрос сам упадет с ошибкой
    console.log(`⏭️  [${requestId}] Пропускаем health check, сразу пересылаем запрос`)
    
    // Получаем тело запроса как ArrayBuffer и пересылаем
    console.log(`📥 [${requestId}] Получаем тело запроса...`)
    
    // Получаем Content-Type из оригинального запроса (с boundary!)
    const contentType = request.headers.get('content-type')
    if (!contentType) {
      console.error(`❌ [${requestId}] Content-Type header is missing`)
      return NextResponse.json(
        { detail: 'Content-Type header is missing' },
        { status: 400 }
      )
    }
    
    // Получаем Content-Length для логирования
    const contentLength = request.headers.get('content-length')
    console.log(`📋 [${requestId}] Content-Type: ${contentType.substring(0, 100)}...`)
    console.log(`📋 [${requestId}] Content-Length: ${contentLength} байт`)
    
    // Читаем тело запроса как ArrayBuffer
    console.log(`📥 [${requestId}] Читаем тело запроса как ArrayBuffer...`)
    const body = await request.arrayBuffer()
    console.log(`✅ [${requestId}] Тело запроса получено, размер: ${body.byteLength} байт`)
    
    const BACKEND_URL = getBackendUrl()
    console.log(`📤 [${requestId}] Пересылаем запрос на: ${BACKEND_URL}`)
    console.log(`⏳ [${requestId}] Отправляем запрос на backend...`)
    
    // Добавляем таймаут для fetch
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 120 секунд для больших файлов
    
    try {
      // Отправляем ArrayBuffer напрямую
      const fetchStartTime = Date.now()
      console.log(`⏱️  [${requestId}] Начало fetch запроса к backend в ${new Date().toISOString()}`)
      console.log(`⏱️  [${requestId}] Размер тела: ${body.byteLength} байт (${(body.byteLength / 1024 / 1024).toFixed(2)} MB)`)
      
      // Используем встроенный модуль http Node.js вместо fetch
      // fetch может зависать при отправке больших файлов
      console.log(`⏱️  [${requestId}] Отправляем запрос на backend через http модуль...`)
      
      const http = await import('http')
      const url = new URL(BACKEND_URL)
      
      const backendResponse = await new Promise<{
        statusCode: number
        statusMessage: string
        headers: Record<string, string>
        body: string
      }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(body.byteLength),
            },
            timeout: 120000, // 120 секунд
          },
          (res) => {
            let responseBody = ''
            res.on('data', (chunk) => {
              responseBody += chunk.toString()
            })
            res.on('end', () => {
              resolve({
                statusCode: res.statusCode || 500,
                statusMessage: res.statusMessage || 'Unknown',
                headers: res.headers as Record<string, string>,
                body: responseBody,
              })
            })
          }
        )
        
        req.on('error', (error) => {
          reject(error)
        })
        
        req.on('timeout', () => {
          req.destroy()
          reject(new Error('Request timeout'))
        })
        
        // Конвертируем ArrayBuffer в Buffer для отправки
        const buffer = Buffer.from(body)
        req.write(buffer)
        req.end()
      })
      
      clearTimeout(timeoutId)
      const fetchDuration = Date.now() - fetchStartTime
      console.log(`⏱️  [${requestId}] HTTP запрос завершен за ${fetchDuration}ms`)

      console.log(`📥 [${requestId}] Ответ от backend получен: ${backendResponse.statusCode} ${backendResponse.statusMessage}`)
      
      if (backendResponse.statusCode !== undefined && (backendResponse.statusCode < 200 || backendResponse.statusCode >= 300)) {
        console.error(`❌ [${requestId}] Backend вернул ошибку: ${backendResponse.body}`)
        return NextResponse.json(
          { detail: `Backend error: ${backendResponse.statusCode} ${backendResponse.statusMessage}` },
          { status: backendResponse.statusCode }
        )
      }

      // Получаем ответ
      console.log(`📥 [${requestId}] Читаем JSON ответ от backend...`)
      const data = JSON.parse(backendResponse.body)
      console.log(`✅ [${requestId}] Данные от backend получены, возвращаем клиенту`)

      // Возвращаем ответ с теми же заголовками
      return NextResponse.json(data, {
        status: backendResponse.statusCode || 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        console.error(`❌ [${requestId}] Таймаут при запросе к backend`)
        return NextResponse.json(
          { detail: 'Таймаут при запросе к backend' },
          { status: 504 }
        )
      }
      console.error(`❌ [${requestId}] Ошибка fetch к backend:`, fetchError)
      console.error(`❌ [${requestId}] Stack trace:`, fetchError.stack)
      throw fetchError
    }
  } catch (error: any) {
    console.error(`❌ [${requestId}] Ошибка проксирования запроса:`, error)
    console.error(`❌ [${requestId}] Stack trace:`, error.stack)
    return NextResponse.json(
      { detail: `Ошибка проксирования: ${error.message}` },
      { status: 500 }
    )
  }
}

// GET handler для получения списка файлов
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`📥 [${requestId}] Next.js API route: GET /api/datalab/upload получен`)
  
  try {
    // Получаем query параметры из запроса
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()
    const BACKEND_URL = getBackendUrl()
    const backendUrl = `${BACKEND_URL}${queryString ? `?${queryString}` : ''}`
    
    console.log(`📤 [${requestId}] Проксируем GET запрос на: ${backendUrl}`)
    
    // Проксируем GET запрос к бэкенду
    const http = await import('http')
    const url = new URL(backendUrl)
    
    const backendResponse = await new Promise<{
      statusCode: number
      statusMessage: string
      headers: Record<string, string>
      body: string
    }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method: 'GET',
          timeout: 30000, // 30 секунд
        },
        (res) => {
          let responseBody = ''
          res.on('data', (chunk) => {
            responseBody += chunk.toString()
          })
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 500,
              statusMessage: res.statusMessage || 'Unknown',
              headers: res.headers as Record<string, string>,
              body: responseBody,
            })
          })
        }
      )
      
      req.on('error', (error) => {
        reject(error)
      })
      
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })
      
      req.end()
    })
    
    console.log(`📥 [${requestId}] Ответ от backend: ${backendResponse.statusCode}`)
    
    if (backendResponse.statusCode !== undefined && (backendResponse.statusCode < 200 || backendResponse.statusCode >= 300)) {
      console.error(`❌ [${requestId}] Backend вернул ошибку: ${backendResponse.body}`)
      return NextResponse.json(
        { detail: `Backend error: ${backendResponse.statusCode} ${backendResponse.statusMessage}` },
        { status: backendResponse.statusCode }
      )
    }
    
    // Парсим JSON ответ
    const data = JSON.parse(backendResponse.body)
    console.log(`✅ [${requestId}] Данные получены, возвращаем клиенту`)
    
    return NextResponse.json(data, {
      status: backendResponse.statusCode || 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    console.error(`❌ [${requestId}] Ошибка проксирования GET запроса:`, error)
    return NextResponse.json(
      { detail: `Ошибка проксирования: ${error.message}` },
      { status: 500 }
    )
  }
}

// OPTIONS handler для CORS preflight
export async function OPTIONS(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`🔵 [${requestId}] OPTIONS запрос получен для /api/datalab/upload`)
  const origin = request.headers.get('origin') || '*'
  console.log(`🔵 [${requestId}] Origin: ${origin}`)
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '3600',
    },
  })
}

