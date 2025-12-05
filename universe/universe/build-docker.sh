#!/bin/bash
# Скрипт сборки Docker образа для CivilX.Universe
# Использование: ./build-docker.sh [tag]

TAG=${1:-latest}
IMAGE_NAME="civilx-universe"

echo "========================================"
echo "   Сборка Docker образа для деплоя"
echo "========================================"

# Проверка Docker
echo ""
echo "[1/5] Проверка Docker..."
if ! command -v docker &> /dev/null; then
    echo "✗ ОШИБКА: Docker не найден!"
    echo "Установите Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
echo "✓ Docker найден: $(docker --version)"

# Проверка текущей директории
echo ""
echo "[2/5] Проверка директории..."
if [ ! -f "Dockerfile" ]; then
    echo "✗ ОШИБКА: Dockerfile не найден!"
    echo "Запустите скрипт из директории universe/universe/"
    exit 1
fi
echo "✓ Dockerfile найден"

# Проверка необходимых файлов
echo ""
echo "[3/5] Проверка файлов..."
REQUIRED_FILES=("package.json" "next.config.mjs" "tsconfig.json" "tailwind.config.ts" "postcss.config.mjs")
MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done
if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "✗ ОШИБКА: Отсутствуют файлы: ${MISSING_FILES[*]}"
    exit 1
fi
echo "✓ Все необходимые файлы найдены"

# Включение BuildKit
echo ""
echo "[4/5] Настройка BuildKit..."
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
echo "✓ BuildKit включен"

# Сборка образа
echo ""
echo "[5/5] Сборка Docker образа..."
echo "Образ: ${IMAGE_NAME}:${TAG}"
echo "Это может занять 5-10 минут при первой сборке..."

if docker build -t "${IMAGE_NAME}:${TAG}" -t "${IMAGE_NAME}:latest" .; then
    echo ""
    echo "========================================"
    echo "   Сборка завершена успешно!"
    echo "========================================"
    
    # Показываем информацию об образе
    echo ""
    echo "Информация об образе:"
    docker images "${IMAGE_NAME}:${TAG}" | head -2
    
    echo ""
    echo "Следующие шаги:"
    echo "1. Проверить образ: docker images ${IMAGE_NAME}:${TAG}"
    echo "2. Протестировать локально: docker run -d -p 3001:3001 --name test-universe ${IMAGE_NAME}:${TAG}"
    echo "3. Сохранить образ: docker save -o ${IMAGE_NAME}-${TAG}.tar ${IMAGE_NAME}:${TAG}"
    echo "4. Загрузить на сервер и запустить (см. DEPLOY_DOCKER.md)"
else
    echo ""
    echo "✗ ОШИБКА при сборке образа!"
    exit 1
fi






