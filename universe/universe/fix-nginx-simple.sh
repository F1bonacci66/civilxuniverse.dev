#!/bin/bash
# Простой скрипт для исправления приоритета location блоков в Nginx

cp /etc/nginx/sites-available/civilxuniverse.ru /etc/nginx/sites-available/civilxuniverse.ru.backup.$(date +%Y%m%d_%H%M%S)

# Заменяем location ^~ на location = для максимального приоритета
sed -i 's|location ^~ /api/datalab/auth/signup/|location = /api/datalab/auth/signup/|g' /etc/nginx/sites-available/civilxuniverse.ru
sed -i 's|location ^~ /api/datalab/auth/signup|location = /api/datalab/auth/signup|g' /etc/nginx/sites-available/civilxuniverse.ru
sed -i 's|location ^~ /api/datalab/auth/register/|location = /api/datalab/auth/register/|g' /etc/nginx/sites-available/civilxuniverse.ru
sed -i 's|location ^~ /api/datalab/auth/register|location = /api/datalab/auth/register|g' /etc/nginx/sites-available/civilxuniverse.ru

echo "✅ Конфигурация обновлена"
nginx -t && systemctl reload nginx && echo "✅ Nginx перезагружен"

echo ""
echo "Проверка:"
curl -s -o /dev/null -w "OPTIONS /signup/: %{http_code}\n" -X OPTIONS http://127.0.0.1/api/datalab/auth/signup/ -H "Host: civilxuniverse.ru"
curl -s -o /dev/null -w "POST /signup/: %{http_code}\n" -X POST http://127.0.0.1/api/datalab/auth/signup/ -H "Host: civilxuniverse.ru" -H "Content-Type: application/json" -d '{"name":"Test","email":"test@test.com","password":"test123"}'


