# 📦 Копирование Backend на сервер

## Проблема

Ошибка `ModuleNotFoundError: No module named 'app'` означает, что код backend не скопирован на сервер.

## Решение: Скопировать код на сервер

### Вариант 1: Через SCP (рекомендуется)

**На локальной машине (PowerShell):**

```powershell
# Копировать директорию app
scp -r C:\Projects\CivilX\Site\civilx-website\backend\app root@95.163.230.61:/opt/civilx-backend/

# Копировать requirements.txt (если еще не скопирован)
scp C:\Projects\CivilX\Site\civilx-website\backend\requirements.txt root@95.163.230.61:/opt/civilx-backend/

# При запросе введите пароль: 7LfOgcrTvZxbMR9Y
```

### Вариант 2: Создать архив и загрузить

**На локальной машине:**

```powershell
cd C:\Projects\CivilX\Site\civilx-website\backend

# Создать архив (если есть tar)
tar -czf backend.tar.gz app requirements.txt

# Или использовать 7-Zip
7z a backend.tar.gz app requirements.txt

# Загрузить на сервер
scp backend.tar.gz root@95.163.230.61:/opt/civilx-backend/
```

**На сервере:**

```bash
cd /opt/civilx-backend
tar -xzf backend.tar.gz
```

### Вариант 3: Через Git (если репозиторий доступен)

**На сервере:**

```bash
cd /opt
git clone https://github.com/F1bonacci66/civilx.univers.git
# Или если репозиторий приватный:
# git clone git@github.com:F1bonacci66/civilx.univers.git

# Скопировать backend
cp -r civilx.univers/backend/* /opt/civilx-backend/
```

### Вариант 4: Вручную через WinSCP или FileZilla

1. Подключитесь к серверу через WinSCP/FileZilla
2. Перейдите в `/opt/civilx-backend/`
3. Загрузите:
   - Директорию `app/` (со всем содержимым)
   - Файл `requirements.txt`

## После копирования

**На сервере:**

```bash
cd /opt/civilx-backend

# Проверить структуру
ls -la
# Должны быть:
# - app/
# - requirements.txt
# - venv/

# Проверить структуру app
ls -la app/
# Должны быть:
# - main.py
# - api/
# - core/
# - models/
# - schemas/
# - services/

# Активировать venv
source venv/bin/activate

# Запустить backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Проверка работы

**На сервере:**

```bash
# В другом терминале
curl http://localhost:8000/health
curl http://localhost:8000/docs
```

**С локальной машины:**

```bash
curl http://95.163.230.61:8000/health
```

## Если все еще ошибки

### Проверить структуру директорий

```bash
cd /opt/civilx-backend
tree -L 3
# или
find . -type f -name "*.py" | head -20
```

### Проверить импорты

```bash
cd /opt/civilx-backend
source venv/bin/activate
python3 -c "import sys; sys.path.insert(0, '.'); from app.main import app; print('OK')"
```

### Проверить права доступа

```bash
chmod -R 755 /opt/civilx-backend/app
```




