import { IS_PRODUCTION } from '../lib/api';

// Links inside the buy site. Staging previews it with ?mode=vend, so every
// link keeps that flag (before any #hash).
export const keepMode = () => (IS_PRODUCTION || import.meta.env.VITE_APP_MODE === 'vend' ? '' : 'mode=vend');

export const href = (path: string) => {
  const m = keepMode();
  if (!m) return path;
  const [base, hash] = path.split('#');
  return `${base}${base.includes('?') ? '&' : '?'}${m}${hash !== undefined ? `#${hash}` : ''}`;
};

export type Nav = (path: string) => void;

// A buy link (meter QR sticker, "pay for me" share) pre-fills the form.
export type Prefill = { disco: string; meter: string; type: 'prepaid' | 'postpaid' } | null;

export const readPrefill = (q: URLSearchParams): Prefill => {
  const meter = (q.get('meter') ?? '').replace(/\D/g, '');
  const disco = (q.get('disco') ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (meter.length < 6 || !disco) return null;
  return { disco, meter, type: q.get('type') === 'postpaid' ? 'postpaid' : 'prepaid' };
};

export const buyLink = (m: { provider_code: string; meter_number: string; meter_type: string }) =>
  window.location.origin + href(`/buy?disco=${m.provider_code}&meter=${m.meter_number}&type=${m.meter_type}`);
