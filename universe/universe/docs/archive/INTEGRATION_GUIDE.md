# Руководство по интеграции Frontend с Backend

## Настройка

### 1. Создать .env.local для frontend

В директории `universe/universe/` создайте файл `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/datalab
```

### 2. Проверить CORS на backend

В `backend/.env` должно быть:

```env
CORS_ORIGINS=http://localhost:3001,http://localhost:3000
```

### 3. Запустить backend

```powershell
cd civilx-website\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

### 4. Запустить frontend

```powershell
cd civilx-website\universe\universe
npm run dev
```

## Проверка интеграции

### 1. Проверить, что API доступен

Откройте в браузере:
- http://localhost:8000/docs - Swagger UI
- http://localhost:3000/app/datalab/upload - страница загрузки файлов

### 2. Проверить загрузку файла

1. Выберите проект и версию
2. Загрузите файл (RVT, IFC, CSV)
3. Проверьте консоль браузера на наличие ошибок
4. Проверьте, что файл появился в БД

### 3. Проверить API через Swagger

1. Откройте http://localhost:8000/docs
2. Попробуйте загрузить файл через Swagger UI
3. Проверьте ответы API

## Возможные проблемы

### CORS ошибки

Если видите ошибки CORS в консоли браузера:

1. Проверьте `CORS_ORIGINS` в `backend/.env`
2. Убедитесь, что URL frontend (http://localhost:3000 или http://localhost:3001) добавлен в список
3. Перезапустите backend

### Ошибки подключения

Если видите ошибки "Failed to fetch" или "Network error":

1. Убедитесь, что backend запущен на http://localhost:8000
2. Проверьте `NEXT_PUBLIC_API_URL` в `.env.local`
3. Проверьте консоль браузера для деталей ошибки

### Ошибки загрузки файлов

Если загрузка файлов не работает:

1. Проверьте, что MinIO/S3 настроен (или используйте временное хранилище)
2. Проверьте размер файла (может быть ограничение)
3. Проверьте логи backend для деталей ошибки

## Формат данных

### Загрузка файла

**Request:**
```
POST /api/datalab/upload
Content-Type: multipart/form-data

file: File
projectId: string (UUID)
versionId: string (UUID)
exportSettingsId?: string (UUID)
autoConvert?: boolean
```

**Response:**
```json
{
  "fileUpload": {
    "id": "uuid",
    "userId": "uuid",
    "projectId": "uuid",
    "versionId": "uuid",
    "originalFilename": "file.rvt",
    "fileType": "RVT",
    "fileSize": 123456,
    "uploadStatus": "completed",
    ...
  },
  "conversionJob": null
}
```

### Получение прогресса

**Request:**
```
GET /api/datalab/upload/{fileUploadId}/progress
```

**Response:**
```json
{
  "fileUploadId": "uuid",
  "uploadStatus": "completed",
  "uploadProgress": 100,
  "conversionStatus": "pending",
  "conversionProgress": 0
}
```

## Следующие шаги

После успешной интеграции:
1. Настроить MinIO/S3 для реального хранения файлов
2. Реализовать конвертацию RVT→IFC→CSV
3. Добавить WebSocket для реального времени обновления прогресса
4. Добавить аутентификацию (JWT токены)



