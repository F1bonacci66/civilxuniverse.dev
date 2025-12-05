#!/bin/bash
echo "=========================================="
echo "ИСПРАВЛЕНИЕ ПРИОРИТЕТА LOCATION БЛОКОВ"
echo "=========================================="
echo ""

cp /etc/nginx/sites-available/civilxuniverse.ru /etc/nginx/sites-available/civilxuniverse.ru.backup.$(date +%Y%m%d_%H%M%S)

# Проверяем текущую конфигурацию
echo "Текущий порядок location блоков:"
grep -n 'location' /etc/nginx/sites-available/civilxuniverse.ru | head -10

# Используем location = для максимального приоритета (точное совпадение)
cat > /tmp/nginx-fix.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name civilxuniverse.ru www.civilxuniverse.ru;

    # Логи
    access_log /var/log/nginx/civilxuniverse.ru.access.log;
    error_log /var/log/nginx/civilxuniverse.ru.error.log;

    # Увеличенные размеры для загрузки файлов
    client_max_body_size 500M;
    client_body_buffer_size 128k;

    # Таймауты
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;

    # КРИТИЧНО: API endpoints - используем location = для максимального приоритета
    # location = имеет наивысший приоритет и проверяется ПЕРЕД всеми другими location
    
    location = /api/datalab/auth/register/ {
        add_header X-Location-Matched "api-register-slash" always;
        
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
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_redirect off;
        proxy_intercept_errors off;
        proxy_next_upstream off;
    }
    
    location = /api/datalab/auth/register {
        add_header X-Location-Matched "api-register" always;
        
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
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_redirect off;
        proxy_intercept_errors off;
        proxy_next_upstream off;
    }
    
    location = /api/datalab/auth/signup/ {
        add_header X-Location-Matched "api-signup-slash" always;
        
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
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_redirect off;
        proxy_intercept_errors off;
        proxy_next_upstream off;
    }
    
    location = /api/datalab/auth/signup {
        add_header X-Location-Matched "api-signup" always;
        
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
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_redirect off;
        proxy_intercept_errors off;
        proxy_next_upstream off;
    }

    # Все остальные API запросы - используем ^~ для приоритета
    location ^~ /api/datalab/ {
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
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_redirect off;
        proxy_intercept_errors off;
        proxy_next_upstream off;
    }

    # Проксирование на Universe (Next.js) - только для не-API запросов
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        # Заголовки
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # WebSocket поддержка
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Буферизация
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Статические файлы Next.js
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }

    # Favicon и другие статические файлы
    location ~* \.(ico|css|js|gif|jpe?g|png|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF

# Заменяем server блок в конфигурации
python3 << 'PYTHON_EOF'
import re

with open('/etc/nginx/sites-available/civilxuniverse.ru', 'r') as f:
    content = f.read()

# Находим начало и конец server блока
server_start = content.find('server {')
if server_start == -1:
    print("Ошибка: не найден server блок")
    exit(1)

# Находим конец server блока (следующий server или закрывающая скобка на том же уровне)
depth = 0
server_end = server_start
for i in range(server_start, len(content)):
    if content[i] == '{':
        depth += 1
    elif content[i] == '}':
        depth -= 1
        if depth == 0:
            server_end = i + 1
            break

# Читаем новый server блок
with open('/tmp/nginx-fix.conf', 'r') as f:
    new_server = f.read()

# Заменяем server блок
new_content = content[:server_start] + new_server + content[server_end:]

# Убираем лишние пустые строки
new_content = re.sub(r'\n{3,}', '\n\n', new_content)

with open('/etc/nginx/sites-available/civilxuniverse.ru', 'w') as f:
    f.write(new_content)

print("✅ Конфигурация обновлена")
PYTHON_EOF

echo ""
echo "Проверка конфигурации..."
nginx -t && systemctl reload nginx && echo "✅ Nginx перезагружен"

echo ""
echo "Проверка /signup/ (с slash):"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS http://127.0.0.1/api/datalab/auth/signup/ -H "Host: civilxuniverse.ru" -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST")
echo "HTTP Status Code: $STATUS"

if [ "$STATUS" = "204" ]; then
    echo "✅ УСПЕХ! /signup/ работает!"
else
    echo "❌ Статус: $STATUS"
fi

echo ""
echo "Проверка POST /signup/:"
STATUS2=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1/api/datalab/auth/signup/ -H "Host: civilxuniverse.ru" -H "Content-Type: application/json" -d '{"name":"Test","email":"test@test.com","password":"test123"}')
echo "HTTP Status Code: $STATUS2"

if [ "$STATUS2" = "422" ] || [ "$STATUS2" = "201" ]; then
    echo "✅ Запрос доходит до FastAPI (422/201 - это нормально)"
else
    echo "❌ Статус: $STATUS2"
fi

echo ""
echo "Проверка заголовка X-Location-Matched:"
HEADER=$(curl -s -I -X POST http://127.0.0.1/api/datalab/auth/signup/ -H "Host: civilxuniverse.ru" -H "Content-Type: application/json" -d '{"name":"Test","email":"test@test.com","password":"test123"}' | grep -i "X-Location-Matched")
if [ -n "$HEADER" ]; then
    echo "✅ $HEADER"
else
    echo "❌ Заголовок X-Location-Matched не найден - запрос не попал в нужный location блок!"
fi


