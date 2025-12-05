# Применение исправления CORS на сервере

## Проблема
Ошибка: "Redirect is not allowed for a preflight request" при регистрации.

## Решение

### Вариант 1: Автоматическое применение (рекомендуется)

1. **Скопировать скрипт на сервер:**

```powershell
# С локальной машины
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
scp apply-cors-fix-on-server.sh root@95.163.230.61:/tmp/
```

2. **Подключиться к серверу и выполнить скрипт:**

```bash
# Подключиться к серверу
ssh root@95.163.230.61
# Пароль: 7LfOgcrTvZxbMR9Y

# Выполнить скрипт
chmod +x /tmp/apply-cors-fix-on-server.sh
bash /tmp/apply-cors-fix-on-server.sh
```

### Вариант 2: Ручное применение

1. **Подключиться к серверу:**

```bash
ssh root@95.163.230.61
# Пароль: 7LfOgcrTvZxbMR9Y
```

2. **Создать резервную копию:**

```bash
cp /etc/nginx/sites-available/api.civilx.ru /etc/nginx/sites-available/api.civilx.ru.backup.$(date +%Y%m%d_%H%M%S)
```

3. **Скопировать новую конфигурацию:**

```powershell
# С локальной машины
scp nginx-api-config.conf root@95.163.230.61:/tmp/
```

4. **Применить конфигурацию на сервере:**

```bash
cp /tmp/nginx-api-config.conf /etc/nginx/sites-available/api.civilx.ru
nginx -t
systemctl reload nginx
```

5. **Проверить:**

```bash
curl -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H "Origin: http://civilxuniverse.ru" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -k -I
```

Должен вернуть статус **204**, а не 301/308.

## Проверка результата

После применения исправления:

1. Откройте браузер
2. Перейдите на `http://civilxuniverse.ru/auth/register`
3. Попробуйте зарегистрироваться
4. Ошибка CORS должна исчезнуть

## Откат изменений (если что-то пошло не так)

```bash
# Найти резервную копию
ls -la /etc/nginx/sites-available/api.civilx.ru.backup.*

# Восстановить
cp /etc/nginx/sites-available/api.civilx.ru.backup.XXXXXXXX_XXXXXX /etc/nginx/sites-available/api.civilx.ru
nginx -t
systemctl reload nginx
```



