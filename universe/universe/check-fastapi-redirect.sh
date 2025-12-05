#!/bin/bash
# Проверка настроек FastAPI и редиректов

echo "🔍 Проверка настроек FastAPI..."
echo ""

echo "1. Проверка, делает ли FastAPI редирект с trailing slash:"
curl -v -X OPTIONS http://127.0.0.1:8000/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  2>&1 | grep -E "< HTTP|< Location"
echo ""

echo "2. Проверка, делает ли FastAPI редирект на trailing slash:"
curl -v -X OPTIONS http://127.0.0.1:8000/api/datalab/auth/register/ \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  2>&1 | grep -E "< HTTP|< Location"
echo ""

echo "3. Проверка настроек FastAPI в коде:"
if [ -f /opt/civilx-backend/app/main.py ]; then
    echo "Файл найден. Проверяем redirect_slashes:"
    grep -i "redirect_slashes" /opt/civilx-backend/app/main.py
else
    echo "Файл не найден в /opt/civilx-backend/app/main.py"
    echo "Ищем файл main.py:"
    find /opt -name "main.py" -type f 2>/dev/null | head -5
fi
echo ""

echo "4. Проверка, может быть проблема в том, что nginx делает редирект из-за proxy_pass:"
echo "Проверяем текущую конфигурацию nginx для /api/datalab/auth/register:"
grep -A 20 "location = /api/datalab/auth/register" /etc/nginx/sites-available/api.civilx.ru | head -25
echo ""

echo "РЕШЕНИЕ: Если FastAPI делает редирект, нужно проверить настройку redirect_slashes=False в FastAPI"
echo "Или использовать proxy_pass с явным путем БЕЗ trailing slash"



