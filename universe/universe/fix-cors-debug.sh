#!/bin/bash
# Диагностика и исправление проблемы CORS 308

echo "🔍 Диагностика проблемы CORS 308..."
echo ""

echo "1. Проверка текущей конфигурации nginx:"
grep -A 5 "location.*auth/register" /etc/nginx/sites-available/api.civilx.ru | head -20
echo ""

echo "2. Проверка OPTIONS запроса напрямую:"
curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -k 2>&1 | grep -E "< HTTP|< Location|Access-Control"
echo ""

echo "3. Проверка, есть ли редирект с trailing slash:"
curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register/ \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -k 2>&1 | grep -E "< HTTP|< Location"
echo ""

echo "4. Проверка логов nginx:"
tail -10 /var/log/nginx/api.civilx.ru.error.log
echo ""

echo "5. Проверка access логов:"
tail -5 /var/log/nginx/api.civilx.ru.access.log | grep OPTIONS
echo ""

echo "🔧 Применение исправленной конфигурации..."

# Создаем исправленную конфигурацию
cat > /etc/nginx/sites-available/api.civilx.ru << 'NGINX_EOF'
server {
    listen 80;
    server_name api.civilx.ru;
    
    # КРИТИЧНО: Обрабатываем OPTIONS запросы ДО редиректа
    location ~ ^/api/datalab/.*$ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }
    }
    
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name api.civilx.ru;

    ssl_certificate /etc/letsencrypt/live/api.civilx.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.civilx.ru/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    access_log /var/log/nginx/api.civilx.ru.access.log;
    error_log /var/log/nginx/api.civilx.ru.error.log;

    # КРИТИЧНО: Обработка OPTIONS для register БЕЗ trailing slash
    location = /api/datalab/auth/register {
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
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
    }
    
    # КРИТИЧНО: Обработка OPTIONS для register С trailing slash
    location = /api/datalab/auth/register/ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:8000/api/datalab/auth/register;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
    }
    
    location = /api/datalab/auth/login {
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
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
    }
    
    location = /api/datalab/auth/me {
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
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
    }
    
    location = /api/datalab/auth/change-password {
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
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
    }

    # Общий location для остальных API запросов
    location ~ ^/api/datalab/.*$ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }

        # НЕ используем rewrite для OPTIONS, так как они уже обработаны выше
        if ($request_method != OPTIONS) {
            rewrite ^(/api/.*)/$ $1 break;
        }

        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location = /api/datalab/health {
        default_type application/json;
        add_header Content-Type "application/json" always;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;
        return 200 '{"status":"healthy","message":"Backend is running"}';
        access_log off;
    }

    location = /api/datalab/health/ {
        default_type application/json;
        add_header Content-Type "application/json" always;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;
        return 200 '{"status":"healthy","message":"Backend is running"}';
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_EOF

echo "✅ Конфигурация обновлена"

echo ""
echo "🔍 Проверка синтаксиса..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Синтаксис правильный. Перезагрузка nginx..."
    systemctl reload nginx
    sleep 2
    
    echo ""
    echo "🔍 Проверка после исправления:"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/register -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" -k)
    echo "HTTP Status Code: $STATUS"
    
    if [ "$STATUS" = "204" ]; then
        echo "✅ УСПЕХ! OPTIONS запрос возвращает 204!"
    else
        echo "❌ Все еще проблема. Статус: $STATUS"
        echo ""
        echo "Детальная проверка:"
        curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -k 2>&1 | grep -E "< HTTP|< Location"
    fi
else
    echo "❌ Ошибка в конфигурации"
    exit 1
fi



