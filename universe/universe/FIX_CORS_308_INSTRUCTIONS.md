# Инструкция по исправлению CORS 308 редиректа

## Проблема
Nginx делает редирект 308 для OPTIONS запросов (CORS preflight), что блокирует регистрацию.

## Решение

### Шаг 1: Подключитесь к серверу
```bash
ssh root@95.163.230.61
# Пароль: 7LfOgcrTvZxbMR9Y
```

### Шаг 2: Обновите конфигурацию Nginx

Выполните на сервере:

```bash
cat > /etc/nginx/sites-available/api.civilx.ru << 'NGINXEOF'
server {
    listen 80;
    server_name api.civilx.ru;
    return 301 https://$server_name$request_uri;
}

map $request_method $is_options {
    default 0;
    OPTIONS 1;
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

    # КРИТИЧНО: Обработка OPTIONS запросов БЕЗ редиректа
    location ~ ^/api/datalab/.*$ {
        # Если это OPTIONS запрос - возвращаем ответ напрямую БЕЗ редиректа
        if ($is_options) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }

        # Для остальных запросов убираем trailing slash БЕЗ редиректа
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
NGINXEOF
```

### Шаг 3: Проверьте и перезагрузите Nginx

```bash
nginx -t
systemctl reload nginx
```

### Шаг 4: Проверьте результат

```bash
curl -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H 'Origin: http://civilxuniverse.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -k -I
```

**Должен вернуть HTTP 204, а не 308!**

### Шаг 5: Перезапустите backend (если нужно)

```bash
cd /opt/civilx-backend
pkill -f uvicorn
sleep 2
/tmp/start-backend.sh
```

## Ключевое изменение

Используется `map $request_method $is_options` для определения OPTIONS запросов ДО обработки location блоков. Это позволяет обработать OPTIONS без редиректа.




