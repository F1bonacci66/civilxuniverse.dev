# Этап 1: Сборка Next.js приложения
FROM node:18-alpine AS builder

WORKDIR /app

# Аргумент сборки для API URL (можно переопределить при сборке)
ARG NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Устанавливаем зависимости для сборки (включая dev)
COPY package.json package-lock.json ./
RUN npm ci --only=production=false && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/cache/apk/*

# Копируем конфигурационные файлы
COPY next.config.mjs tsconfig.json tailwind.config.ts postcss.config.mjs ./

# Копируем исходный код
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY next-env.d.ts ./

# Собираем приложение
RUN npm run build && \
    rm -rf node_modules && \
    rm -rf /tmp/*

# Этап 2: Production образ с Node.js сервером
FROM node:18-alpine

# Создаём пользователя ДО установки зависимостей (для оптимизации слоёв)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Standalone режим Next.js уже включает все необходимые зависимости
# в папке .next/standalone, поэтому не нужно устанавливать их отдельно

# Копируем собранное приложение из builder
# Standalone режим создает минимальную версию с только необходимыми файлами
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Переключаемся на непривилегированного пользователя
USER nextjs

# Экспонируем порт
EXPOSE 3001

# Переменные окружения
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
ENV DOCKER_CONTAINER="true"

# Health check для мониторинга состояния контейнера
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Команда запуска (standalone использует server.js)
CMD ["node", "server.js"]

