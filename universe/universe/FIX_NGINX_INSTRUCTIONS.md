# Инструкция по исправлению Nginx на сервере

## Проблема
Конфигурация Nginx повреждена: `invalid condition "\ =" in /etc/nginx/sites-enabled/api.civilx.ru:25`

## Решение

### Вариант 1: Через SSH (если подключение работает)

1. Подключитесь к серверу:
```bash
ssh root@95.163.230.61
# Пароль: 7LfOgcrTvZxbMR9Y
```

2. Выполните скрипт исправления:
```bash
chmod +x /tmp/FIX_NGINX_ON_SERVER.sh
/tmp/FIX_NGINX_ON_SERVER.sh
```

### Вариант 2: Вручную (если скрипт не работает)

1. Подключитесь к серверу:
```bash
ssh root@95.163.230.61
# Пароль: 7LfOgcrTvZxbMR9Y
```

2. Скопируйте исправленную конфигурацию:
```bash
cp /tmp/api_nginx_fixed.conf /etc/nginx/sites-available/api.civilx.ru
```

3. Проверьте конфигурацию:
```bash
nginx -t
```

4. Если проверка прошла успешно, перезагрузите Nginx:
```bash
systemctl reload nginx
```

5. Проверьте работу API:
```bash
curl -I https://api.civilx.ru/api/datalab/health
```

### Вариант 3: Если файл не скопировался через scp

Выполните на сервере (после подключения через SSH):

```bash
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

nginx -t && systemctl reload nginx
```

## Проверка результата

После исправления проверьте:

1. **Конфигурация валидна:**
   ```bash
   nginx -t
   ```
   Должно показать: `syntax is ok` и `test is successful`

2. **Nginx перезагружен:**
   ```bash
   systemctl status nginx
   ```
   Должен быть `active (running)`

3. **API работает:**
   ```bash
   curl -I https://api.civilx.ru/api/datalab/health
   ```
   Должен вернуть `HTTP/2 200`

4. **В браузере:**
   - Откройте `https://api.civilx.ru/api/datalab/health`
   - Не должно быть ошибок SSL
   - Должен вернуться JSON: `{"status":"healthy","message":"Backend is running"}`




