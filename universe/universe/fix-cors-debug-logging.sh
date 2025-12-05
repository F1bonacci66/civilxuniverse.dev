#!/bin/bash
# Детальное логирование для диагностики проблемы 308

echo "=========================================="
echo "ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ CORS 308"
echo "=========================================="
echo ""

echo "ШАГ 1: Включаем debug логирование в nginx"
echo "--------------------------------------------------------"
# Проверяем текущий уровень логирования
grep -E "error_log|access_log" /etc/nginx/nginx.conf | head -5
echo ""

echo "ШАГ 2: Проверяем текущую конфигурацию api.civilx.ru"
echo "--------------------------------------------------------"
echo "Проверяем, какой location блок будет обрабатывать /api/datalab/auth/register:"
echo ""
echo "Все location блоки в порядке их обработки nginx:"
grep -n "location" /etc/nginx/sites-available/api.civilx.ru | grep -v "^#"
echo ""

echo "ШАГ 3: Проверяем, что происходит при запросе"
echo "--------------------------------------------------------"
echo "Тест 1: OPTIONS запрос на /api/datalab/auth/register (БЕЗ trailing slash)"
curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -k 2>&1 | tee /tmp/curl-test1.txt
echo ""

echo "ШАГ 4: Анализ ответа"
echo "--------------------------------------------------------"
echo "HTTP статус:"
grep "< HTTP" /tmp/curl-test1.txt
echo ""
echo "Заголовок Location:"
grep -i "location:" /tmp/curl-test1.txt
echo ""

echo "ШАГ 5: Проверка access логов nginx в реальном времени"
echo "--------------------------------------------------------"
echo "Последние 3 запроса к /api/datalab/auth/register:"
tail -3 /var/log/nginx/api.civilx.ru.access.log | grep "auth/register"
echo ""

echo "ШАГ 6: Проверка error логов nginx"
echo "--------------------------------------------------------"
echo "Последние ошибки:"
tail -10 /var/log/nginx/api.civilx.ru.error.log
echo ""

echo "ШАГ 7: Проверка, какой location блок обрабатывает запрос"
echo "--------------------------------------------------------"
echo "Создаем тестовый запрос и смотрим логи:"
# Очищаем логи
echo "" > /var/log/nginx/api.civilx.ru.access.log
echo "" > /var/log/nginx/api.civilx.ru.error.log

# Делаем запрос
curl -s -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -k > /dev/null

sleep 1

echo "Access log после запроса:"
cat /var/log/nginx/api.civilx.ru.access.log
echo ""

echo "Error log после запроса:"
cat /var/log/nginx/api.civilx.ru.error.log
echo ""

echo "ШАГ 8: Проверка конфигурации - может быть проблема в proxy_pass"
echo "--------------------------------------------------------"
echo "Проверяем location = /api/datalab/auth/register:"
grep -A 25 "location = /api/datalab/auth/register" /etc/nginx/sites-available/api.civilx.ru
echo ""

echo "ШАГ 9: Проверка, может быть FastAPI делает редирект"
echo "--------------------------------------------------------"
echo "Тест FastAPI напрямую:"
curl -v -X OPTIONS http://127.0.0.1:8000/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  2>&1 | grep -E "< HTTP|< Location"
echo ""

echo "ШАГ 10: Проверка, может быть проблема в том, что nginx добавляет trailing slash"
echo "--------------------------------------------------------"
echo "Проверяем настройки nginx для автоматического добавления trailing slash:"
grep -i "merge_slashes\|absolute_redirect" /etc/nginx/nginx.conf
grep -i "merge_slashes\|absolute_redirect" /etc/nginx/sites-available/api.civilx.ru
echo ""

echo "ШАГ 11: Проверка основного nginx.conf"
echo "--------------------------------------------------------"
echo "Проверяем, есть ли глобальные настройки, которые могут влиять:"
grep -E "server_tokens|absolute_redirect|merge_slashes" /etc/nginx/nginx.conf
echo ""

echo "ШАГ 12: Детальная проверка заголовков ответа"
echo "--------------------------------------------------------"
echo "Все заголовки ответа:"
curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -k 2>&1 | grep "^<"
echo ""

echo "=========================================="
echo "АНАЛИЗ"
echo "=========================================="
echo ""
echo "Если редирект 308 происходит, это означает, что:"
echo "1. Либо nginx сам делает редирект (добавляет trailing slash)"
echo "2. Либо FastAPI делает редирект, и nginx его перехватывает"
echo "3. Либо есть другой location блок, который обрабатывает запрос"
echo ""
echo "РЕШЕНИЕ: Применяем конфигурацию, которая точно обработает OPTIONS ДО любого редиректа"
echo ""

# Создаем конфигурацию с максимальным логированием
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
    error_log /var/log/nginx/api.civilx.ru.error.log debug;

    # КРИТИЧНО: Отключаем автоматическое добавление trailing slash
    merge_slashes off;
    absolute_redirect off;

    # КРИТИЧНО: Точное совпадение для /api/datalab/auth/register БЕЗ trailing slash
    # Это должно обработать запрос ПЕРЕД любыми редиректами
    location = /api/datalab/auth/register {
        # Обрабатываем OPTIONS запросы ПЕРВЫМ ДЕЛОМ, БЕЗ proxy_pass
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            add_header Access-Control-Max-Age "3600" always;
            add_header Content-Type "text/plain charset=UTF-8" always;
            add_header Content-Length "0" always;
            return 204;
        }
        
        # Для остальных методов - проксируем с явным путем
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

echo "✅ Конфигурация обновлена с debug логированием"
echo ""
echo "🔍 Проверка синтаксиса..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Синтаксис правильный. Перезагрузка nginx..."
    systemctl reload nginx
    sleep 2
    
    echo ""
    echo "🔍 Тест после исправления:"
    echo "Очищаем логи и делаем тестовый запрос..."
    echo "" > /var/log/nginx/api.civilx.ru.access.log
    echo "" > /var/log/nginx/api.civilx.ru.error.log
    
    curl -s -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
      -H "Origin: http://civilxuniverse.ru" \
      -H "Access-Control-Request-Method: POST" \
      -k > /dev/null
    
    sleep 1
    
    echo ""
    echo "Access log:"
    cat /var/log/nginx/api.civilx.ru.access.log
    echo ""
    echo "Error log (debug):"
    tail -50 /var/log/nginx/api.civilx.ru.error.log | grep -E "auth/register|OPTIONS|location" | head -20
    echo ""
    
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/register -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -k)
    echo "HTTP Status Code: $STATUS"
    
    if [ "$STATUS" = "204" ]; then
        echo "✅ УСПЕХ! OPTIONS запрос возвращает 204!"
    else
        echo "❌ Все еще проблема. Статус: $STATUS"
        echo ""
        echo "Детальная проверка:"
        curl -v -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
          -H "Origin: http://civilxuniverse.ru" \
          -H "Access-Control-Request-Method: POST" \
          -k 2>&1 | grep -E "^< HTTP|^< Location"
    fi
else
    echo "❌ Ошибка в конфигурации"
    exit 1
fi

echo ""
echo "=========================================="
echo "ДИАГНОСТИКА ЗАВЕРШЕНА"
echo "=========================================="
echo ""
echo "Для просмотра логов в реальном времени:"
echo "  tail -f /var/log/nginx/api.civilx.ru.error.log"
echo "  tail -f /var/log/nginx/api.civilx.ru.access.log"



