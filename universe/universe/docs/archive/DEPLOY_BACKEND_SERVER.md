# 🚀 Развертывание Backend API на сервере

## Текущая ситуация

- ✅ Frontend (universe) развернут и работает на `http://95.163.230.61:3001`
- ❌ Backend API не запущен (порт 8000 закрыт)
- ❌ Домен `api.civilx.ru` не настроен

## Решение: Развернуть Backend API на сервере

### Вариант 1: Быстрый запуск (для тестирования)

Выполните на сервере:

```bash
# 1. Создать директорию для backend
sudo mkdir -p /opt/civilx-backend
cd /opt/civilx-backend

# 2. Скопировать backend код (если есть доступ к репозиторию)
# Или загрузить файлы вручную

# 3. Установить Python зависимости
sudo apt update
sudo apt install -y python3 python3-pip python3-venv

# 4. Создать виртуальное окружение
python3 -m venv venv
source venv/bin/activate

# 5. Установить зависимости
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv

# 6. Запустить backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Вариант 2: Через Docker (рекомендуется)

#### 2.1. Создать Dockerfile для backend

```bash
cd /opt/civilx-backend
nano Dockerfile
```

Содержимое:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Установить зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копировать код
COPY . .

# Запустить сервер
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 2.2. Создать docker-compose.yml

```bash
nano docker-compose.yml
```

Содержимое:
```yaml
version: '3.8'

services:
  backend:
    build: .
    container_name: civilx-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@localhost:5432/civilx_universe
      - CORS_ORIGINS=http://95.163.230.61:3001,http://localhost:3001
    volumes:
      - ./storage:/app/storage
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
    name: civilx-backend-network
```

#### 2.3. Запустить

```bash
docker-compose up -d
```

### Вариант 3: Systemd Service (для production)

#### 3.1. Создать systemd service

```bash
sudo nano /etc/systemd/system/civilx-backend.service
```

Содержимое:
```ini
[Unit]
Description=CivilX Universe Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/civilx-backend
Environment="PATH=/opt/civilx-backend/venv/bin"
ExecStart=/opt/civilx-backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 3.2. Запустить service

```bash
sudo systemctl daemon-reload
sudo systemctl enable civilx-backend
sudo systemctl start civilx-backend
sudo systemctl status civilx-backend
```

## После развертывания Backend

### 1. Проверить работу Backend

```bash
# На сервере
curl http://localhost:8000/health
curl http://localhost:8000/docs
```

### 2. Обновить Frontend с правильным API URL

После того как backend запущен, нужно пересобрать frontend с правильным API URL:

**На локальной машине:**
```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe

# Пересобрать образ с IP адресом API
docker build --build-arg NEXT_PUBLIC_API_URL=http://95.163.230.61:8000/api/datalab -t civilx-universe:latest .

# Загрузить на GitHub
docker tag civilx-universe:latest ghcr.io/f1bonacci66/civilx-universe:latest
docker push ghcr.io/f1bonacci66/civilx-universe:latest
```

**На сервере:**
```bash
cd /opt/civilx-universe
docker-compose pull
docker-compose up -d
```

## Настройка домена (опционально)

Если нужно настроить домен `api.civilx.ru`:

### 1. Настроить DNS

Добавить A-запись:
- `api.civilx.ru` → `95.163.230.61`

### 2. Настроить Nginx

```bash
sudo nano /etc/nginx/sites-available/api.civilx.ru
```

```nginx
server {
    listen 80;
    server_name api.civilx.ru;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api.civilx.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Пересобрать Frontend с доменом

```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab -t civilx-universe:latest .
```

## Проверка работы

1. **Backend доступен:**
   ```bash
   curl http://95.163.230.61:8000/health
   ```

2. **Frontend может подключиться:**
   - Откройте `http://95.163.230.61:3001`
   - Проверьте консоль браузера (F12) - не должно быть ошибок `ERR_NAME_NOT_RESOLVED`

3. **API работает:**
   - Откройте `http://95.163.230.61:8000/docs`
   - Должен открыться Swagger UI

