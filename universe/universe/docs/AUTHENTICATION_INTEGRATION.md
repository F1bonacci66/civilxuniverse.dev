# Интеграция авторизации между civilx.ru и civilxuniverse.ru

## Обзор

Реализована единая система авторизации между `civilx.ru` и `civilxuniverse.ru` с использованием JWT токенов.

## Архитектура

### 1. Маппинг пользователей

Создана таблица `user_mapping` в PostgreSQL для связи MySQL user_id (INT) с PostgreSQL user_id (UUID):

```sql
CREATE TABLE user_mapping (
    id UUID PRIMARY KEY,
    mysql_user_id INTEGER UNIQUE NOT NULL,
    postgres_user_id UUID UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 2. Передача токена между доменами

**Механизм**: URL параметр + localStorage

1. При переходе с `civilx.ru` на `civilxuniverse.ru` токен передается через URL:
   ```
   https://civilxuniverse.ru/app/datalab?token=JWT_TOKEN&user=USER_DATA
   ```

2. Frontend обрабатывает токен из URL и сохраняет в localStorage
3. При последующих запросах токен берется из localStorage

### 3. Backend аутентификация

- JWT токены верифицируются с использованием того же секрета, что и в PHP
- MySQL user_id из токена автоматически маппится в PostgreSQL UUID через `user_mapping`
- Все API endpoints требуют авторизации (кроме публичных)

## Настройка

### 1. Backend (.env)

```env
# JWT секрет (должен совпадать с PHP)
JWT_SECRET_KEY=your_super_secret_jwt_key_for_php

# MySQL подключение для чтения пользователей
MYSQL_HOST=localhost
MYSQL_DATABASE=u3279080_CivilX_users
MYSQL_USER=u3279080_civilx_user
MYSQL_PASSWORD=!Grosheva78
```

### 2. Создание таблицы маппинга

Выполните SQL скрипт:
```bash
psql -U postgres -d civilx_universe -f database/create-user-mapping-table.sql
```

### 3. Обновление auth-api.php

После успешной авторизации на `civilx.ru`, при редиректе на `civilxuniverse.ru` нужно передать токен:

```php
// После успешного логина/регистрации
$redirectUrl = 'https://civilxuniverse.ru/app/datalab';
$redirectUrl .= '?token=' . urlencode($token);
$redirectUrl .= '&user=' . urlencode(json_encode($user));

header('Location: ' . $redirectUrl);
exit;
```

## Использование

### Frontend

```typescript
import { isAuthenticated, getAuthToken, getUser } from '@/lib/api/auth'

// Проверка авторизации
if (isAuthenticated()) {
  const token = getAuthToken()
  const user = getUser()
  // ...
}
```

### API запросы

Все API функции автоматически добавляют токен в заголовки:

```typescript
import { getProjects } from '@/lib/api/projects'

// Токен автоматически добавляется в заголовок Authorization
const projects = await getProjects()
```

## Безопасность

1. **JWT токены** имеют срок действия 24 часа
2. **HTTPS** обязателен для production
3. **CORS** настроен только для разрешенных доменов
4. **Проверка прав доступа** на всех endpoints

## Миграция существующих данных

Если у вас уже есть проекты с `created_by = "00000000-0000-0000-0000-000000000000"`, их нужно будет связать с реальными пользователями через маппинг.




