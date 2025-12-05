# 🚀 Быстрый старт: Загрузка в GitHub Container Registry

## Шаг 1: Создать GitHub Personal Access Token

1. Перейдите: https://github.com/settings/tokens
2. Нажмите "Generate new token" → "Generate new token (classic)"
3. Выберите права: `read:packages`, `write:packages`
4. Скопируйте токен

## Шаг 2: Загрузить образ (Windows)

```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe

# Установить токен
$env:GITHUB_TOKEN = "ваш-токен-здесь"

# Загрузить образ
.\push-to-ghcr.ps1 -Tag v1.0.0
```

## Шаг 3: На сервере - Клонировать и запустить

```bash
# Клонировать репозиторий
cd /opt
git clone git@github.com:F1bonacci66/civilx.univers.git
cd civilx.univers/universe/universe

# Создать .env
cat > .env << EOF
PORT=3001
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
DOCKER_IMAGE=ghcr.io/F1bonacci66/civilx-universe:latest
EOF

# Войти в registry
echo "ваш-токен" | docker login ghcr.io -u F1bonacci66 --password-stdin

# Запустить
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Готово! ✅

Приложение доступно на: `http://localhost:3001`

**Подробная инструкция:** см. `DEPLOY_GITHUB.md`

