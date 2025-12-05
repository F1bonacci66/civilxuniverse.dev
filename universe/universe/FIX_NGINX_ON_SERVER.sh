#!/bin/bash
# Скрипт для исправления конфигурации Nginx на сервере

echo "Копирование исправленной конфигурации..."
cp /tmp/api_nginx_fixed.conf /etc/nginx/sites-available/api.civilx.ru

echo "Проверка конфигурации..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация валидна. Перезагрузка Nginx..."
    systemctl reload nginx
    echo "✅ Nginx успешно перезагружен!"
    
    echo ""
    echo "Проверка работы API..."
    curl -I https://api.civilx.ru/api/datalab/health
else
    echo "❌ Ошибка в конфигурации. Проверьте файл вручную."
    exit 1
fi




