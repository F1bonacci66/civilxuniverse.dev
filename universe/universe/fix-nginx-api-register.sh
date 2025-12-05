#!/bin/bash
echo "=========================================="
echo "ИСПРАВЛЕНИЕ NGINX ДЛЯ /register и /signup"
echo "=========================================="
echo ""

cp /etc/nginx/sites-available/api.civilx.ru /etc/nginx/sites-available/api.civilx.ru.backup.$(date +%Y%m%d_%H%M%S)

# Читаем текущую конфигурацию и добавляем обработку /register
cat > /tmp/nginx_api_fix.py << 'PYTHON_EOF'
import re

with open('/etc/nginx/sites-available/api.civilx.ru', 'r') as f:
    config = f.read()

# Находим блок server для HTTPS
server_block_pattern = r'(server \{[^}]*listen 443 ssl[^}]*\{[^}]*)(location = /api/datalab/auth/signup/ \{[^}]*\})'

# Создаем блоки для /register
register_slash_block = '''    location = /api/datalab/auth/register/ {
        add_header X-Location-Matched "exact-register-slash" always;
        
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
    
    location = /api/datalab/auth/register {
        add_header X-Location-Matched "exact-register" always;
        
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
    
'''

# Вставляем блоки для /register перед блоком для /signup
if 'location = /api/datalab/auth/register/' not in config:
    # Находим место перед location = /api/datalab/auth/signup/
    pattern = r'(    location = /api/datalab/auth/signup/ \{)'
    config = re.sub(pattern, register_slash_block + r'\1', config, count=1)

with open('/etc/nginx/sites-available/api.civilx.ru', 'w') as f:
    f.write(config)

print("✅ Конфигурация обновлена")
PYTHON_EOF

python3 /tmp/nginx_api_fix.py

echo ""
echo "Проверка синтаксиса:"
nginx -t && systemctl reload nginx && echo "✅ Nginx перезагружен"

echo ""
echo "Проверка /register (без slash):"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/register -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -k)
echo "HTTP Status Code: $STATUS"

if [ "$STATUS" = "204" ]; then
    echo "✅ УСПЕХ! /register работает!"
else
    echo "❌ Статус: $STATUS"
    echo "Проверка полного ответа:"
    curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
      -H "Origin: http://civilxuniverse.ru" \
      -H "Access-Control-Request-Method: POST" \
      -k 2>&1 | grep -E "^< HTTP|^< Location|^< X-Location|^> OPTIONS"
fi


