// DisCo logos bundled with the site, so they show even when the vending
// provider's catalogue (or our API) is unavailable. Keyed by provider code.
const files = import.meta.glob('./*.jpg', { eager: true, import: 'default' }) as Record<string, string>;

export const DISCO_LOGOS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace('./', '').replace('.jpg', ''), url]),
);

export const discoLogo = (code: string, fallback?: string) => DISCO_LOGOS[code] ?? fallback ?? '';
