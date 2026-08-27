/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'IBM Plex Sans Thai', 'serif'],
        body: ['Inter', 'IBM Plex Sans Thai', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      colors: {
        paper: {
          50: '#FBF7EC',
          100: '#F8F3E7',
          200: '#EFE9DD',
          300: '#E1D7C1',
          400: '#D6C9AF',
          500: '#B8A78C',
        },
        ink: {
          950: '#1A120A',
          900: '#2A1E14',
          800: '#3D2C1E',
          700: '#5C4636',
          500: '#8D7B67',
        },
        terracotta: {
          DEFAULT: '#C7532A',
          soft: '#E27B4E',
          deep: '#9E3E1E',
          tint: '#F0DCCB',
        },
        moss: {
          DEFAULT: '#3F6B54',
          soft: '#5F8B72',
          deep: '#2C4F3D',
          tint: '#D3E1D7',
        },
        brass: {
          DEFAULT: '#B8944F',
          soft: '#D0AE6C',
          deep: '#8F7136',
          tint: '#EFE3C7',
        },
        alert: {
          DEFAULT: '#A83A2A',
          tint: '#F0D5CE',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(42,30,20,0.05), 0 2px 6px rgba(42,30,20,0.06)',
        raised: '0 1px 2px rgba(42,30,20,0.06), 0 8px 20px -6px rgba(42,30,20,0.12)',
        pressed: 'inset 0 1px 2px rgba(42,30,20,0.10)',
      },
      animation: {
        'tick-pulse': 'tickPulse 2.6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
      keyframes: {
        tickPulse: {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
      },
    },
  },
  plugins: [],
};
