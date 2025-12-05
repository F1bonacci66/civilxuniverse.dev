# ✅ Финальная настройка домена civilxuniverse.ru

## Что уже сделано:

1. ✅ Обновлен `next.config.mjs` (убран basePath)
2. ✅ Docker контейнер пересобран и запущен
3. ✅ Universe работает на порту 3001

## Автоматическая настройка Nginx:

### Вариант 1: Выполнить скрипт на сервере

1. Скопируйте файл `NGINX_SETUP_COMPLETE.sh` на сервер:
   ```bash
   scp NGINX_SETUP_COMPLETE.sh root@95.163.230.61:/root/
   ```

2. Подключитесь к серверу и выполните:
   ```bash
   ssh root@95.163.230.61
   bash /root/NGINX_SETUP_COMPLETE.sh
   ```

### Вариант 2: Выполнить команды вручную

Подключитесь к серверу и выполните:

```bash
ssh root@95.163.230.61

# Установить Nginx (если не установлен)
apt-get update && apt-get install -y nginx

# Создать конфигурацию
cat > /etc/nginx/sites-available/civilxuniverse.ru << 'EOF'
server {
    listen 80;
    server_name civilxuniverse.ru www.civilxuniverse.ru;

    access_log /var/log/nginx/civilxuniverse.ru.access.log;
    error_log /var/log/nginx/civilxuniverse.ru.error.log;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
    }
}
EOF

# Активировать конфигурацию
ln -sf /etc/nginx/sites-available/civilxuniverse.ru /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверить и перезагрузить
nginx -t
systemctl restart nginx
systemctl enable nginx
```

## Готово! 🎉

После выполнения скрипта домен `http://civilxuniverse.ru` будет работать автоматически.

## Проверка:

```bash
curl http://civilxuniverse.ru/
```

Должен вернуться HTML код страницы Universe.

## После установки SSL:

Обновите конфигурацию Nginx для HTTPS (добавьте блок server с listen 443 и редирект с HTTP на HTTPS).




