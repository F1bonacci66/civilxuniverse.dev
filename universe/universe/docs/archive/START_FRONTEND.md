# Запуск Frontend

## Проверка перед запуском

1. Убедитесь, что вы в правильной директории:
   ```powershell
   cd C:\Projects\CivilX\Site\civilx-website\universe\universe
   ```

2. Проверьте, что `.env.local` файл существует:
   ```powershell
   Test-Path .env.local
   ```
   Если файл не существует, создайте его:
   ```powershell
   Set-Content -Path .env.local -Value "NEXT_PUBLIC_API_URL=http://localhost:8000/api/datalab" -Encoding UTF8
   ```

3. Проверьте, что зависимости установлены:
   ```powershell
   npm install
   ```

## Запуск

```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
npm run dev
```

Frontend будет доступен на:
- http://localhost:3001 (или 3000, если 3001 занят)

## После запуска

1. Откройте браузер
2. Перейдите на http://localhost:3001
3. Должна открыться главная страница
4. Затем перейдите на http://localhost:3001/app/datalab/upload

## Если не запускается

1. Проверьте, что порт не занят:
   ```powershell
   Test-NetConnection localhost -Port 3001
   ```

2. Проверьте логи в терминале - там будут ошибки, если что-то не так

3. Попробуйте запустить на другом порту:
   ```powershell
   npm run dev -- -p 3002
   ```

4. Проверьте, что все зависимости установлены:
   ```powershell
   npm install
   ```



