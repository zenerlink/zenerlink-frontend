// Network and cable TV logos bundled with the site (PayRep's catalogue has none). Keyed by service code.
const files = import.meta.glob('./*.jpg', { eager: true, import: 'default' }) as Record<string, string>;

export const BILL_LOGOS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace('./', '').replace('.jpg', ''), url]),
);
