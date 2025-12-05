#!/bin/bash
set -e

echo "🔍 Добавление логирования в Nginx для диагностики"

NGINX_CONFIG="/etc/nginx/sites-available/civilxuniverse.ru"
BACKUP_FILE="/etc/nginx/sites-available/civilxuniverse.ru.backup.$(date +%Y%m%d_%H%M%S)"

# Создаем резервную копию
cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "✅ Резервная копия создана: $BACKUP_FILE"

# Добавляем логирование в location блоки для signup
sed -i '/location = \/api\/datalab\/auth\/signup\/ {/a\
        access_log /var/log/nginx/civilxuniverse.ru.signup.log;\
        error_log /var/log/nginx/civilxuniverse.ru.signup.error.log debug;
' "$NGINX_CONFIG"

sed -i '/location = \/api\/datalab\/auth\/signup {/a\
        access_log /var/log/nginx/civilxuniverse.ru.signup.log;\
        error_log /var/log/nginx/civilxuniverse.ru.signup.error.log debug;
' "$NGINX_CONFIG"

# Добавляем логирование в location / блок
sed -i '/location \/ {/a\
        access_log /var/log/nginx/civilxuniverse.ru.nextjs.log;\
        error_log /var/log/nginx/civilxuniverse.ru.nextjs.error.log debug;
' "$NGINX_CONFIG"

# Проверяем конфигурацию
if nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Конфигурация Nginx корректна"
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
    echo ""
    echo "📋 Теперь логи будут записываться в:"
    echo "   - /var/log/nginx/civilxuniverse.ru.signup.log (для signup запросов)"
    echo "   - /var/log/nginx/civilxuniverse.ru.nextjs.log (для Next.js запросов)"
    echo ""
    echo "🔍 Попробуйте зарегистрироваться в браузере, затем выполните:"
    echo "   tail -5 /var/log/nginx/civilxuniverse.ru.signup.log"
    echo "   tail -5 /var/log/nginx/civilxuniverse.ru.nextjs.log"
else
    echo "❌ Ошибка в конфигурации Nginx"
    nginx -t
    # Восстанавливаем резервную копию
    cp "$BACKUP_FILE" "$NGINX_CONFIG"
    echo "✅ Конфигурация восстановлена из резервной копии"
    exit 1
fi


