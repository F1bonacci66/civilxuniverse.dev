/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone режим для оптимизации Docker образа
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Rewrite отключен - API запросы обрабатываются напрямую через Nginx
  // Если NEXT_PUBLIC_API_URL - относительный путь (/api/datalab), запросы идут через Nginx
  // Если NEXT_PUBLIC_API_URL - полный URL, запросы идут напрямую к API
  async rewrites() {
    // Проксируем API запросы на backend через Next.js route handler
    // Route handler находится в app/api/datalab/[...path]/route.ts
    // Это работает и в development, и в production
    return []
  },
  // Webpack конфигурация для работы с @xeokit/xeokit-sdk
  webpack: (config, { isServer }) => {
    // Исключаем Node.js модули из клиентского бандла
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        assert: false,
        http: false,
        https: false,
        os: false,
        url: false,
        zlib: false,
        net: false,
        tls: false,
        child_process: false,
      }
      // Игнорируем предупреждения о Node.js модулях
      config.ignoreWarnings = [
        { module: /node_modules\/@xeokit\/xeokit-sdk/ },
        /Module not found: Error: Can't resolve 'fs'/,
        /Module not found: Error: Can't resolve 'path'/,
      ]
      // Внешние зависимости для @xeokit/xeokit-sdk
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'fs': 'commonjs fs',
          'path': 'commonjs path',
        })
      }
    }
    return config
  },
}

// Для production используем Node.js сервер (не статический экспорт)
// Статический экспорт не поддерживает динамические роуты с 'use client'
// Используйте Node.js сервер + Nginx reverse proxy для production
// if (process.env.NODE_ENV === 'production') {
//   nextConfig.output = 'export'
//   nextConfig.basePath = '/universe-app'
//   nextConfig.assetPrefix = '/universe-app'
// }

export default nextConfig

