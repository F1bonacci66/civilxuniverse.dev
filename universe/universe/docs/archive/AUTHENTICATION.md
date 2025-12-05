# 🔐 Аутентификация: SSH ключ vs Personal Access Token

## Разница между SSH ключом и PAT

### SSH ключ (`C:\Users\dimag\.ssh\Universe`)
**Используется для:**
- ✅ Git операции (клонирование, push, pull)
- ✅ Работа с репозиторием кода

**Пример:**
```bash
git clone git@github.com:F1bonacci66/civilx.univers.git
git push origin main
```

### Personal Access Token (PAT)
**Используется для:**
- ✅ Docker Registry (ghcr.io)
- ✅ API запросы к GitHub
- ✅ Работа с пакетами (packages)

**Пример:**
```bash
docker login ghcr.io -u F1bonacci66 --password-stdin
docker push ghcr.io/F1bonacci66/civilx-universe:latest
```

## Создание Personal Access Token

### Шаг 1: Перейти на страницу токенов
https://github.com/settings/tokens

### Шаг 2: Создать новый токен
1. Нажмите **"Generate new token"** → **"Generate new token (classic)"**
2. Укажите имя: `Docker Registry` или `ghcr.io`
3. Выберите срок действия (рекомендуется: 90 дней или без срока)
4. Выберите права (scopes):
   - ✅ **`read:packages`** - чтение пакетов
   - ✅ **`write:packages`** - запись пакетов
   - ✅ **`delete:packages`** - удаление пакетов (опционально)
5. Нажмите **"Generate token"**
6. **Скопируйте токен** (он показывается только один раз!)

### Шаг 3: Использовать токен

#### Windows PowerShell:
```powershell
# Временная переменная (для текущей сессии)
$env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Или постоянная (для пользователя)
[System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'User')
```

#### Linux/Mac:
```bash
# Временная переменная
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Или постоянная (добавить в ~/.bashrc или ~/.zshrc)
echo 'export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"' >> ~/.bashrc
source ~/.bashrc
```

## Проверка аутентификации

### Проверка SSH ключа (для Git):
```bash
ssh -T git@github.com
# Должно вывести: Hi F1bonacci66! You've successfully authenticated...
```

### Проверка PAT (для Docker Registry):
```powershell
# Windows
echo $env:GITHUB_TOKEN | docker login ghcr.io -u F1bonacci66 --password-stdin

# Linux/Mac
echo $GITHUB_TOKEN | docker login ghcr.io -u F1bonacci66 --password-stdin
```

Если успешно, вы увидите: `Login Succeeded`

## Безопасность

### ⚠️ Важно:
- **Никогда не коммитьте токен в Git!**
- Используйте переменные окружения
- Добавьте `.env` в `.gitignore`
- Для сервера используйте секреты (Docker secrets, Kubernetes secrets)

### Рекомендации:
1. Используйте разные токены для разных целей
2. Устанавливайте срок действия токенов
3. Регулярно обновляйте токены
4. Удаляйте неиспользуемые токены

## Итоговая схема

```
┌─────────────────────────────────────────┐
│  Локальная машина                       │
├─────────────────────────────────────────┤
│                                         │
│  SSH ключ (C:\Users\dimag\.ssh\Universe)│
│  └─> Git операции (git clone, push)     │
│                                         │
│  Personal Access Token                  │
│  └─> Docker Registry (ghcr.io)          │
│                                         │
└─────────────────────────────────────────┘
           │                    │
           │                    │
           ▼                    ▼
    ┌──────────┐        ┌──────────────┐
    │  GitHub  │        │  ghcr.io     │
    │  (Git)   │        │  (Docker)    │
    └──────────┘        └──────────────┘
```

## Быстрая настройка

### 1. Проверить SSH ключ:
```bash
ssh -T git@github.com
```

### 2. Создать PAT:
- Перейти: https://github.com/settings/tokens
- Создать токен с правами: `read:packages`, `write:packages`

### 3. Установить токен:
```powershell
$env:GITHUB_TOKEN = "ваш-токен"
```

### 4. Проверить Docker login:
```powershell
echo $env:GITHUB_TOKEN | docker login ghcr.io -u F1bonacci66 --password-stdin
```

### 5. Загрузить образ:
```powershell
.\push-to-ghcr.ps1 -Tag v1.0.0
```

