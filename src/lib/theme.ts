import type { Branding, Theme } from './api';

// Maps tenant theme tokens onto the CSS variables consumed by tailwind.config.ts.
const tokenToVar: Record<keyof Theme, string> = {
  primary: '--zener-gold',
  secondary: '--zener-secondary',
  background: '--zener-black',
  surface: '--zener-surface',
  panel: '--zener-panel',
  border: '--zener-border',
  success: '--zener-success',
  danger: '--zener-danger',
  text: '--zener-text',
  text_muted: '--zener-muted',
};

const channels = (hex: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

export function applyBranding(b: Branding) {
  const root = document.documentElement;
  for (const [token, cssVar] of Object.entries(tokenToVar)) {
    const value = b.theme[token as keyof Theme];
    const rgb = value ? channels(value) : null;
    if (rgb) root.style.setProperty(cssVar, rgb);
  }
  if (b.theme.primary) root.style.setProperty('--zener-gold-hex', b.theme.primary);
  document.title = b.display_name;
}
