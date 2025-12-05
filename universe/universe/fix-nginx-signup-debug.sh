#!/bin/bash
set -e

echo "🔍 Диагностика проблемы с /api/datalab/auth/signup/"

# 1. Проверяем, попадают ли запросы в Nginx
echo ""
echo "1️⃣ Проверяем последние записи в логах Nginx:"
tail -5 /var/log/nginx/civilxuniverse.ru.access.log | grep -E "signup|auth" || echo "   ⚠️ Нет записей о signup в логах"

# 2. Проверяем конфигурацию Nginx
echo ""
echo "2️⃣ Проверяем конфигурацию Nginx для HTTPS:"
nginx -t 2>&1 | grep -E "successful|error" || true

# 3. Проверяем, что location блоки для signup есть
echo ""
echo "3️⃣ Проверяем location блоки для /api/datalab/auth/signup/:"
grep -A 5 "location = /api/datalab/auth/signup/" /etc/nginx/sites-available/civilxuniverse.ru | head -10 || echo "   ❌ Location блок не найден"

# 4. Проверяем, что FastAPI работает
echo ""
echo "4️⃣ Проверяем, что FastAPI работает:"
curl -s -X OPTIONS http://127.0.0.1:8000/api/datalab/auth/signup/ -H "Origin: https://civilxuniverse.ru" -w "\nHTTP_CODE:%{http_code}\n" | tail -1

# 5. Проверяем, что запросы через Nginx попадают в FastAPI
echo ""
echo "5️⃣ Проверяем запрос через Nginx (localhost):"
curl -k -s -X OPTIONS https://127.0.0.1/api/datalab/auth/signup/ -H "Host: civilxuniverse.ru" -H "Origin: https://civilxuniverse.ru" -w "\nHTTP_CODE:%{http_code}\n" | tail -1

# 6. Проверяем, что Next.js не обрабатывает запросы к /api/datalab/auth/*
echo ""
echo "6️⃣ Проверяем, есть ли в Next.js обработчики для /api/datalab/auth/:"
docker exec civilx-universe find /app/.next/server/app/api/datalab/auth -type f 2>/dev/null | head -5 || echo "   ✅ Нет обработчиков в Next.js"

# 7. Проверяем, что Next.js не имеет catch-all для /api/*
echo ""
echo "7️⃣ Проверяем, есть ли catch-all для /api/* в Next.js:"
docker exec civilx-universe find /app/.next/server/app/api -name '*[...*]*' -o -name '*[[...*]]*' 2>/dev/null | head -5 || echo "   ✅ Нет catch-all для /api/*"

echo ""
echo "✅ Диагностика завершена"
echo ""
echo "📋 Следующие шаги:"
echo "   1. Попробуйте зарегистрироваться в браузере"
echo "   2. Выполните: tail -1 /var/log/nginx/civilxuniverse.ru.access.log"
echo "   3. Если в логах нет записей, запросы не попадают в Nginx"
echo "   4. Если в логах есть записи, проверьте, какой location блок сработал"
