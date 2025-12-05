"""
FastAPI приложение для CivilX.Universe DataLab
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from app.core.config import settings
from app.core.database import init_db
from app.api.v1 import router as api_v1_router

# Загружаем переменные окружения
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events для приложения"""
    # Startup
    print("Starting up...")
    try:
        await init_db()
        print("Database initialized")
    except Exception as e:
        print(f"WARNING: Database connection failed: {e}")
        print("Server will start, but database operations will fail.")
        print("Please check your DATABASE_URL in .env file and ensure PostgreSQL is running.")
    
    # Запускаем фоновый процесс проверки очереди конвертаций
    import asyncio
    from app.api.v1.conversion import _queue_processor_loop, _queue_processor_running
    queue_processor_task = asyncio.create_task(_queue_processor_loop())
    print("Queue processor started")
    
    yield
    
    # Shutdown
    print("Shutting down...")
    # Останавливаем фоновый процесс
    _queue_processor_running = False
    queue_processor_task.cancel()
    try:
        await queue_processor_task
    except asyncio.CancelledError:
        pass
    print("Queue processor stopped")


app = FastAPI(
    title="CivilX.Universe API",
    description="API для платформы CivilX.Universe - DataLab модуль",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,  # Отключаем автоматический редирект на trailing slash
)

# CORS - настройка для работы с frontend
print(f"🔧 CORS origins: {settings.CORS_ORIGINS}")
# Используем конкретные origins для лучшей безопасности
allowed_origins = [
    "http://localhost:3000", 
    "http://localhost:3001", 
    "http://127.0.0.1:3000", 
    "http://127.0.0.1:3001",
    "http://95.163.230.61:3001",
    "http://95.163.230.61:3000",
    "http://civilxuniverse.ru",
    "https://civilxuniverse.ru",
    "http://www.civilxuniverse.ru",
    "https://www.civilxuniverse.ru"
]
# Добавляем origins из настроек
if settings.CORS_ORIGINS:
    allowed_origins.extend(settings.CORS_ORIGINS)
# Убираем дубликаты
allowed_origins = list(set(allowed_origins))
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Разрешаем конкретные origins
    allow_credentials=True,  # Включаем credentials для работы с cookies
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Разрешаем все заголовки в ответе
    max_age=3600,
)

# Middleware для логирования запросов и обработки CORS preflight
@app.middleware("http")
async def log_requests(request, call_next):
    """Логирование всех входящих запросов, обработка CORS preflight и добавление CORS заголовков"""
    try:
        print(f"📥 {request.method} {request.url.path}")
        origin = request.headers.get("origin", "no origin")
        print(f"   Origin: {origin}")
        
        # КРИТИЧНО: Обрабатываем OPTIONS запросы (CORS preflight) ДО проксирования
        # Это предотвращает редирект 308 для preflight запросов
        if request.method == "OPTIONS":
            print("   🔄 OPTIONS (preflight) запрос - возвращаем ответ напрямую")
            from fastapi.responses import Response
            response = Response(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
                    "Access-Control-Max-Age": "3600",
                }
            )
            print(f"📤 {request.method} {request.url.path} -> {response.status_code} (preflight)")
            return response
        
        # Обрабатываем запрос
        response = await call_next(request)
        
        # КРИТИЧНО: Перехватываем редиректы 308 для OPTIONS запросов и заменяем на правильный ответ
        if response.status_code == 308:
            location = response.headers.get("location", "")
            print(f"   ⚠️  Обнаружен редирект 308: {request.url.path} -> {location}")
            
            # Если это OPTIONS запрос с редиректом - возвращаем правильный CORS ответ
            if request.method == "OPTIONS":
                print(f"   ⚠️  Перехвачен редирект 308 для OPTIONS - заменяем на 204")
                from fastapi.responses import Response
                response = Response(
                    status_code=204,
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
                        "Access-Control-Max-Age": "3600",
                    }
                )
            # Если редирект на тот же путь с trailing slash для health endpoint
            elif "/api/datalab/health" in request.url.path and location.endswith("/") and request.url.path == location.rstrip("/"):
                # Возвращаем правильный ответ напрямую, без редиректа
                response = JSONResponse(
                    status_code=200,
                    content={"status": "healthy", "message": "Backend is running"}
                )
        
        # Добавляем CORS заголовки к ответу (на случай если middleware не сработал)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        
        print(f"📤 {request.method} {request.url.path} -> {response.status_code}")
        return response
    except Exception as e:
        print(f"❌ Ошибка в middleware: {e}")
        import traceback
        traceback.print_exc()
        # Возвращаем ошибку с CORS заголовками
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )

# Подключаем роутеры
app.include_router(api_v1_router, prefix="/api/datalab")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "CivilX.Universe API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint - не требует БД"""
    print("✅ Health check вызван - отправляем ответ")
    response_data = {"status": "healthy", "message": "Backend is running"}
    print(f"✅ Отправляем ответ: {response_data}")
    return response_data

# Явный обработчик OPTIONS для логирования preflight запросов
@app.options("/api/datalab/upload")
async def options_upload():
    """Обработчик OPTIONS для /api/datalab/upload"""
    print("🔄 OPTIONS запрос получен для /api/datalab/upload")
    return JSONResponse(
        status_code=200,
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Глобальный обработчик ошибок с CORS заголовками"""
    import traceback
    error_detail = f"Internal server error: {str(exc)}\n{traceback.format_exc()}"
    print(f"GLOBAL ERROR HANDLER: {error_detail}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",  # Используем 127.0.0.1 для совместимости
        port=8000,
        reload=True,
    )

