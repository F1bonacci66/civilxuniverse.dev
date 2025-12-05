# Environment Configuration for CivilX.Universe

Создайте файл `.env` в директории `universe/universe/` на основе этого примера.

## Пример файла .env

```env
# Application Port
PORT=3001

# Node Environment
NODE_ENV=production

# Next.js Public API URL (used in client-side code)
# For production: use your production API URL
# For development: use http://localhost:8000/api/datalab
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab

# Hostname (usually 0.0.0.0 for Docker)
HOSTNAME=0.0.0.0

# Optional: Database connection (if needed in future)
# DATABASE_URL=postgresql://user:password@postgres:5432/civilx_universe

# Optional: Redis connection (if needed in future)
# REDIS_URL=redis://redis:6379

# Optional: MinIO/S3 configuration (if needed in future)
# MINIO_ENDPOINT=minio:9000
# MINIO_ACCESS_KEY=minioadmin
# MINIO_SECRET_KEY=minioadmin
# MINIO_BUCKET=civilx-universe
```

## Использование

### Для Production (docker-compose.yml)
```bash
# Создайте .env файл
cp ENV_EXAMPLE.md .env
# Отредактируйте .env с реальными значениями
nano .env

# Запустите с docker-compose
docker-compose up -d
```

### Для Development (docker-compose.dev.yml)
```bash
# Создайте .env файл
cp ENV_EXAMPLE.md .env
# Установите NODE_ENV=development и NEXT_PUBLIC_API_URL=http://localhost:8000/api/datalab
nano .env

# Запустите с docker-compose
docker-compose -f docker-compose.dev.yml up -d
```






