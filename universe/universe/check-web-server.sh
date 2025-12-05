#!/bin/bash
# Проверка какой веб-сервер обрабатывает запросы
set -e

echo "========================================"
echo "Проверка веб-серверов"
echo "========================================"
echo ""

echo "[1] Проверка процессов веб-серверов:"
ps aux | grep -E "nginx|apache|httpd" | grep -v grep || echo "Веб-серверы не найдены"
echo ""

echo "[2] Проверка портов 80 и 443:"
netstat -tlnp 2>/dev/null | grep -E ":80 |:443 " || ss -tlnp 2>/dev/null | grep -E ":80 |:443 " || echo "Не удалось проверить порты"
echo ""

echo "[3] Проверка конфигурации Nginx:"
if [ -f "/etc/nginx/nginx.conf" ]; then
    echo "Nginx установлен"
    nginx -t 2>&1 | head -3
else
    echo "Nginx не найден"
fi
echo ""

echo "[4] Проверка конфигурации Apache:"
if [ -f "/etc/apache2/apache2.conf" ] || [ -f "/etc/httpd/httpd.conf" ]; then
    echo "Apache установлен"
    if command -v apache2ctl &> /dev/null; then
        apache2ctl -S 2>&1 | head -10
    elif command -v httpd &> /dev/null; then
        httpd -S 2>&1 | head -10
    fi
else
    echo "Apache не найден"
fi
echo ""

echo "[5] Проверка дефолтной страницы:"
if [ -f "/var/www/html/index.html" ]; then
    echo "Найдена дефолтная страница: /var/www/html/index.html"
    head -5 /var/www/html/index.html
elif [ -f "/usr/share/nginx/html/index.html" ]; then
    echo "Найдена дефолтная страница: /usr/share/nginx/html/index.html"
    head -5 /usr/share/nginx/html/index.html
fi
echo ""

echo "[6] Проверка ответа на localhost:"
curl -s http://localhost/ | head -10
echo ""




