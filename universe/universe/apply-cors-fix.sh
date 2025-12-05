#!/bin/bash
# Финальное исправление CORS 308 редиректа

echo "🔧 Применение исправлений..."

# 1. Обновляем Nginx конфигурацию
cat > /etc/nginx/sites-available/api.civilx.ru << 'EOF'
server {
    listen 80;
    server_name api.civilx.ru;
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

        rewrite ^(/api/.*)/$ $1 break;

        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_redirect off;
    }

    location = /api/datalab/health {
        default_type application/json;
        add_header Content-Type "application/json";
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;
        return 200 '{"status":"healthy","message":"Backend is running"}';
        access_log off;
    }

    location = /api/datalab/health/ {
        default_type application/json;
        add_header Content-Type "application/json";
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
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_redirect off;
    }
}
EOF

# 2. Проверяем и перезагружаем Nginx
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
else
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi

# 3. Перезапускаем backend
cd /opt/civilx-backend
pkill -f 'uvicorn.*app.main:app' 2>/dev/null
sleep 2

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

if command -v uvicorn &> /dev/null; then
    nohup uvicorn app.main:app --host 127.0.0.1 --port 8000 > backend.log 2>&1 &
elif [ -f "venv/bin/uvicorn" ]; then
    nohup venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 > backend.log 2>&1 &
fi

sleep 3

# 4. Проверяем результат
echo ""
echo "🔍 Проверка OPTIONS запроса:"
curl -s -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H 'Origin: http://civilxuniverse.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -k -I 2>&1 | head -10

echo ""
echo "✅ Готово!"




