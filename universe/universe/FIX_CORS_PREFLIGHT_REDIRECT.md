# Исправление ошибки CORS: Redirect is not allowed for a preflight request

## Проблема

При попытке зарегистрироваться в Universe возникает ошибка:
```
Access to fetch at 'https://api.civilx.ru/api/datalab/auth/register' from origin 'http://civilxuniverse.ru' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
Redirect is not allowed for a preflight request.
```

## Причина

Браузер отправляет preflight OPTIONS запрос перед основным POST запросом. Nginx или FastAPI делают редирект для этого OPTIONS запроса, что запрещено спецификацией CORS. Preflight запросы должны возвращать статус 200 или 204 без редиректов.

## Решение

### 1. Применить исправление конфигурации Nginx

На сервере выполните:

```bash
# Подключитесь к серверу
ssh root@95.163.230.61

# Перейдите в директорию проекта
cd /path/to/universe/universe

# Сделайте скрипт исполняемым
chmod +x fix-cors-preflight-redirect.sh

# Запустите скрипт
./fix-cors-preflight-redirect.sh
```

Или вручную скопируйте конфигурацию из `fix-cors-preflight-redirect.sh` в `/etc/nginx/sites-available/api.civilx.ru` и перезагрузите nginx:

```bash
nginx -t
systemctl reload nginx
```

### 2. Проверка исправления

После применения исправления проверьте:

```bash
# Проверка OPTIONS запроса
curl -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H 'Origin: http://civilxuniverse.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type' \
  -k -I

# Должен вернуть:
# HTTP/2 204
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
# Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With
```

**Важно**: Статус код должен быть **204**, а не 301 или 308.

### 3. Проверка в браузере

1. Откройте консоль разработчика (F12)
2. Перейдите на страницу регистрации: `http://civilxuniverse.ru/auth/register`
3. Попробуйте зарегистрироваться
4. Проверьте, что ошибка CORS исчезла

### 4. Если проблема сохраняется

#### Проверьте логи Nginx:
```bash
tail -f /var/log/nginx/api.civilx.ru.error.log
tail -f /var/log/nginx/api.civilx.ru.access.log
```

#### Проверьте, что backend запущен:
```bash
ps aux | grep uvicorn
curl http://127.0.0.1:8000/api/datalab/health
```

#### Проверьте CORS настройки в FastAPI:
Убедитесь, что в `backend/app/main.py` включены правильные origins:
- `http://civilxuniverse.ru`
- `https://civilxuniverse.ru`
- `http://www.civilxuniverse.ru`
- `https://www.civilxuniverse.ru`

#### Проверьте, что FastAPI не делает редиректы:
В `backend/app/main.py` должно быть:
```python
app = FastAPI(
    ...
    redirect_slashes=False,  # Отключаем автоматический редирект на trailing slash
)
```

## Ключевые моменты исправления

1. **OPTIONS запросы обрабатываются ДО proxy_pass** - это предотвращает редиректы от backend
2. **Используется `return 204`** вместо редиректа для OPTIONS запросов
3. **Точные location блоки** для auth endpoints с максимальным приоритетом
4. **`proxy_redirect off`** отключает автоматические редиректы от backend
5. **`rewrite ... break`** убирает trailing slash без редиректа

## Дополнительная информация

- [MDN: CORS preflight requests](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
- [Nginx: Handling CORS preflight requests](https://enable-cors.org/server_nginx.html)



