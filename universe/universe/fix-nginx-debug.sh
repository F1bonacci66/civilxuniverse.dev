#!/bin/bash
echo "=========================================="
echo "ДИАГНОСТИКА И ИСПРАВЛЕНИЕ NGINX"
echo "=========================================="
echo ""

# 1. Проверяем текущую конфигурацию
echo "1. Проверка location блоков:"
grep -n 'location.*api/datalab/auth/signup' /etc/nginx/sites-available/civilxuniverse.ru

# 2. Перезагружаем Nginx
echo ""
echo "2. Перезагрузка Nginx..."
systemctl reload nginx

# 3. Перезапускаем Next.js контейнер
echo ""
echo "3. Перезапуск Next.js контейнера..."
docker restart civilx-universe
sleep 3

# 4. Проверяем запрос через Nginx
echo ""
echo "4. Проверка запроса через Nginx:"
curl -s -I -X POST http://127.0.0.1/api/datalab/auth/signup/ \
  -H "Host: civilxuniverse.ru" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123"}' \
  | grep -E 'HTTP|X-Location-Matched|server'

# 5. Проверяем запрос напрямую к Next.js
echo ""
echo "5. Проверка запроса напрямую к Next.js:"
curl -s -I -X POST http://127.0.0.1:3001/api/datalab/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123"}' \
  | grep -E 'HTTP|server'

echo ""
echo "=========================================="
echo "ДИАГНОСТИКА ЗАВЕРШЕНА"
echo "=========================================="
