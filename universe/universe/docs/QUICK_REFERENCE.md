# ⚡ Быстрая справка

Краткая справка по основным операциям с проектом CivilX.Universe.

## 🚀 Быстрые команды

### Локальная разработка

```bash
# Установка
npm install

# Запуск
npm run dev

# Сборка
npm run build
```

### Docker

```powershell
# Сборка образа
.\scripts\build-docker.ps1

# Загрузка в GHCR
.\scripts\push-to-ghcr.ps1
```

### Деплой на сервер

```bash
# Обновление frontend
cd /opt/civilx-universe
source .env
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin
docker-compose pull
docker-compose up -d

# Обновление backend
cd /opt/civilx-backend
pkill -f uvicorn
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

## 🔗 Полезные ссылки

- **Frontend**: http://95.163.230.61:3001
- **Backend API**: http://95.163.230.61:8000
- **API Docs**: http://95.163.230.61:8000/docs
- **GitHub Registry**: ghcr.io/f1bonacci66/civilx-universe

## 📁 Основные директории

- `app/` - Next.js приложение
- `components/` - React компоненты
- `lib/` - Утилиты и API клиенты
- `docs/` - Документация
- `scripts/` - Скрипты автоматизации

## 🐛 Быстрое решение проблем

### Frontend не работает
```bash
docker-compose logs universe
docker-compose restart universe
```

### Backend не работает
```bash
ps aux | grep uvicorn
tail -50 /opt/civilx-backend/backend.log
pkill -f uvicorn
# Перезапустить (см. выше)
```

### Проблемы с API
- Проверить `NEXT_PUBLIC_API_URL` в `.env`
- Проверить CORS настройки в backend
- Проверить, что backend запущен

## 📚 Полная документация

См. [README.md](README.md) для полной документации.




