#!/bin/bash
# Скрипт для деплоя на сервер
# Использование: ./deploy-server.sh [registry-image]

IMAGE_NAME=${1:-"ghcr.io/F1bonacci66/civilx-universe:latest"}

echo "========================================"
echo "   Деплой CivilX.Universe на сервер"
echo "========================================"

# Проверка Docker
echo ""
echo "[1/4] Проверка Docker..."
if ! command -v docker &> /dev/null; then
    echo "✗ ОШИБКА: Docker не найден!"
    exit 1
fi
echo "✓ Docker найден"

# Проверка docker-compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "✗ ОШИБКА: docker-compose не найден!"
    exit 1
fi
echo "✓ docker-compose найден"

# Обновление .env файла
echo ""
echo "[2/4] Настройка переменных окружения..."
if [ ! -f .env ]; then
    echo "Создание .env файла..."
    cat > .env << EOF
PORT=3001
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
DOCKER_IMAGE=${IMAGE_NAME}
EOF
    echo "✓ .env файл создан"
else
    echo "✓ .env файл существует"
    # Обновить DOCKER_IMAGE если нужно
    if ! grep -q "DOCKER_IMAGE=" .env; then
        echo "DOCKER_IMAGE=${IMAGE_NAME}" >> .env
    else
        sed -i "s|DOCKER_IMAGE=.*|DOCKER_IMAGE=${IMAGE_NAME}|" .env
    fi
fi

# Загрузка образа
echo ""
echo "[3/4] Загрузка образа из registry..."
echo "Образ: ${IMAGE_NAME}"
docker pull "${IMAGE_NAME}"

if [ $? -ne 0 ]; then
    echo "✗ ОШИБКА: Не удалось загрузить образ!"
    echo "Проверьте:"
    echo "  1. Вы вошли в registry: docker login"
    echo "  2. Образ существует в registry"
    echo "  3. У вас есть права доступа к образу"
    exit 1
fi
echo "✓ Образ загружен"

# Запуск контейнера
echo ""
echo "[4/4] Запуск контейнера..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.prod.yml up -d
else
    docker compose -f docker-compose.prod.yml up -d
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "   Деплой завершен успешно!"
    echo "========================================"
    echo ""
    echo "Проверка статуса:"
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.prod.yml ps
    else
        docker compose -f docker-compose.prod.yml ps
    fi
    echo ""
    echo "Просмотр логов:"
    echo "  docker-compose -f docker-compose.prod.yml logs -f universe"
    echo ""
    echo "Проверка health:"
    echo "  curl http://localhost:3001/api/health"
else
    echo "✗ ОШИБКА при запуске контейнера!"
    exit 1
fi

