#!/bin/bash
# ИСПРАВЛЕНИЕ: Проверка и исправление на уровне http блока nginx.conf

echo "=========================================="
echo "ИСПРАВЛЕНИЕ CORS 308 НА УРОВНЕ HTTP БЛОКА"
echo "=========================================="
echo ""

echo "ШАГ 1: Проверка основного nginx.conf"
echo "--------------------------------------------------------"
if [ -f /etc/nginx/nginx.conf ]; then
    echo "✅ Файл nginx.conf найден"
    echo ""
    echo "Проверяем настройки http блока:"
    grep -A 5 "^http {" /etc/nginx/nginx.conf | head -10
    echo ""
    echo "Проверяем настройки, которые могут влиять на редиректы:"
    grep -E "merge_slashes|absolute_redirect|server_name_in_redirect|port_in_redirect" /etc/nginx/nginx.conf
else
    echo "❌ Файл nginx.conf не найден"
    exit 1
fi

echo ""
echo "ШАГ 2: Создание резервной копии"
echo "--------------------------------------------------------"
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Резервная копия создана"

echo ""
echo "ШАГ 3: Добавление настроек в http блок (если их нет)"
echo "--------------------------------------------------------"
# Проверяем, есть ли уже эти настройки
if ! grep -q "merge_slashes off" /etc/nginx/nginx.conf; then
    echo "Добавляем merge_slashes off в http блок..."
    sed -i '/^http {/a\    merge_slashes off;' /etc/nginx/nginx.conf
fi

if ! grep -q "absolute_redirect off" /etc/nginx/nginx.conf; then
    echo "Добавляем absolute_redirect off в http блок..."
    sed -i '/^http {/a\    absolute_redirect off;' /etc/nginx/nginx.conf
fi

if ! grep -q "server_name_in_redirect off" /etc/nginx/nginx.conf; then
    echo "Добавляем server_name_in_redirect off в http блок..."
    sed -i '/^http {/a\    server_name_in_redirect off;' /etc/nginx/nginx.conf
fi

echo "✅ Настройки добавлены в http блок"

echo ""
echo "ШАГ 4: Обновление конфигурации api.civilx.ru с правильной обработкой OPTIONS"
echo "--------------------------------------------------------"

# Создаем резервную копию
cp /etc/nginx/sites-available/api.civilx.ru /etc/nginx/sites-available/api.civilx.ru.backup.$(date +%Y%m%d_%H%M%S)

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

    # КРИТИЧНО: Отключаем автоматическое добавление trailing slash
    merge_slashes off;
    absolute_redirect off;

    # КРИТИЧНО: Обработка OPTIONS для register БЕЗ trailing slash
    # Используем точное совпадение (=) - наивысший приоритет
    location = /api/datalab/auth/register {
        # Обрабатываем OPTIONS запросы ПЕРВЫМ ДЕЛОМ
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }
        
        # Для остальных методов - проксируем с явным путем БЕЗ trailing slash
        proxy_pass http://127.0.0.1:8000/api/datalab/auth/register;
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
    
    # Обработка для /api/datalab/auth/register/ С trailing slash
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
        proxy_intercept_errors off;
        proxy_next_upstream off;
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
        proxy_pass http://127.0.0.1:8000/api/datalab/auth/login;
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
        proxy_pass http://127.0.0.1:8000/api/datalab/auth/me;
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
        proxy_pass http://127.0.0.1:8000/api/datalab/auth/change-password;
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

    # Общий location для остальных API запросов
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

echo ""
echo "ШАГ 5: Проверка синтаксиса"
echo "--------------------------------------------------------"
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Синтаксис правильный. Перезагрузка nginx..."
    systemctl reload nginx
    sleep 2
    
    echo ""
    echo "🔍 Тест после исправления:"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/register -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -k)
    echo "HTTP Status Code: $STATUS"
    
    if [ "$STATUS" = "204" ]; then
        echo "✅ УСПЕХ! OPTIONS запрос возвращает 204!"
    else
        echo "❌ Все еще проблема. Статус: $STATUS"
        echo ""
        echo "Проверка заголовков:"
        curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
          -H "Origin: http://civilxuniverse.ru" \
          -H "Access-Control-Request-Method: POST" \
          -k 2>&1 | grep -E "^< HTTP|^< Location|Access-Control"
        echo ""
        echo "Проверяем настройки http блока:"
        grep -A 10 "^http {" /etc/nginx/nginx.conf | head -15
    fi
else
    echo "❌ Ошибка в конфигурации"
    echo "Восстанавливаем резервную копию..."
    cp /etc/nginx/nginx.conf.backup.* /etc/nginx/nginx.conf
    exit 1
fi



