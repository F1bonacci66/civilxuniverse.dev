#!/bin/bash
echo "=========================================="
echo "ПРОВЕРКА NGINX LOCATION БЛОКОВ"
echo "=========================================="
echo ""

# Проверяем порядок location блоков
echo "1. Порядок location блоков в конфигурации:"
grep -n 'location' /etc/nginx/sites-available/civilxuniverse.ru | head -15

echo ""
echo "2. Проверка location = /api/datalab/auth/signup/:"
grep -A 5 'location = /api/datalab/auth/signup/' /etc/nginx/sites-available/civilxuniverse.ru | head -10

echo ""
echo "3. Тест запроса через Nginx (localhost):"
curl -v -X POST http://127.0.0.1/api/datalab/auth/signup/ \
  -H "Host: civilxuniverse.ru" \
  -H "Content-Type: application/json" \
  -H "Origin: http://civilxuniverse.ru" \
  -d '{"name":"Test","email":"test@test.com","password":"test123"}' \
  2>&1 | grep -E '^< HTTP|^< X-Location|^< server|^> POST|^> Host' | head -10

echo ""
echo "4. Проверка логов Nginx (последние 5 записей):"
tail -5 /var/log/nginx/civilxuniverse.ru.access.log | grep -E 'signup|api/datalab'

echo ""
echo "=========================================="


