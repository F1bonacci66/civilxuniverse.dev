#!/bin/bash
echo "=========================================="
echo "ПЕРЕСБОРКА ФРОНТЕНДА ИЗ СКОПИРОВАННЫХ ФАЙЛОВ"
echo "=========================================="
echo ""

WORK_DIR="/tmp/universe-rebuild"
cd $WORK_DIR

echo "1. Проверка файлов..."
if [ ! -f "lib/api/client.ts" ]; then
    echo "❌ Файл lib/api/client.ts не найден"
    exit 1
fi

echo "✅ Файлы найдены"
head -15 lib/api/client.ts | grep -q "/api/datalab" && echo "✅ Использует относительный путь" || echo "⚠️ Проверьте содержимое"

echo ""
echo "2. Сборка Docker образа..."
docker build --build-arg NEXT_PUBLIC_API_URL=/api/datalab -t civilx-universe:latest . || {
    echo "❌ Ошибка сборки образа"
    exit 1
}

echo ""
echo "3. Остановка старого контейнера..."
docker stop civilx-universe 2>/dev/null
docker rm civilx-universe 2>/dev/null

echo ""
echo "4. Запуск нового контейнера..."
docker run -d --name civilx-universe --restart unless-stopped -p 3001:3001 civilx-universe:latest || {
    echo "❌ Ошибка запуска контейнера"
    exit 1
}

echo ""
echo "5. Ожидание запуска..."
sleep 5

echo ""
echo "6. Проверка статуса..."
docker ps | grep civilx-universe && echo "✅ Контейнер запущен" || echo "❌ Контейнер не запущен"

echo ""
echo "7. Проверка логов..."
docker logs civilx-universe --tail 10

echo ""
echo "=========================================="
echo "✅ ПЕРЕСБОРКА ЗАВЕРШЕНА"
echo "=========================================="
echo "Проверьте регистрацию на http://civilxuniverse.ru/auth/register/"


