#!/bin/bash
# Исправление проблемы CORS: Redirect is not allowed for a preflight request
# Проблема: OPTIONS запросы получают редирект, что запрещено спецификацией CORS

echo "🔍 Диагностика проблемы CORS preflight redirect..."

# Проверяем текущее состояние
echo ""
echo "1. Проверка OPTIONS запроса через Nginx:"
curl -s -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H 'Origin: http://civilxuniverse.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type' \
  -k -I 2>&1 | head -15

echo ""
echo "2. Проверка FastAPI напрямую:"
curl -s -X OPTIONS http://127.0.0.1:8000/api/datalab/auth/register \
  -H 'Origin: http://civilxuniverse.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type' \
  -I 2>&1 | head -10

echo ""
echo "🔧 Применение исправления..."

# Создаем правильную конфигурацию nginx
cat > /etc/nginx/sites-available/api.civilx.ru << 'EOF'
server {
    listen 80;
    server_name api.civilx.ru;
    
    # КРИТИЧНО: Обрабатываем OPTIONS запросы ДО редиректа на HTTPS
    # Это важно, так как некоторые браузеры могут делать preflight на HTTP
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
    
    # Редирект на HTTPS для всех остальных запросов
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

    # КРИТИЧНО: Обработка OPTIONS запросов (CORS preflight) с максимальным приоритетом
    # Используем точное совпадение для auth endpoints
    location = /api/datalab/auth/register {
        # Обрабатываем OPTIONS запросы БЕЗ редиректа и БЕЗ proxy_pass
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }
        
        # Для остальных методов проксируем на backend
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
        # Обрабатываем OPTIONS запросы БЕЗ редиректа
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }

        # Убираем trailing slash БЕЗ редиректа (break предотвращает дальнейшую обработку)
        rewrite ^(/api/.*)/$ $1 break;

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

    # Health endpoint
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

    # Fallback для всех остальных запросов
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
EOF

# Проверяем конфигурацию
echo ""
echo "🔍 Проверка синтаксиса конфигурации..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация валидна. Перезагрузка Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "⏳ Ожидание 2 секунды для применения изменений..."
    sleep 2
    
    echo ""
    echo "🔍 Проверка после исправления:"
    echo ""
    echo "1. OPTIONS запрос на /api/datalab/auth/register:"
    curl -s -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
      -H 'Origin: http://civilxuniverse.ru' \
      -H 'Access-Control-Request-Method: POST' \
      -H 'Access-Control-Request-Headers: Content-Type' \
      -k -I 2>&1 | head -15
    
    echo ""
    echo "2. Проверка статуса кода (должен быть 204, а не 301/308):"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
      -H 'Origin: http://civilxuniverse.ru' \
      -H 'Access-Control-Request-Method: POST' \
      -H 'Access-Control-Request-Headers: Content-Type' \
      -k)
    echo "HTTP Status Code: $STATUS"
    
    if [ "$STATUS" = "204" ]; then
        echo "✅ Успех! OPTIONS запрос возвращает 204 (No Content), редиректа нет!"
    else
        echo "❌ Проблема! Статус код: $STATUS (ожидался 204)"
    fi
    
    echo ""
    echo "✅ Готово! Проверьте работу регистрации в браузере."
else
    echo "❌ Ошибка в конфигурации Nginx. Проверьте синтаксис."
    exit 1
fi



