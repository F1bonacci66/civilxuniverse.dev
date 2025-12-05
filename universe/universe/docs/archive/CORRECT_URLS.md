# Правильные URL для доступа к приложению

## Frontend

**Основной URL:** http://localhost:3001 (не 3000!)

**Страница загрузки файлов:**
- http://localhost:3001/app/datalab/upload

**Другие страницы:**
- http://localhost:3001/app/datalab - главная страница DataLab
- http://localhost:3001/app/datalab/project/[projectId] - страница проекта

## Backend

**API:**
- http://localhost:8000 - главная страница API
- http://localhost:8000/docs - Swagger UI документация
- http://localhost:8000/health - health check
- http://localhost:8000/api/datalab/upload - API для загрузки файлов

## Важно

1. Frontend работает на порту **3001**, а не 3000
2. Backend работает на порту **8000**
3. Убедитесь, что оба сервера запущены перед тестированием



