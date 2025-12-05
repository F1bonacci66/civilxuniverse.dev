#!/bin/bash
# ФИНАЛЬНОЕ РЕШЕНИЕ: Проверка полного ответа и использование map

echo "=========================================="
echo "ФИНАЛЬНОЕ РЕШЕНИЕ CORS 308"
echo "=========================================="
echo ""

# Сначала проверим полный ответ
echo "1. Проверка полного ответа:"
curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -k 2>&1 | grep -A 2 "HTTP/1.1 308"

echo ""
echo "2. Проверка, куда идет редирект:"
curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -k 2>&1 | grep -i "location:"

echo ""
echo "3. Применение финального решения..."

# Создаем резервную копию
cp /etc/nginx/sites-available/api.civilx.ru /etc/nginx/sites-available/api.civilx.ru.backup.$(date +%Y%m%d_%H%M%S)

# Проверяем, есть ли map в nginx.conf
if ! grep -q "map.*request_method.*OPTIONS" /etc/nginx/nginx.conf; then
    echo "Добавляем map в nginx.conf..."
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # Добавляем map после http {
    sed -i '/^http {/a\    map $request_method $is_options {\n        default 0;\n        OPTIONS 1;\n    }' /etc/nginx/nginx.conf
    echo "✅ Map добавлен"
fi

# Создаем конфигурацию
cat > /etc/nginx/sites-available/api.civilx.ru << 'NGINX_EOF'
server {
    listen 80;
    server_name api.civilx.ru;
    
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

    merge_slashes off;
    absolute_redirect off;

    # КРИТИЧНО: Используем точное совпадение БЕЗ trailing slash
    # и обрабатываем OPTIONS ДО proxy_pass
    location = /api/datalab/auth/register {
        # Обрабатываем OPTIONS ПЕРВЫМ ДЕЛОМ
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }
        
        # Для остальных методов - проксируем БЕЗ URI части
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
    
    # Обработка для версии С trailing slash - возвращаем 204 для OPTIONS
    location = /api/datalab/auth/register/ {
        # Для OPTIONS возвращаем 204
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }
        
        # Для других методов - проксируем БЕЗ trailing slash
        rewrite ^(.+)/$ $1 break;
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
    
    location ~ ^/api/datalab/ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }

        rewrite ^(/api/.*)/$ $1 break;
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_EOF

echo "✅ Конфигурация обновлена"
nginx -t && systemctl reload nginx && echo "✅ Nginx перезагружен"

echo ""
echo "4. Финальная проверка:"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/register -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -k)
echo "HTTP Status Code: $STATUS"

if [ "$STATUS" = "204" ]; then
    echo "✅ УСПЕХ! OPTIONS запрос возвращает 204!"
else
    echo "❌ Все еще проблема. Статус: $STATUS"
    echo ""
    echo "Полный ответ:"
    curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
      -H "Origin: http://civilxuniverse.ru" \
      -H "Access-Control-Request-Method: POST" \
      -k 2>&1 | grep -E "^< HTTP|^< Location|^< location"
fi


