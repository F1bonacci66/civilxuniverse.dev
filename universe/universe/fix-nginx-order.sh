#!/bin/bash
echo "=========================================="
echo "ИСПРАВЛЕНИЕ ПОРЯДКА LOCATION БЛОКОВ"
echo "=========================================="
echo ""

cp /etc/nginx/sites-available/civilxuniverse.ru /etc/nginx/sites-available/civilxuniverse.ru.backup.$(date +%Y%m%d_%H%M%S)

# Создаем новую конфигурацию с правильным порядком location блоков
cat > /etc/nginx/sites-available/civilxuniverse.ru << 'NGINX_EOF'
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

    # КРИТИЧНО: API endpoints - location = имеет наивысший приоритет
    # Должны быть ПЕРЕД location /api/datalab/ и ПЕРЕД location /
    
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

    # Все остальные API запросы
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

echo "✅ Конфигурация обновлена"
nginx -t && systemctl reload nginx && echo "✅ Nginx перезагружен"

echo ""
echo "Проверка:"
curl -s -I -X POST http://127.0.0.1/api/datalab/auth/signup/ \
  -H "Host: civilxuniverse.ru" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123"}' \
  | grep -E 'HTTP|X-Location-Matched|server'

echo ""
echo "Проверка через внешний домен:"
curl -s -I -X POST http://civilxuniverse.ru/api/datalab/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123"}' \
  | grep -E 'HTTP|X-Location-Matched|server'


