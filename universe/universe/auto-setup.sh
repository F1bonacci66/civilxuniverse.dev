#!/bin/bash
# Автоматическая настройка домена civilxuniverse.ru
# Использует expect для автоматического ввода пароля

set -e

SERVER="root@95.163.230.61"
PASSWORD="7LfOgcrTvZxbMR9Y"

echo "========================================"
echo "Настройка домена civilxuniverse.ru"
echo "========================================"
echo ""

# Функция для выполнения команд через SSH с автоматическим вводом пароля
ssh_exec() {
    local cmd="$1"
    expect << EOF
set timeout 300
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $SERVER "$cmd"
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    eof
}
EOF
}

# Функция для выполнения интерактивных команд
ssh_interactive() {
    local cmd="$1"
    expect << EOF
set timeout 300
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $SERVER
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    "# " {
        send "$cmd\r"
        expect "# "
        send "exit\r"
        expect eof
    }
}
EOF
}

echo "[1/6] Поиск директории Universe..."
UNIVERSE_DIR=$(ssh_exec "find /opt -type d -name 'universe' 2>/dev/null | head -1" | grep -v "password:" | grep -v "spawn" | grep -v "^$" | tail -1 | tr -d '\r\n')

if [ -z "$UNIVERSE_DIR" ] || [ "$UNIVERSE_DIR" = "" ]; then
    echo "❌ Директория не найдена автоматически, используем стандартный путь"
    UNIVERSE_DIR="/opt/civilx-universe/universe"
fi

echo "✅ Используется директория: $UNIVERSE_DIR"
echo ""

echo "[2/6] Обновление next.config.mjs..."
UPDATE_CMD="cd $UNIVERSE_DIR && \
cp next.config.mjs next.config.mjs.backup.\$(date +%Y%m%d_%H%M%S) && \
sed -i \"s|basePath: '/Universe',|// basePath: '/Universe',|g\" next.config.mjs && \
sed -i \"s|assetPrefix: '/Universe',|// assetPrefix: '/Universe',|g\" next.config.mjs && \
echo '✅ Конфигурация обновлена' && \
grep -A 1 'basePath\|assetPrefix' next.config.mjs | head -4"

ssh_exec "$UPDATE_CMD" | grep -v "password:" | grep -v "spawn"
echo ""

echo "[3/6] Пересборка Docker образа..."
REBUILD_CMD="cd \$(dirname $UNIVERSE_DIR) && \
if [ -f docker-compose.prod.yml ]; then COMPOSE_FILE='docker-compose.prod.yml'; else COMPOSE_FILE='docker-compose.yml'; fi && \
echo \"Используется файл: \$COMPOSE_FILE\" && \
docker-compose -f \$COMPOSE_FILE down && \
docker-compose -f \$COMPOSE_FILE build --no-cache universe && \
docker-compose -f \$COMPOSE_FILE up -d && \
echo '✅ Docker пересобран'"

ssh_exec "$REBUILD_CMD" | grep -v "password:" | grep -v "spawn"
echo ""

echo "[4/6] Ожидание запуска контейнера..."
sleep 15

echo "[5/6] Проверка статуса..."
STATUS_CMD="cd \$(dirname $UNIVERSE_DIR) && \
if [ -f docker-compose.prod.yml ]; then COMPOSE_FILE='docker-compose.prod.yml'; else COMPOSE_FILE='docker-compose.yml'; fi && \
docker-compose -f \$COMPOSE_FILE ps && \
echo '' && \
docker-compose -f \$COMPOSE_FILE logs --tail=10 universe"

ssh_exec "$STATUS_CMD" | grep -v "password:" | grep -v "spawn"
echo ""

echo "[6/6] Проверка доступности..."
sleep 5
if ssh_exec "curl -s http://localhost:3001/ > /dev/null && echo 'OK'" | grep -q "OK"; then
    echo "✅ Приложение доступно на http://localhost:3001/"
else
    echo "⚠️  Приложение еще запускается, подождите немного"
fi

echo ""
echo "========================================"
echo "✅ Настройка Universe завершена!"
echo "========================================"
echo ""
echo "Следующие шаги:"
echo "1. Найдите корневую директорию домена civilxuniverse.ru"
echo "2. Создайте .htaccess с содержимым из .htaccess.civilxuniverse"
echo "3. Включите модули Apache: a2enmod proxy proxy_http rewrite headers deflate expires"
echo "4. Перезагрузите Apache: systemctl reload apache2"
echo ""




