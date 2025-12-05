# Применение детального логирования для диагностики CORS

## Выполните на сервере:

```powershell
# 1. Скопировать скрипт
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
scp fix-cors-debug-logging.sh root@95.163.230.61:/tmp/
```

```bash
# 2. На сервере
chmod +x /tmp/fix-cors-debug-logging.sh
bash /tmp/fix-cors-debug-logging.sh
```

Скрипт выполнит:
1. Включит debug логирование в nginx
2. Проверит текущую конфигурацию
3. Сделает тестовые запросы
4. Покажет access и error логи
5. Применит исправленную конфигурацию с `merge_slashes off` и `absolute_redirect off`
6. Покажет детальные логи после исправления

Это поможет понять, где именно происходит редирект 308.



