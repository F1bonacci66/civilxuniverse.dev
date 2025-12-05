# Решение проблемы: Frontend не запускается

## Симптомы
- Порт 3001 не отвечает
- Страница http://localhost:3001/app/datalab/upload недоступна

## Решение

### 1. Запустите frontend в отдельном терминале

```powershell
# Откройте новый терминал PowerShell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
npm run dev
```

**Важно:** Запускайте в отдельном терминале, не в том же, где запущен backend!

### 2. Проверьте, что frontend запустился

После запуска вы должны увидеть:
```
▲ Next.js 14.2.33
- Local:        http://localhost:3001
- Environments: .env.local

✓ Starting...
✓ Ready in 5s
```

### 3. Если есть ошибки при запуске

**Ошибка: "Cannot find module"**
```powershell
npm install
```

**Ошибка: "Port 3001 already in use"**
```powershell
# Убить процесс на порту 3001
netstat -ano | findstr :3001
# Затем убить процесс по PID
taskkill /PID <PID> /F

# Или запустить на другом порту
npm run dev -- -p 3002
```

**Ошибка: "Missing dependencies"**
```powershell
npm install
npm run dev
```

### 4. После успешного запуска

1. Откройте браузер
2. Перейдите на http://localhost:3001
3. Должна открыться главная страница
4. Затем перейдите на http://localhost:3001/app/datalab/upload

## Проверка

После запуска frontend должен быть доступен на:
- http://localhost:3001 - главная страница
- http://localhost:3001/app/datalab/upload - страница загрузки

Если страница все еще не открывается, проверьте:
1. Консоль браузера (F12) - там будут ошибки
2. Терминал, где запущен frontend - там будут ошибки компиляции
3. Убедитесь, что backend запущен на http://localhost:8000



