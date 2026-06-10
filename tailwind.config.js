/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#fff0f6',
          100: '#ffd6e8',
          200: '#ffadd1',
          300: '#ff77b3',
          400: '#ff4d99',
          500: '#f43f6b',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        surface: {
          0:   '#0f0e1a',
          50:  '#13111f',
          100: '#1c1930',
          200: '#252240',
          300: '#312d55',
          400: '#403b6e',
          500: '#554f88',
        },
        ink: {
          DEFAULT:   '#f0eeff',
          secondary: '#cac5f0',
          muted:     '#9990cc',
          subtle:    '#6b6499',
          disabled:  '#3d3860',
        },
        velvet: {
          50:  '#1a1632',
          100: '#231e42',
          200: '#2e2858',
          300: '#3a3270',
          400: '#4a4090',
        },
        success: {
          50:  '#0d2b1a',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50:  '#2a1e00',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50:  '#2a0a0a',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          50:  '#0a1628',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      spacing: {
        4.5: '1.125rem',
        13:  '3.25rem',
        18:  '4.5rem',
        22:  '5.5rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in':   'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':    'shimmer 1.6s linear infinite',
        'spin-slow':  'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-800px 0' },
          '100%': { backgroundPosition:  '800px 0' },
        },
      },
      boxShadow: {
        'soft':       '0 2px 15px -3px rgba(0,0,0,0.30), 0 10px 20px -2px rgba(0,0,0,0.20)',
        'glow':       '0 0 20px rgba(244,63,107,0.40)',
        'glow-lg':    '0 0 40px rgba(244,63,107,0.30)',
        'glow-blue':  '0 0 20px rgba(99,102,241,0.35)',
        'inner-sm':   'inset 0 1px 2px rgba(0,0,0,0.20)',
        'card':       '0 1px 4px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.20)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.40), 0 8px 32px rgba(0,0,0,0.25)',
        'modal':      '0 20px 80px rgba(0,0,0,0.60)',
      },
    },
  },
  plugins: [],
};
