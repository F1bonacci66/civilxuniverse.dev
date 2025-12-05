#!/bin/bash
# Применение исправления CORS на сервере

echo "🔍 Создание резервной копии..."
cp /etc/nginx/sites-available/api.civilx.ru /etc/nginx/sites-available/api.civilx.ru.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup created"

echo ""
echo "🔧 Применение новой конфигурации..."
cp /tmp/nginx-api-config.conf /etc/nginx/sites-available/api.civilx.ru

echo ""
echo "🔍 Проверка синтаксиса конфигурации..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация валидна. Перезагрузка Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "⏳ Ожидание 2 секунды..."
    sleep 2
    
    echo ""
    echo "🔍 Проверка после исправления:"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://api.civilx.ru/api/datalab/auth/register -H "Origin: http://civilxuniverse.ru" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" -k)
    echo "HTTP Status Code: $STATUS"
    
    if [ "$STATUS" = "204" ]; then
        echo "✅ Успех! OPTIONS запрос возвращает 204 (No Content), редиректа нет!"
    else
        echo "❌ Проблема! Статус код: $STATUS (ожидался 204)"
    fi
    
    echo ""
    echo "✅ Готово! Проверьте работу регистрации в браузере."
else
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi
