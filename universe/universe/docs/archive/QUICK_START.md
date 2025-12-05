# Быстрый старт Frontend

## 1. Создать .env.local файл

В PowerShell:

```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
Set-Content -Path .env.local -Value "NEXT_PUBLIC_API_URL=http://localhost:8000/api/datalab" -Encoding UTF8
```

Или вручную:
- Создайте файл `.env.local` в директории `universe/universe/`
- Добавьте строку: `NEXT_PUBLIC_API_URL=http://localhost:8000/api/datalab`

## 2. Убедиться, что backend запущен

```powershell
cd C:\Projects\CivilX\Site\civilx-website\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

Backend должен быть доступен на http://localhost:8000

## 3. Запустить frontend

```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
npm run dev
```

Frontend будет доступен на http://localhost:3000 (или 3001)

## 4. Открыть страницу загрузки

Откройте в браузере:
- http://localhost:3000/app/datalab/upload

## Проверка

1. Выберите проект и версию
2. Загрузите файл (RVT, IFC или CSV)
3. Проверьте консоль браузера (F12) - не должно быть ошибок
4. Файл должен появиться в списке после загрузки

## Если что-то не работает

### Ошибка: "NEXT_PUBLIC_API_URL is not defined"

**Решение:** Убедитесь, что файл `.env.local` создан в правильной директории (`universe/universe/`)

### Ошибка CORS

**Решение:** 
1. Проверьте `CORS_ORIGINS` в `backend/.env`
2. Убедитесь, что URL frontend добавлен в список
3. Перезапустите backend

### Backend не отвечает

**Решение:**
1. Проверьте, что backend запущен
2. Откройте http://localhost:8000/docs - должен открыться Swagger UI
3. Проверьте логи backend



