# Инструкция по копированию и выполнению скрипта

## Шаг 1: Скопировать скрипт на сервер

В PowerShell выполните:
```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
scp fix-cors-location.sh root@95.163.230.61:/tmp/
```

## Шаг 2: Подключиться к серверу и выполнить скрипт

В PowerShell выполните:
```powershell
ssh root@95.163.230.61
```

На сервере выполните:
```bash
chmod +x /tmp/fix-cors-location.sh
bash /tmp/fix-cors-location.sh
```

Скрипт проверит заголовок Location и применит исправление.



