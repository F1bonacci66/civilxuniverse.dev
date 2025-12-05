import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          400: '#5eead4',
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
      backgroundImage: {
        'body-gradient': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        'primary-gradient': 'linear-gradient(135deg, #14b8a6 0%, #5eead4 100%)',
        'primary-gradient-hover': 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
      },
    },
  },
  plugins: [],
}
export default config









