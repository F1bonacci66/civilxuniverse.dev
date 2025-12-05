# 🔄 Обновление и деплой

Инструкции по обновлению файлов на сервере и деплою изменений.

## 📋 Содержание

1. [Обновление Frontend](#обновление-frontend)
2. [Обновление Backend](#обновление-backend)
3. [Проверка после обновления](#проверка-после-обновления)
4. [Автоматизация](#автоматизация)

## 🎨 Обновление Frontend

### Вариант 1: Обновление из Docker Registry (рекомендуется)

#### Шаг 1: Сборка и загрузка образа (локально)

```powershell
# Перейти в директорию проекта
cd C:\Projects\CivilX\Site\civilx-website\universe\universe

# Собрать Docker образ
.\scripts\build-docker.ps1

# Загрузить в GitHub Container Registry
.\scripts\push-to-ghcr.ps1
```

#### Шаг 2: Обновление на сервере

```bash
# Подключиться к серверу
ssh root@95.163.230.61

# Перейти в директорию проекта
cd /opt/civilx-universe

# Войти в GHCR (если нужно)
source .env
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin

# Загрузить новый образ
docker-compose pull

# Перезапустить контейнер
docker-compose up -d

# Проверить статус
docker-compose ps
docker-compose logs -f universe
```

### Вариант 2: Быстрое обновление (скрипт)

**На сервере:**

```bash
# Использовать скрипт автоматического обновления
cd /opt/civilx-universe
./scripts/update-frontend.sh
```

## 🔧 Обновление Backend

### Шаг 1: Копирование файлов на сервер

**С локальной машины (PowerShell):**

```powershell
# Перейти в директорию backend
cd C:\Projects\CivilX\Site\civilx-website\backend

# Использовать скрипт копирования
.\scripts\copy-backend.ps1

# Или вручную скопировать конкретные файлы
scp app/models/upload.py root@95.163.230.61:/opt/civilx-backend/app/models/upload.py
scp app/models/pivot.py root@95.163.230.61:/opt/civilx-backend/app/models/pivot.py
scp app/main.py root@95.163.230.61:/opt/civilx-backend/app/main.py
```

### Шаг 2: Перезапуск Backend

**На сервере:**

```bash
# Остановить backend
pkill -f uvicorn

# Подождать 2 секунды
sleep 2

# Перезапустить backend
cd /opt/civilx-backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &

# Проверить статус
sleep 3
ps aux | grep uvicorn
curl http://localhost:8000/health
```

### Шаг 3: Обновление базы данных (если нужно)

Если изменились модели:

```bash
# Удалить старую БД (⚠️ ВНИМАНИЕ: удалит все данные!)
rm -f /opt/civilx-backend/data/civilx_universe.db

# Перезапустить backend - таблицы создадутся автоматически
pkill -f uvicorn
cd /opt/civilx-backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

## ✅ Проверка после обновления

### Проверка Frontend

```bash
# Health check
curl http://localhost:3001/api/health

# Статус контейнера
docker-compose ps

# Логи
docker-compose logs --tail=50 universe
```

### Проверка Backend

```bash
# Health check
curl http://localhost:8000/health

# API проверка
curl http://localhost:8000/api/datalab/projects?limit=5&offset=0

# Логи
tail -50 /opt/civilx-backend/backend.log
```

### Проверка связи Frontend ↔ Backend

```bash
# Из контейнера frontend
docker exec civilx-universe curl http://host.docker.internal:8000/health

# Извне
curl -H "Origin: http://95.163.230.61:3001" http://95.163.230.61:8000/api/datalab/projects
```

### Полная проверка (скрипт)

**На сервере:**

```bash
# Использовать скрипт проверки
cd /opt/civilx-universe
./scripts/check-status.sh
```

## 🤖 Автоматизация

### Скрипт автоматического обновления Frontend

Создать файл `scripts/update-frontend.sh` на сервере:

```bash
#!/bin/bash
cd /opt/civilx-universe

echo "=== Обновление Frontend ==="

# Загрузить переменные окружения
source .env

# Войти в GHCR
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin

# Загрузить новый образ
docker-compose pull

# Перезапустить контейнер
docker-compose up -d

# Проверить статус
sleep 5
docker-compose ps

echo "✅ Обновление завершено!"
```

Сделать исполняемым:
```bash
chmod +x scripts/update-frontend.sh
```

### Скрипт автоматического обновления Backend

Создать файл `scripts/update-backend.sh` на сервере:

```bash
#!/bin/bash
cd /opt/civilx-backend

echo "=== Обновление Backend ==="

# Остановить backend
pkill -f uvicorn
sleep 2

# Перезапустить
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &

# Проверить статус
sleep 5
ps aux | grep uvicorn
curl http://localhost:8000/health

echo "✅ Обновление завершено!"
```

### Cron job для автоматической проверки обновлений

```bash
# Редактировать crontab
crontab -e

# Добавить строку (проверка каждый день в 3:00)
0 3 * * * /opt/civilx-universe/scripts/update-frontend.sh >> /var/log/universe-update.log 2>&1
```

## 📝 Чек-лист обновления

- [ ] Собрать новый Docker образ (frontend)
- [ ] Загрузить образ в GHCR
- [ ] Скопировать обновленные файлы backend на сервер
- [ ] Обновить frontend на сервере
- [ ] Перезапустить backend на сервере
- [ ] Проверить health check обоих сервисов
- [ ] Проверить работу API
- [ ] Проверить связь frontend ↔ backend
- [ ] Проверить логи на наличие ошибок

## 🔗 Связанные документы

- [DEPLOYMENT.md](DEPLOYMENT.md) - Полное руководство по деплою
- [QUICK_DEPLOY.md](QUICK_DEPLOY.md) - Быстрый деплой
- [../../troubleshooting/TROUBLESHOOTING.md](../../troubleshooting/TROUBLESHOOTING.md) - Решение проблем




