# 🚀 Деплой через GitHub Container Registry

## Процесс деплоя

### Шаг 1: Создать GitHub Personal Access Token

1. Перейдите на https://github.com/settings/tokens
2. Нажмите "Generate new token" → "Generate new token (classic)"
3. Укажите имя токена (например, "Docker Registry")
4. Выберите права:
   - ✅ `read:packages` - чтение пакетов
   - ✅ `write:packages` - запись пакетов
5. Нажмите "Generate token"
6. **Скопируйте токен** (он показывается только один раз!)

### Шаг 2: Загрузить образ в GitHub Container Registry (локально)

#### Windows PowerShell:

```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe

# Установить токен (временная переменная для текущей сессии)
$env:GITHUB_TOKEN = "your-github-token-here"

# Загрузить образ
.\push-to-ghcr.ps1 -Tag v1.0.0

# Или с указанием версии
.\push-to-ghcr.ps1 -Tag v1.0.0 -GitHubUsername F1bonacci66
```

#### Linux/Mac:

```bash
cd /path/to/civilx-website/universe/universe

# Установить токен
export GITHUB_TOKEN="your-github-token-here"

# Загрузить образ
chmod +x push-to-ghcr.sh
./push-to-ghcr.sh v1.0.0
```

#### Вручную:

```powershell
# Войти в GitHub Container Registry
echo $env:GITHUB_TOKEN | docker login ghcr.io -u F1bonacci66 --password-stdin

# Тегировать образ
docker tag civilx-universe:latest ghcr.io/F1bonacci66/civilx-universe:latest
docker tag civilx-universe:latest ghcr.io/F1bonacci66/civilx-universe:v1.0.0

# Загрузить образ
docker push ghcr.io/F1bonacci66/civilx-universe:latest
docker push ghcr.io/F1bonacci66/civilx-universe:v1.0.0
```

### Шаг 3: На сервере - Клонировать репозиторий

```bash
# На сервере (Linux)
cd /opt
git clone git@github.com:F1bonacci66/civilx.univers.git
cd civilx.univers/universe/universe
```

**Или если репозиторий еще не содержит код:**

```bash
# Клонировать основной репозиторий
cd /opt
git clone git@github.com:F1bonacci66/civilx.univers.git
cd civilx.univers

# Скопировать код universe (если нужно)
# Или использовать существующий репозиторий civilx-website
```

### Шаг 4: На сервере - Настроить и запустить

#### 4.1. Создать .env файл

```bash
cd /opt/civilx.univers/universe/universe
# или
cd /opt/civilx-website/universe/universe

nano .env
```

Содержимое `.env`:
```env
PORT=3001
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
DOCKER_IMAGE=ghcr.io/F1bonacci66/civilx-universe:latest
```

#### 4.2. Войти в GitHub Container Registry

```bash
# Создать Personal Access Token на GitHub (см. Шаг 1)
# Использовать токен как пароль
echo "your-github-token" | docker login ghcr.io -u F1bonacci66 --password-stdin
```

#### 4.3. Запустить деплой

```bash
# Использовать скрипт
chmod +x deploy-server.sh
./deploy-server.sh ghcr.io/F1bonacci66/civilx-universe:latest

# Или вручную
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Шаг 5: Проверка работы

```bash
# Проверить статус
docker-compose -f docker-compose.prod.yml ps

# Проверить health check
curl http://localhost:3001/api/health

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f universe
```

## Обновление на сервере

### Автоматическое обновление

```bash
cd /opt/civilx.univers/universe/universe

# Получить обновления из git
git pull

# Загрузить новый образ из registry
docker-compose -f docker-compose.prod.yml pull

# Перезапустить контейнер
docker-compose -f docker-compose.prod.yml up -d
```

### Ручное обновление

```bash
# Остановить контейнер
docker-compose -f docker-compose.prod.yml down

# Загрузить новый образ
docker pull ghcr.io/F1bonacci66/civilx-universe:latest

# Запустить заново
docker-compose -f docker-compose.prod.yml up -d
```

## Использование конкретной версии

Для использования конкретной версии образа:

```bash
# В .env файле
DOCKER_IMAGE=ghcr.io/F1bonacci66/civilx-universe:v1.0.0

# Или в docker-compose.prod.yml
image: ghcr.io/F1bonacci66/civilx-universe:v1.0.0
```

## Просмотр образа в GitHub

После загрузки образа, он будет доступен по адресу:
- https://github.com/F1bonacci66/civilx.univers/pkgs/container/civilx-universe

## Безопасность

### Сохранение токена на сервере

Для автоматического входа в registry:

```bash
# Создать файл с токеном
echo "your-github-token" > ~/.github-token
chmod 600 ~/.github-token

# Использовать при входе
cat ~/.github-token | docker login ghcr.io -u F1bonacci66 --password-stdin
```

### Автоматический вход при перезагрузке

Создайте скрипт для автоматического входа:

```bash
nano /opt/civilx.univers/universe/universe/login-ghcr.sh
```

```bash
#!/bin/bash
cat ~/.github-token | docker login ghcr.io -u F1bonacci66 --password-stdin
```

```bash
chmod +x /opt/civilx.univers/universe/universe/login-ghcr.sh
```

## Устранение проблем

### Ошибка: "unauthorized: authentication required"

**Решение:**
```bash
# Войти в registry заново
cat ~/.github-token | docker login ghcr.io -u F1bonacci66 --password-stdin
```

### Ошибка: "pull access denied"

**Решение:**
- Проверьте, что токен имеет права `read:packages`
- Убедитесь, что репозиторий не приватный или у вас есть доступ
- Проверьте правильность имени образа: `ghcr.io/F1bonacci66/civilx-universe:latest`

### Образ не обновляется

**Решение:**
```bash
# Принудительно загрузить новый образ
docker-compose -f docker-compose.prod.yml pull --no-cache

# Или удалить старый и загрузить заново
docker rmi ghcr.io/F1bonacci66/civilx-universe:latest
docker-compose -f docker-compose.prod.yml pull
```

