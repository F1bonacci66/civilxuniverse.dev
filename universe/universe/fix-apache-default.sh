#!/bin/bash
# Исправление дефолтного VirtualHost в Apache
set -e

echo "========================================"
echo "Исправление дефолтного VirtualHost"
echo "========================================"
echo ""

# Проверка дефолтного VirtualHost
DEFAULT_CONFIG="/etc/apache2/vhosts-default/95-163-230-61.regru.cloud.conf"

if [ -f "$DEFAULT_CONFIG" ]; then
    echo "Найден дефолтный VirtualHost: $DEFAULT_CONFIG"
    echo "Создание резервной копии..."
    cp "$DEFAULT_CONFIG" "$DEFAULT_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    
    echo "Настройка дефолтного VirtualHost для проксирования на Universe..."
    cat > "$DEFAULT_CONFIG" << 'APACHEEOF'
<VirtualHost *:8080>
    ServerName 95-163-230-61.regru.cloud
    ServerAlias www.95-163-230-61.regru.cloud
    ServerAlias 192.168.0.166
    
    # Проксирование на Universe
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/
    
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-Host %{HTTP_HOST}s
    RequestHeader set X-Real-IP %{REMOTE_ADDR}s
</VirtualHost>
APACHEEOF
    
    echo "Дефолтный VirtualHost обновлен"
else
    echo "Дефолтный VirtualHost не найден"
fi

# Проверка конфигурации для civilxuniverse.ru
CIVILX_CONFIG="/etc/apache2/vhosts/www-root/civilxuniverse.ru.conf"

if [ -f "$CIVILX_CONFIG" ]; then
    echo ""
    echo "Проверка конфигурации для civilxuniverse.ru..."
    
    # Убеждаемся, что конфигурация правильная
    if ! grep -q "ProxyPass" "$CIVILX_CONFIG"; then
        echo "Обновление конфигурации для civilxuniverse.ru..."
        cat > "$CIVILX_CONFIG" << 'APACHEEOF'
<VirtualHost *:8080>
    ServerName civilxuniverse.ru
    ServerAlias www.civilxuniverse.ru
    
    # Логи
    ErrorLog /var/log/apache2/civilxuniverse.ru.error.log
    CustomLog /var/log/apache2/civilxuniverse.ru.access.log combined
    
    # Проксирование на Universe
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/
    
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-Host "civilxuniverse.ru"
    RequestHeader set X-Real-IP %{REMOTE_ADDR}s
</VirtualHost>
APACHEEOF
        echo "Конфигурация обновлена"
    else
        echo "Конфигурация уже правильная"
    fi
fi

# Проверка конфигурации
echo ""
echo "Проверка конфигурации Apache..."
if apache2ctl configtest 2>&1; then
    echo "Конфигурация корректна"
else
    echo "ОШИБКА: Конфигурация содержит ошибки!"
    exit 1
fi

# Перезагрузка Apache
echo ""
echo "Перезагрузка Apache..."
systemctl reload apache2

if systemctl is-active --quiet apache2; then
    echo "Apache перезагружен"
else
    echo "ОШИБКА: Apache не запустился!"
    exit 1
fi

echo ""
echo "========================================"
echo "Готово!"
echo "========================================"
echo ""
echo "Проверка работы..."
sleep 2

# Проверка через localhost
if curl -s -H "Host: civilxuniverse.ru" http://localhost:8080/ | grep -q "CivilX.Universe"; then
    echo "Universe работает через Apache!"
else
    echo "Проверьте логи: tail -f /var/log/apache2/civilxuniverse.ru.error.log"
fi

echo ""




