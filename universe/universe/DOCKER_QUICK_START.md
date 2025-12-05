# 🐳 Быстрый старт с Docker

## Production окружение

### 1. Подготовка

```bash
cd civilx-website/universe/universe

# Создайте .env файл (см. ENV_EXAMPLE.md)
# Минимальная конфигурация:
# PORT=3001
# NODE_ENV=production
# NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
```

### 2. Запуск

```bash
# Собрать и запустить
docker-compose up -d --build

# Проверить статус
docker-compose ps

# Просмотр логов
docker-compose logs -f universe
```

### 3. Проверка

- Приложение доступно: http://localhost:3001
- Health check: http://localhost:3001/api/health
- Проверить health status: `docker-compose ps`

## Development окружение

### 1. Подготовка

```bash
cd civilx-website/universe/universe

# Создайте .env файл для development:
# PORT=3001
# NODE_ENV=development
# NEXT_PUBLIC_API_URL=http://localhost:8000/api/datalab
```

### 2. Запуск

```bash
# Запустить с hot reload
docker-compose -f docker-compose.dev.yml up -d --build

# Просмотр логов
docker-compose -f docker-compose.dev.yml logs -f universe
```

### 3. Разработка

- Изменения в коде автоматически перезагружаются
- Приложение доступно: http://localhost:3001
- Логи в реальном времени: `docker-compose -f docker-compose.dev.yml logs -f`

## Полезные команды

```bash
# Остановить контейнер
docker-compose down

# Перезапустить контейнер
docker-compose restart universe

# Пересобрать образ
docker-compose build --no-cache universe

# Просмотр использования ресурсов
docker stats civilx-universe

# Войти в контейнер
docker exec -it civilx-universe sh

# Очистить неиспользуемые образы
docker image prune -a
```

## Устранение проблем

### Контейнер не запускается

```bash
# Проверить логи
docker-compose logs universe

# Проверить, что порт не занят
netstat -ano | findstr :3001  # Windows
lsof -i :3001  # Linux/Mac
```

### Health check не проходит

```bash
# Проверить health endpoint вручную
curl http://localhost:3001/api/health

# Проверить статус health check
docker inspect civilx-universe | grep -A 10 Health
```

### Проблемы с hot reload в development

```bash
# Убедитесь, что volumes правильно смонтированы
docker-compose -f docker-compose.dev.yml config

# Пересоздать контейнер
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d --build
```

## Архитектура

- **Multi-stage build**: Оптимизированный размер образа
- **Health checks**: Автоматический мониторинг состояния
- **Resource limits**: Контроль использования CPU и памяти
- **Non-root user**: Безопасность контейнера
- **Custom network**: Изоляция сервисов

Подробнее см. `DOCKER_BUILD.md` и `docker-rules.mdc` в `.cursor/rules/`






