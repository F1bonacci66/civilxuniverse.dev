# Инструкция по применению исправленной конфигурации Nginx

## Проблема
Редирект 308 для OPTIONS запросов (CORS preflight) блокирует регистрацию.

## Решение
Исправленная конфигурация Nginx обрабатывает OPTIONS запросы ДО редиректа.

## Шаги применения

### 1. Скопируйте файлы на сервер

```powershell
# Из директории C:\Projects\CivilX\Site\civilx-website\universe\universe

scp api_nginx_fixed.conf root@95.163.230.61:/root/
scp apply-nginx-fix.sh root@95.163.230.61:/root/
```

**Пароль:** `7LfOgcrTvZxbMR9Y`

### 2. Подключитесь к серверу

```powershell
ssh root@95.163.230.61
```

**Пароль:** `7LfOgcrTvZxbMR9Y`

### 3. Примените конфигурацию

```bash
cd /root
chmod +x apply-nginx-fix.sh
./apply-nginx-fix.sh
```

Скрипт автоматически:
- Проверит синтаксис конфигурации
- Создаст резервную копию текущей конфигурации
- Применит новую конфигурацию
- Перезагрузит Nginx
- Протестирует OPTIONS запрос

### 4. Проверьте результат

Откройте в браузере:
- http://civilxuniverse.ru/auth/register
- Откройте DevTools (F12) -> Network
- Попробуйте зарегистрироваться
- Проверьте, что OPTIONS запрос возвращает статус 204 (не 308)

## Альтернативный способ (если скрипт не работает)

```bash
# 1. Резервная копия
sudo cp /etc/nginx/sites-available/api.civilx.ru /etc/nginx/sites-available/api.civilx.ru.backup

# 2. Копирование новой конфигурации
sudo cp /root/api_nginx_fixed.conf /etc/nginx/sites-available/api.civilx.ru

# 3. Проверка синтаксиса
sudo nginx -t

# 4. Перезагрузка Nginx
sudo systemctl reload nginx

# 5. Проверка статуса
sudo systemctl status nginx
```

## Что исправлено

1. ✅ Убраны дублирующиеся location блоки
2. ✅ Добавлена обработка OPTIONS на HTTP (порт 80) ДО редиректа на HTTPS
3. ✅ Используются точные location (=) для auth endpoints (максимальный приоритет)
4. ✅ `proxy_http_version 1.1` добавлен во все proxy_pass блоки

## Проверка работы

```bash
# Тест OPTIONS запроса
curl -X OPTIONS -I -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://api.civilx.ru/api/datalab/auth/register

# Должен вернуть:
# HTTP/2 204
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
# ...
```

## Откат (если что-то пошло не так)

```bash
sudo cp /etc/nginx/sites-available/api.civilx.ru.backup /etc/nginx/sites-available/api.civilx.ru
sudo nginx -t
sudo systemctl reload nginx
```




