# Исправление проблемы CORS 308 редиректа

## Проблема
```
Access to fetch at 'https://api.civilx.ru/api/datalab/auth/register' from origin 'http://civilxuniverse.ru' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
Redirect is not allowed for a preflight request.
```

## Причина
Nginx делает редирект 308 для OPTIONS запросов (CORS preflight), что запрещено спецификацией CORS.

## Решение

### 1. Конфигурация Nginx обновлена
Файл `/etc/nginx/sites-available/api.civilx.ru` обновлен для обработки OPTIONS запросов без редиректа.

### 2. CORS origins обновлены
В `app/main.py` добавлены:
- `http://civilxuniverse.ru`
- `https://civilxuniverse.ru`
- `http://www.civilxuniverse.ru`
- `https://www.civilxuniverse.ru`

### 3. Проверка

После применения исправлений проверьте:

```bash
# Проверка OPTIONS запроса
curl -X OPTIONS https://api.civilx.ru/api/datalab/auth/register \
  -H 'Origin: http://civilxuniverse.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type' \
  -k -I

# Должен вернуть HTTP 204, а не 308
```

### 4. Если проблема сохраняется

Проверьте логи Nginx:
```bash
tail -f /var/log/nginx/api.civilx.ru.error.log
```

Убедитесь, что backend запущен:
```bash
ps aux | grep uvicorn
```

## Статус
✅ Конфигурация Nginx обновлена
✅ CORS origins добавлены
✅ Backend должен быть перезапущен




