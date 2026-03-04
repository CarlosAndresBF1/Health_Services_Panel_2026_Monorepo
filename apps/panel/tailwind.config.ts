import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#111827',
          hover: '#0B1220',
        },
        accent: {
          DEFAULT: '#C8A951',
          tech: '#60A5FA',
        },
        background: '#0A0F1A',
        surface: '#111827',
        'text-primary': '#F3F4F6',
        'text-muted': '#9CA3AF',
        status: {
          up: '#22C55E',
          down: '#EF4444',
          degraded: '#F59E0B',
          unknown: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
