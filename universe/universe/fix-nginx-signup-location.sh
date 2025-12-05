#!/bin/bash
echo "=========================================="
echo "ИСПРАВЛЕНИЕ NGINX С location ^~"
echo "=========================================="
echo ""

cp /etc/nginx/sites-available/api.civilx.ru /etc/nginx/sites-available/api.civilx.ru.backup.$(date +%Y%m%d_%H%M%S)

# Создаем новую конфигурацию
cat > /tmp/nginx-signup-config.txt << 'NGINX_CONFIG'
    # Используем location ^~ для максимального приоритета
    location ^~ /api/datalab/auth/signup/ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_intercept_errors off;
        proxy_next_upstream off;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
    }
NGINX_CONFIG

# Находим строку с location = /api/datalab/auth/signup/ и заменяем весь блок
python3 << 'PYTHON_SCRIPT'
import re

with open('/etc/nginx/sites-available/api.civilx.ru', 'r') as f:
    content = f.read()

# Находим и заменяем location блок для /signup/
pattern = r'    location = /api/datalab/auth/signup/ \{.*?\n    \}'
replacement = '''    location ^~ /api/datalab/auth/signup/ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_intercept_errors off;
        proxy_next_upstream off;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
    }'''

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('/etc/nginx/sites-available/api.civilx.ru', 'w') as f:
    f.write(new_content)

print("✅ Конфигурация обновлена")
PYTHON_SCRIPT

nginx -t && systemctl reload nginx && echo "✅ Nginx перезагружен"

echo ""
echo "Проверка /signup/ (с slash):"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/signup/ -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -k)
echo "HTTP Status Code: $STATUS"

if [ "$STATUS" = "204" ]; then
    echo "✅ УСПЕХ! /signup/ работает!"
else
    echo "❌ Статус: $STATUS"
    echo "Проверка полного ответа:"
    curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/signup/ \
      -H "Origin: http://civilxuniverse.ru" \
      -H "Access-Control-Request-Method: POST" \
      -k 2>&1 | grep -E "^< HTTP|^< Location|^< location"
fi


