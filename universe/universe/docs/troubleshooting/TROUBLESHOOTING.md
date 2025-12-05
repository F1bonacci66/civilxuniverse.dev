# 🐛 Решение проблем

Руководство по решению частых проблем при работе с CivilX.Universe.

## 📋 Содержание

1. [Проблемы с API](#проблемы-с-api)
2. [Проблемы с Docker](#проблемы-с-docker)
3. [Проблемы с аутентификацией](#проблемы-с-аутентификацией)
4. [Проблемы с базой данных](#проблемы-с-базой-данных)
5. [Проблемы с деплоем](#проблемы-с-деплоем)

## 🔌 Проблемы с API

### Ошибка: `ERR_NAME_NOT_RESOLVED`

**Симптомы:**
- В консоли браузера: `Failed to load resource: net::ERR_NAME_NOT_RESOLVED`
- Frontend не может подключиться к backend

**Решение:**

1. Проверить, что backend запущен:
```bash
curl http://localhost:8000/health
```

2. Проверить переменную окружения `NEXT_PUBLIC_API_URL`:
```bash
# В docker-compose.yml или .env
NEXT_PUBLIC_API_URL=http://95.163.230.61:8000/api/datalab
```

3. Пересобрать frontend с правильным API URL:
```powershell
# На локальной машине
docker build --build-arg NEXT_PUBLIC_API_URL=http://95.163.230.61:8000/api/datalab -t civilx-universe:latest .
```

### Ошибка: `CORS policy`

**Симптомы:**
- В консоли браузера: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Решение:**

Добавить origin в CORS настройки backend (`backend/app/main.py`):

```python
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://95.163.230.61:3001",
    "http://95.163.230.61:3000"
]
```

Перезапустить backend:
```bash
pkill -f uvicorn
cd /opt/civilx-backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

### Ошибка: `500 Internal Server Error`

**Симптомы:**
- API возвращает 500 ошибку
- В логах backend есть ошибки

**Решение:**

1. Проверить логи backend:
```bash
tail -50 /opt/civilx-backend/backend.log
```

2. Частые причины:
   - Проблемы с базой данных (таблицы не созданы)
   - Ошибки в моделях (JSONB вместо JSON для SQLite)
   - Отсутствующие зависимости

3. Пересоздать базу данных:
```bash
rm -f /opt/civilx-backend/data/civilx_universe.db
# Перезапустить backend - таблицы создадутся автоматически
```

## 🐳 Проблемы с Docker

### Ошибка: `denied: denied` при push в GHCR

**Симптомы:**
- `Error response from daemon: Get "https://ghcr.io/v2/": denied: denied`

**Решение:**

1. Проверить токен GitHub:
```powershell
# Проверить scopes токена
$headers = @{Authorization = "token YOUR_TOKEN"}
Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers
```

2. Использовать cmd вместо PowerShell для docker login:
```powershell
cmd /c "echo YOUR_TOKEN | docker login ghcr.io -u f1bonacci66 --password-stdin"
```

3. Убедиться, что токен имеет права `write:packages`

### Ошибка: `ContainerConfig` при docker-compose up

**Симптомы:**
- `KeyError: 'ContainerConfig'` при запуске контейнера

**Решение:**

Удалить старый контейнер и образ:
```bash
docker-compose down
docker rmi ghcr.io/f1bonacci66/civilx-universe:latest
docker-compose pull
docker-compose up -d
```

### Контейнер показывает `unhealthy`

**Симптомы:**
- `docker-compose ps` показывает `(unhealthy)`

**Решение:**

1. Проверить health check:
```bash
docker exec civilx-universe node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"
```

2. Проверить логи:
```bash
docker-compose logs universe
```

3. Увеличить `start_period` в healthcheck:
```yaml
healthcheck:
  start_period: 60s  # Увеличить с 40s
```

## 🔐 Проблемы с аутентификацией

### Ошибка: `invalid token` в GHCR

**Симптомы:**
- `{"errors":[{"code":"DENIED","message":"invalid token"}]}`

**Решение:**

1. Создать новый классический токен на GitHub:
   - https://github.com/settings/tokens/new
   - Выбрать "Generate new token (classic)"
   - Права: `write:packages` (автоматически включает `read:packages`)

2. Использовать токен:
```bash
echo "NEW_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin
```

### Ошибка: `unauthorized: authentication required`

**Симптомы:**
- `unauthorized: authentication required` при pull образа

**Решение:**

Войти в registry заново:
```bash
source .env
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin
```

## 💾 Проблемы с базой данных

### Ошибка: `Foreign key associated with column 'csv_data_rows.user_id' could not find table 'users'`

**Симптомы:**
- Backend не может создать таблицы
- В логах: `WARNING: Database connection failed: Foreign key...`

**Решение:**

Убрать Foreign Key из модели (временно, пока таблица users не создана):

В `backend/app/models/upload.py`:
```python
# Было:
user_id = Column(UUID(), ForeignKey("users.id"), nullable=False)

# Стало:
user_id = Column(UUID(), nullable=False, index=True)
```

Пересоздать базу данных:
```bash
rm -f /opt/civilx-backend/data/civilx_universe.db
# Перезапустить backend
```

### Ошибка: `Compiler can't render element of type JSONB`

**Симптомы:**
- `Compiler <sqlalchemy.dialects.sqlite.base.SQLiteTypeCompiler> can't render element of type JSONB`

**Решение:**

Заменить JSONB на JSON в моделях (SQLite не поддерживает JSONB):

В `backend/app/models/pivot.py`:
```python
# Было:
from sqlalchemy.dialects.postgresql import JSONB
rows = Column(JSONB, nullable=False)

# Стало:
from sqlalchemy import JSON
rows = Column(JSON, nullable=False)
```

## 🚀 Проблемы с деплоем

### Backend не запускается

**Симптомы:**
- Процесс uvicorn не найден
- Порт 8000 не слушается

**Решение:**

1. Проверить, не занят ли порт:
```bash
netstat -tulpn | grep 8000
# Если занят, остановить процесс
pkill -f uvicorn
```

2. Запустить backend:
```bash
cd /opt/civilx-backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

3. Проверить логи:
```bash
tail -50 /opt/civilx-backend/backend.log
```

### Frontend не обновляется

**Симптомы:**
- После обновления образа изменения не применяются

**Решение:**

1. Принудительно пересоздать контейнер:
```bash
docker-compose down
docker-compose pull --no-cache
docker-compose up -d
```

2. Проверить, что используется правильный образ:
```bash
docker-compose config | grep image
```

## 📞 Получение помощи

Если проблема не решена:

1. Проверить логи:
   - Frontend: `docker-compose logs universe`
   - Backend: `tail -100 /opt/civilx-backend/backend.log`

2. Проверить статус сервисов:
   - Frontend: `docker-compose ps`
   - Backend: `ps aux | grep uvicorn`

3. Проверить сеть:
   - `curl http://localhost:3001/api/health`
   - `curl http://localhost:8000/health`

4. Создать issue в репозитории с:
   - Описанием проблемы
   - Логами ошибок
   - Шагами для воспроизведения




