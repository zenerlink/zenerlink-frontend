import type { Config } from 'tailwindcss';

// Colours are CSS variables (space-separated RGB channels) so a tenant's
// branding from GET /v1/branding re-skins the app at runtime. Defaults in
// src/styles/index.css are the Zenerlink palette.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        zener: {
          gold: v('--zener-gold'),
          black: v('--zener-black'),
          surface: v('--zener-surface'),
          panel: v('--zener-panel'),
          border: v('--zener-border'),
          success: v('--zener-success'),
          danger: v('--zener-danger'),
        },
      },
      boxShadow: {
        gold: '0 0 0 1px rgb(var(--zener-gold) / 0.22), 0 20px 50px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
} satisfies Config;
