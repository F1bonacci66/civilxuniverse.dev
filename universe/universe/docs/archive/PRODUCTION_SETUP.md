# Настройка для Production

## Варианты развертывания

### Вариант 1: Nginx Reverse Proxy (Рекомендуется)

Используйте nginx для проксирования запросов, что решает проблему CORS:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Для больших файлов
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

С этим подходом:
- Frontend отправляет запросы на `/api/...` (относительный URL)
- Nginx проксирует на backend
- CORS не нужен, так как все на одном домене

### Вариант 2: Прямые запросы с правильным CORS

Настройте `.env.local` для production:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/datalab
```

И настройте CORS на backend для production домена:

```env
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Вариант 3: Docker Compose

```yaml
version: '3.8'

services:
  frontend:
    build: ./universe/universe
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000/api/datalab
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - CORS_ORIGINS=http://frontend:3000
```

## Известные проблемы и решения

### Проблема: Next.js API route зависает при больших файлах

**Решение для production:**
- Используйте nginx reverse proxy (Вариант 1)
- Или отправляйте запросы напрямую с frontend на backend (Вариант 2)
- Next.js API route прокси нужен только для обхода CORS в разработке

### Проблема: CORS ошибки

**Решение:**
- Используйте nginx reverse proxy - это решает проблему полностью
- Или правильно настройте CORS на backend для production домена

### Проблема: Таймауты при больших файлах

**Решение:**
- Увеличьте таймауты в nginx (см. пример выше)
- Увеличьте `maxDuration` в Next.js API route (если используете)
- Настройте `client_max_body_size` в nginx

## Рекомендации

1. **Для production используйте nginx reverse proxy** - это самый надежный способ
2. **Отключите Next.js API route прокси** в production - отправляйте запросы напрямую
3. **Используйте HTTPS** для production
4. **Настройте правильные таймауты** для больших файлов



