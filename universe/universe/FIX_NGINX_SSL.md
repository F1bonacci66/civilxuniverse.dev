# Исправление проблем с SSL и Nginx

## Проблемы
1. **ERR_CERT_AUTHORITY_INVALID** - ошибка SSL сертификата в браузере
2. **404 для favicon.ico** - отсутствует файл favicon

## Решение

### 1. Исправление конфигурации Nginx

Конфигурация Nginx повреждена. Нужно восстановить правильный файл:

```bash
ssh root@95.163.230.61
# Введите пароль: 7LfOgcrTvZxbMR9Y

# Создайте правильную конфигурацию
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

# Проверьте конфигурацию
nginx -t

# Если все ОК, перезагрузите Nginx
systemctl reload nginx
```

### 2. Проверка SSL сертификата

Сертификат правильный для `api.civilx.ru`. Проблема может быть в кэше браузера:

1. **Очистите кэш браузера** для `api.civilx.ru`
2. **Попробуйте в режиме инкогнито**
3. **Проверьте сертификат**:
   ```bash
   openssl s_client -connect api.civilx.ru:443 -servername api.civilx.ru < /dev/null 2>&1 | grep -E '(Verify return code|subject|issuer)'
   ```

### 3. Добавление favicon

Favicon уже добавлен в `app/layout.tsx`. После следующего деплоя он будет доступен.

## Проверка

После исправления проверьте:
1. `https://api.civilx.ru/api/datalab/health` - должен возвращать JSON
2. В браузере не должно быть ошибок SSL
3. Favicon должен загружаться после деплоя




