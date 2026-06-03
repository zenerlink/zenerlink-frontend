import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        zener: {
          gold: '#C8823A',
          black: '#050505',
          surface: '#111111',
          panel: '#17110A',
          border: '#222222',
          success: '#0DF020',
        },
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(200,130,58,0.22), 0 20px 50px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
} satisfies Config;
