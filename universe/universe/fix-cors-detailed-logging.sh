#!/bin/bash
# Детальная диагностика с логированием на каждом этапе

echo "=========================================="
echo "ДЕТАЛЬНАЯ ДИАГНОСТИКА CORS 308"
echo "=========================================="
echo ""

echo "ШАГ 1: Проверка заголовка Location (куда идет редирект)"
echo "--------------------------------------------------------"
curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -k 2>&1 | tee /tmp/curl-output.txt
echo ""

echo "ШАГ 2: Извлечение заголовка Location"
echo "--------------------------------------------------------"
LOCATION=$(grep -i "< Location" /tmp/curl-output.txt | head -1)
echo "Location header: $LOCATION"
echo ""

echo "ШАГ 3: Проверка FastAPI напрямую (без nginx)"
echo "--------------------------------------------------------"
echo "Запрос: curl -v -X OPTIONS http://127.0.0.1:8000/api/datalab/auth/register"
curl -v -X OPTIONS http://127.0.0.1:8000/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  2>&1 | grep -E "< HTTP|< Location|Access-Control"
echo ""

echo "ШАГ 4: Проверка текущей конфигурации nginx"
echo "--------------------------------------------------------"
echo "Все location блоки для /api/datalab/auth/register:"
grep -B 2 -A 15 "location.*auth/register" /etc/nginx/sites-available/api.civilx.ru
echo ""

echo "ШАГ 5: Проверка, какой location блок обрабатывает запрос"
echo "--------------------------------------------------------"
echo "Проверяем порядок location блоков:"
grep -n "location" /etc/nginx/sites-available/api.civilx.ru | head -20
echo ""

echo "ШАГ 6: Проверка access логов nginx"
echo "--------------------------------------------------------"
echo "Последние 5 запросов к /api/datalab/auth/register:"
tail -20 /var/log/nginx/api.civilx.ru.access.log | grep "auth/register" | tail -5
echo ""

echo "ШАГ 7: Проверка error логов nginx"
echo "--------------------------------------------------------"
echo "Последние ошибки:"
tail -10 /var/log/nginx/api.civilx.ru.error.log
echo ""

echo "ШАГ 8: Проверка, может быть проблема в основном nginx.conf"
echo "--------------------------------------------------------"
echo "Проверяем, есть ли редиректы в основном конфиге:"
grep -i "return.*30" /etc/nginx/nginx.conf
echo ""

echo "ШАГ 9: Проверка, может быть проблема в других конфигах"
echo "--------------------------------------------------------"
echo "Проверяем другие конфиги nginx:"
ls -la /etc/nginx/sites-enabled/
echo ""

echo "ШАГ 10: Тест с включенным debug логированием"
echo "--------------------------------------------------------"
echo "Создаем тестовый запрос с полным выводом:"
curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -k 2>&1 | grep -E "^<|^>|Location|HTTP"
echo ""

echo "ШАГ 11: Проверка, может быть проблема в том, что запрос идет на HTTP вместо HTTPS"
echo "--------------------------------------------------------"
echo "Проверка HTTP запроса:"
curl -v -X OPTIONS http://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  2>&1 | grep -E "^< HTTP|^< Location"
echo ""

echo "ШАГ 12: Проверка конфигурации - может быть проблема в server блоке"
echo "--------------------------------------------------------"
echo "Проверяем server блок для HTTPS:"
grep -A 5 "listen 443" /etc/nginx/sites-available/api.civilx.ru | head -10
echo ""

echo "=========================================="
echo "АНАЛИЗ РЕЗУЛЬТАТОВ"
echo "=========================================="
echo ""

# Проверяем статус код
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/register -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -k)
echo "Текущий статус код: $STATUS"

if [ "$STATUS" = "308" ]; then
    echo ""
    echo "❌ ПРОБЛЕМА: Все еще возвращается 308"
    echo ""
    echo "Возможные причины:"
    echo "1. FastAPI делает редирект, и nginx его перехватывает"
    echo "2. Есть другой location блок, который перехватывает запрос"
    echo "3. Проблема в основном nginx.conf"
    echo "4. Проблема в порядке location блоков"
    echo ""
    echo "РЕШЕНИЕ: Применяем исправленную конфигурацию..."
    echo ""
    
    # Создаем конфигурацию, которая точно обработает OPTIONS
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

    # КРИТИЧНО: Обработка OPTIONS для register - ТОЧНОЕ СОВПАДЕНИЕ
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
        
        # Для остальных методов
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_intercept_errors off;
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
        proxy_intercept_errors off;
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
        proxy_intercept_errors off;
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
        proxy_intercept_errors off;
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

    # Общий location для остальных API запросов - В КОНЦЕ
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
    echo "Проверка синтаксиса..."
    nginx -t
    
    if [ $? -eq 0 ]; then
        echo "✅ Синтаксис правильный. Перезагрузка nginx..."
        systemctl reload nginx
        sleep 2
        
        echo ""
        echo "Финальная проверка:"
        NEW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/register -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -k)
        echo "Новый статус код: $NEW_STATUS"
        
        if [ "$NEW_STATUS" = "204" ]; then
            echo "✅ УСПЕХ! OPTIONS запрос возвращает 204!"
        else
            echo "❌ Все еще проблема. Статус: $NEW_STATUS"
            echo ""
            echo "Детальная проверка заголовков:"
            curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
              -H "Origin: http://civilxuniverse.ru" \
              -H "Access-Control-Request-Method: POST" \
              -k 2>&1 | grep -E "^< HTTP|^< Location"
        fi
    else
        echo "❌ Ошибка в конфигурации"
    fi
fi

echo ""
echo "=========================================="
echo "ДИАГНОСТИКА ЗАВЕРШЕНА"
echo "=========================================="



