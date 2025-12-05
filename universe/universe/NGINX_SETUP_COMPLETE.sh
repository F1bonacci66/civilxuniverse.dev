#!/bin/bash
# Полная автоматическая настройка Nginx для домена civilxuniverse.ru
# Выполните на сервере: bash NGINX_SETUP_COMPLETE.sh

set -e

echo "========================================"
echo "Настройка Nginx для civilxuniverse.ru"
echo "========================================"
echo ""

# Проверка наличия Nginx
if ! command -v nginx &> /dev/null; then
    echo "[1/5] Установка Nginx..."
    if command -v apt-get &> /dev/null; then
        apt-get update -qq
        apt-get install -y nginx
    elif command -v yum &> /dev/null; then
        yum install -y nginx
    else
        echo "❌ Не удалось определить менеджер пакетов"
        exit 1
    fi
    echo "✅ Nginx установлен"
else
    echo "[1/5] Nginx уже установлен"
fi

echo ""

# Создание конфигурации Nginx
echo "[2/5] Создание конфигурации Nginx..."

NGINX_CONFIG="/etc/nginx/sites-available/civilxuniverse.ru"

# Если директория sites-available не существует (CentOS/RHEL), используем conf.d
if [ ! -d "/etc/nginx/sites-available" ]; then
    NGINX_CONFIG="/etc/nginx/conf.d/civilxuniverse.ru.conf"
    mkdir -p /etc/nginx/conf.d
fi

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

echo "✅ Конфигурация создана: $NGINX_CONFIG"

# Создание символической ссылки (для Debian/Ubuntu)
if [ -d "/etc/nginx/sites-available" ] && [ -d "/etc/nginx/sites-enabled" ]; then
    echo "[3/5] Активация конфигурации..."
    ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/civilxuniverse.ru
    # Удаляем default конфигурацию если она конфликтует
    if [ -f "/etc/nginx/sites-enabled/default" ]; then
        rm -f /etc/nginx/sites-enabled/default
    fi
    echo "✅ Конфигурация активирована"
else
    echo "[3/5] Конфигурация уже активна (CentOS/RHEL)"
fi

echo ""

# Проверка конфигурации
echo "[4/5] Проверка конфигурации Nginx..."
if nginx -t 2>&1; then
    echo "✅ Конфигурация корректна"
else
    echo "❌ Ошибка в конфигурации"
    exit 1
fi

echo ""

# Перезагрузка Nginx
echo "[5/5] Перезагрузка Nginx..."
systemctl restart nginx
systemctl enable nginx

# Проверка статуса
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx запущен и работает"
else
    echo "❌ Ошибка запуска Nginx"
    systemctl status nginx --no-pager
    exit 1
fi

echo ""
echo "========================================"
echo "✅ Настройка Nginx завершена!"
echo "========================================"
echo ""
echo "Домен настроен:"
echo "  - http://civilxuniverse.ru"
echo "  - http://www.civilxuniverse.ru"
echo ""
echo "Проверка:"
if curl -s http://127.0.0.1/ > /dev/null 2>&1; then
    echo "✅ Nginx отвечает на localhost"
    curl -s http://127.0.0.1/ | head -3
else
    echo "⚠️  Проверьте, что домен указывает на этот сервер"
fi
echo ""
echo "После установки SSL сертификата обновите конфигурацию для HTTPS"
echo ""




