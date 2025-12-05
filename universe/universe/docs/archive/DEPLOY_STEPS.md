# 📋 Пошаговая инструкция деплоя на сервер

## ✅ Что уже готово

- ✅ Образ оптимизирован и загружен на GitHub Container Registry
- ✅ Размер образа: **213 МБ** (было 1.42 ГБ)
- ✅ Образы доступны:
  - `ghcr.io/f1bonacci66/civilx-universe:latest`
  - `ghcr.io/f1bonacci66/civilx-universe:v1.0.0`

## 🚀 Шаги для деплоя на сервер

### Шаг 1: Подключиться к серверу

```bash
ssh user@your-server.com
```

### Шаг 2: Установить Docker и Docker Compose (если не установлены)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose

# Запустить Docker
sudo systemctl start docker
sudo systemctl enable docker

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER
# Выйти и зайти заново для применения изменений
```

### Шаг 3: Создать директорию проекта

```bash
sudo mkdir -p /opt/civilx-universe
cd /opt/civilx-universe
```

### Шаг 4: Создать файлы конфигурации

#### 4.1. Создать `.env` файл

```bash
nano .env
```

Вставить:
```env
PORT=3001
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
DOCKER_IMAGE=ghcr.io/f1bonacci66/civilx-universe:latest
GITHUB_TOKEN=your-github-token-here
```

Сохранить: `Ctrl+O`, `Enter`, `Ctrl+X`

#### 4.2. Создать `docker-compose.yml`

```bash
nano docker-compose.yml
```

Вставить содержимое из файла `docker-compose.prod.yml` (уже готов)

Или скопировать файл:
```bash
# Если у вас есть доступ к репозиторию
git clone https://github.com/F1bonacci66/civilx.univers.git
cd civilx.univers/universe/universe
cp docker-compose.prod.yml /opt/civilx-universe/docker-compose.yml
cp .env /opt/civilx-universe/.env
```

### Шаг 5: Авторизация в GitHub Container Registry

```bash
cd /opt/civilx-universe
source .env
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin
```

Должно вывести: `Login Succeeded`

### Шаг 6: Загрузить и запустить образ

```bash
# Загрузить образ
docker-compose pull

# Запустить контейнер
docker-compose up -d

# Проверить статус
docker-compose ps
```

### Шаг 7: Проверить работу

```bash
# Проверить health check
curl http://localhost:3001/api/health

# Должен вернуть: {"status":"ok"}

# Просмотр логов
docker-compose logs -f universe
```

## 🔄 Обновление приложения

Когда нужно обновить приложение:

```bash
cd /opt/civilx-universe

# Загрузить новый образ
docker-compose pull

# Перезапустить контейнер
docker-compose up -d

# Проверить логи
docker-compose logs -f universe
```

## 📝 Быстрый скрипт деплоя

Создать файл `deploy.sh`:

```bash
cd /opt/civilx-universe
nano deploy.sh
```

Вставить:
```bash
#!/bin/bash
cd /opt/civilx-universe

# Загрузить переменные окружения
source .env

# Войти в registry
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin

# Загрузить и запустить
docker-compose pull
docker-compose up -d

# Проверить статус
docker-compose ps

echo "✅ Деплой завершен!"
```

Сделать исполняемым:
```bash
chmod +x deploy.sh
```

Использовать:
```bash
./deploy.sh
```

## 🔍 Полезные команды

```bash
# Просмотр логов
docker-compose logs -f universe

# Остановить контейнер
docker-compose down

# Перезапустить контейнер
docker-compose restart universe

# Проверить использование ресурсов
docker stats civilx-universe

# Удалить старый образ
docker image prune -a
```

## ⚠️ Устранение проблем

### Ошибка: "unauthorized: authentication required"

```bash
# Войти заново
source .env
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin
```

### Ошибка: "pull access denied"

- Проверьте, что токен правильный в `.env`
- Убедитесь, что токен имеет права `read:packages`

### Контейнер не запускается

```bash
# Проверить логи
docker-compose logs universe

# Проверить статус
docker-compose ps

# Перезапустить
docker-compose restart universe
```

## 🌐 Настройка Nginx (если нужно)

Если нужно проксировать через Nginx на домене:

```bash
sudo nano /etc/nginx/sites-available/universe.civilx.ru
```

```nginx
server {
    listen 80;
    server_name universe.civilx.ru;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активировать:
```bash
sudo ln -s /etc/nginx/sites-available/universe.civilx.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## ✅ Готово!

После выполнения всех шагов приложение будет доступно на:
- `http://your-server-ip:3001`
- Или через Nginx на вашем домене

