# Применение исправления порядка location блоков

## Проблема
Редирект 308 происходит потому, что регулярное выражение `location ~ ^/api/datalab/.*$` может перехватывать запрос раньше точного совпадения.

## Решение
Переместить точные совпадения (`location =`) ПЕРЕД регулярными выражениями.

## Выполните на сервере:

```powershell
# 1. Скопировать скрипт
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
scp fix-cors-order.sh root@95.163.230.61:/tmp/
```

```bash
# 2. На сервере
chmod +x /tmp/fix-cors-order.sh
bash /tmp/fix-cors-order.sh
```

Скрипт:
- Переместит точные совпадения ПЕРЕД регулярными выражениями
- Использует явный путь в proxy_pass БЕЗ trailing slash
- Отключит все редиректы



