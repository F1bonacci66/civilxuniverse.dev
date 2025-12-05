# 🚀 Применение настройки домена civilxuniverse.ru

## Быстрое выполнение (скопируйте и выполните на сервере)

### Шаг 1: Подключитесь к серверу

```bash
ssh root@95.163.230.61
# Пароль: 7LfOgcrTvZxbMR9Y
```

### Шаг 2: Выполните скрипт настройки

```bash
# Скачать скрипт (выполните на локальной машине)
# Или скопируйте содержимое setup-domain.sh и создайте файл на сервере

# На сервере выполните:
bash /root/setup-domain.sh
```

### Или выполните команды вручную:

```bash
# 1. Найти директорию Universe
cd /opt/civilx-universe/universe

# 2. Создать резервную копию
cp next.config.mjs next.config.mjs.backup.$(date +%Y%m%d_%H%M%S)

# 3. Обновить конфигурацию
sed -i "s|basePath: '/Universe',|// basePath: '/Universe',|g" next.config.mjs
sed -i "s|assetPrefix: '/Universe',|// assetPrefix: '/Universe',|g" next.config.mjs

# 4. Проверить изменения
grep -A 1 "basePath\|assetPrefix" next.config.mjs

# 5. Пересобрать Docker
cd /opt/civilx-universe
docker-compose down
docker-compose build --no-cache universe
docker-compose up -d

# 6. Проверить статус
docker-compose ps
docker-compose logs --tail=20 universe

# 7. Проверить доступность
curl http://localhost:3001/
```

### Шаг 3: Настроить .htaccess

Найдите корневую директорию домена civilxuniverse.ru и создайте/обновите .htaccess:

```bash
# Найти директорию домена
find /home -type d -name "public_html" 2>/dev/null
find /var/www -type d -name "civilxuniverse.ru" 2>/dev/null

# Создать .htaccess (замените /path/to/domain на актуальный путь)
nano /path/to/domain/.htaccess
```

Скопируйте содержимое из файла `.htaccess.civilxuniverse` (из локального проекта).

### Шаг 4: Включить модули Apache

```bash
a2enmod proxy proxy_http rewrite headers deflate expires
systemctl reload apache2
```

### Шаг 5: Проверить работу

```bash
curl http://civilxuniverse.ru/
```

## Готово! 🎉

Universe теперь доступен по адресу: **http://civilxuniverse.ru/**




