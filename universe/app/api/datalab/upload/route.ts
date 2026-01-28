// Next.js API Route для проксирования запросов загрузки файлов
// Это обходит проблему CORS, так как запрос идет на тот же домен

import { NextRequest, NextResponse } from 'next/server'

// Увеличиваем таймаут для больших файлов
export const maxDuration = 600 // 10 минут для очень больших файлов (до 500+ MB)
export const runtime = 'nodejs'

// Используем прямой URL к backend
// В Docker контейнере на Linux используем 172.17.0.1 (Docker bridge), на хосте - localhost
// host.docker.internal работает только на Docker Desktop (Windows/Mac), не на Linux
const getBackendUrl = () => {
  const BACKEND_HOST = process.env.DOCKER_CONTAINER === 'true' 
    ? 'http://172.17.0.1:8000'  // Docker bridge IP для Linux
    : 'http://localhost:8000'
  const BACKEND_URL = `${BACKEND_HOST}/api/datalab/upload`
  
  console.log('[Upload Route] getBackendUrl:', {
    BACKEND_HOST,
    BACKEND_URL,
    DOCKER_CONTAINER: process.env.DOCKER_CONTAINER,
  })
  
  return BACKEND_URL
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
    
    const BACKEND_URL = getBackendUrl()
    console.log(`📤 [${requestId}] Пересылаем запрос на: ${BACKEND_URL}`)
    console.log(`⏳ [${requestId}] Отправляем запрос на backend через streaming...`)
    
    try {
      // Используем streaming подход для больших файлов
      // Передаем поток напрямую, без чтения всего файла в память
      const fetchStartTime = Date.now()
      console.log(`⏱️  [${requestId}] Начало streaming запроса к backend в ${new Date().toISOString()}`)
      if (contentLength) {
        console.log(`⏱️  [${requestId}] Размер тела: ${contentLength} байт (${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB)`)
      }
      
      // Используем встроенный модуль http Node.js для streaming
      console.log(`⏱️  [${requestId}] Отправляем запрос на backend через http модуль (streaming)...`)
      
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
              ...(contentLength && { 'Content-Length': contentLength }),
            },
            timeout: 600000, // 10 минут для очень больших файлов (до 500+ MB)
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
          console.error(`❌ [${requestId}] HTTP request error:`, error)
          reject(error)
        })
        
        req.on('timeout', () => {
          console.error(`❌ [${requestId}] HTTP request timeout`)
          req.destroy()
          reject(new Error('Request timeout'))
        })
        
        // Используем streaming - передаем request.body напрямую
        // request.body - это ReadableStream, который можно читать по частям
        if (request.body) {
          const reader = request.body.getReader()
          let totalBytes = 0
          
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read()
                
                if (done) {
                  console.log(`✅ [${requestId}] Тело запроса отправлено полностью (${totalBytes} байт)`)
                  req.end()
                  break
                }
                
                if (value) {
                  totalBytes += value.length
                  const canContinue = req.write(Buffer.from(value))
                  
                  if (!canContinue) {
                    // Ждем события 'drain' перед продолжением
                    await new Promise<void>((resolve) => {
                      req.once('drain', resolve)
                    })
                  }
                }
              }
            } catch (error: any) {
              console.error(`❌ [${requestId}] Ошибка при чтении потока:`, error)
              if (!req.destroyed) {
                req.destroy()
              }
              reject(error)
            }
          }
          
          pump()
        } else {
          // Если body нет, просто закрываем запрос
          req.end()
        }
      })
      
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
      if (fetchError.name === 'AbortError' || fetchError.message === 'Request timeout') {
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
          timeout: 120000, // 120 секунд (может быть медленным из-за подключения к удаленной БД на dev сервере)
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





