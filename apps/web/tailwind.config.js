/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
        body: ['Inter', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#050510',
          900: '#0a0a1a',
          800: '#0f0f24',
          700: '#171735',
        },
        neon: {
          cyan: '#22d3ee',
          violet: '#a78bfa',
          pink: '#f472b6',
          lime: '#a3e635',
        },
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(167,139,250,.55)',
        card: '0 20px 60px -20px rgba(0,0,0,.6)',
      },
      backgroundImage: {
        'radial-fade':
          'radial-gradient(1200px 800px at 20% 0%, rgba(167,139,250,.15), transparent), radial-gradient(800px 600px at 90% 100%, rgba(34,211,238,.12), transparent)',
      },
      animation: {
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(.9)', opacity: '.7' },
          '80%,100%': { transform: 'scale(1.6)', opacity: '0' },
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
