#!/bin/bash
# Исправление конфигурации Nginx для домена civilxuniverse.ru
set -e

DOMAIN="civilxuniverse.ru"
IP="95.163.230.61"

echo "========================================"
echo "Исправление конфигурации Nginx"
echo "========================================"
echo ""

# Проверка статуса Universe
echo "[1/5] Проверка Universe..."
if docker ps | grep -q universe; then
    echo "Universe работает"
else
    echo "ОШИБКА: Universe не запущен!"
    exit 1
fi

# Проверка доступности Universe
if curl -s http://localhost:3001/ > /dev/null 2>&1; then
    echo "Universe доступен на порту 3001"
else
    echo "ОШИБКА: Universe не отвечает на порту 3001!"
    exit 1
fi

echo ""

# Проверка и создание конфигурации Nginx
echo "[2/5] Проверка конфигурации Nginx..."

NGINX_CONFIG=""
if [ -d "/etc/nginx/sites-available" ]; then
    NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"
    NGINX_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"
elif [ -d "/etc/nginx/conf.d" ]; then
    NGINX_CONFIG="/etc/nginx/conf.d/$DOMAIN.conf"
fi

if [ -z "$NGINX_CONFIG" ]; then
    echo "ОШИБКА: Не найдена директория для конфигурации Nginx"
    exit 1
fi

# Создание/обновление конфигурации
echo "Создание конфигурации: $NGINX_CONFIG"

cat > "$NGINX_CONFIG" << 'NGINXEOF'
server {
    listen 80;
    server_name civilxuniverse.ru www.civilxuniverse.ru;

    # Логи
    access_log /var/log/nginx/civilxuniverse.ru.access.log;
    error_log /var/log/nginx/civilxuniverse.ru.error.log;

    # Увеличенные размеры для загрузки файлов
    client_max_body_size 100M;
    client_body_buffer_size 128k;

    # Таймауты
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;

    # Проксирование на Universe
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        
        # Заголовки
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # WebSocket поддержка
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Буферизация
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Статические файлы Next.js
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }

    # Favicon и другие статические файлы
    location ~* \.(ico|css|js|gif|jpe?g|png|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

echo "Конфигурация создана"

# Активация конфигурации (для Debian/Ubuntu)
if [ -d "/etc/nginx/sites-enabled" ]; then
    echo "[3/5] Активация конфигурации..."
    ln -sf "$NGINX_CONFIG" "$NGINX_ENABLED"
    # Удаляем default если он конфликтует
    if [ -f "/etc/nginx/sites-enabled/default" ]; then
        rm -f /etc/nginx/sites-enabled/default
    fi
    echo "Конфигурация активирована"
else
    echo "[3/5] Конфигурация уже активна (CentOS/RHEL)"
fi

echo ""

# Проверка конфигурации
echo "[4/5] Проверка конфигурации Nginx..."
if nginx -t 2>&1; then
    echo "Конфигурация корректна"
else
    echo "ОШИБКА: Конфигурация содержит ошибки!"
    exit 1
fi

echo ""

# Перезагрузка Nginx
echo "[5/5] Перезагрузка Nginx..."
systemctl restart nginx
systemctl enable nginx

if systemctl is-active --quiet nginx; then
    echo "Nginx перезагружен и работает"
else
    echo "ОШИБКА: Nginx не запустился!"
    systemctl status nginx --no-pager
    exit 1
fi

echo ""
echo "========================================"
echo "Готово!"
echo "========================================"
echo ""
echo "Проверка работы:"
sleep 2
if curl -s -H "Host: $DOMAIN" http://localhost/ | head -5; then
    echo ""
    echo "Сайт должен работать по адресу: http://$DOMAIN"
else
    echo "Проверьте логи: tail -f /var/log/nginx/civilxuniverse.ru.error.log"
fi
echo ""




