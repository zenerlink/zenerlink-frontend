// Typed client for the Zieon platform API (/v1).
// Tenant: VITE_TENANT, or ?tenant=<slug> in the URL (white-label hosts).
// Tokens live in memory; the refresh token is kept in localStorage so a
// reload stays signed in. Embedded (partner SSO) sessions never persist.

const params = new URLSearchParams(window.location.search);
const host = window.location.hostname;

// Production (zenerlink.com) is the buy-only product on the production API;
// everything else is staging with the full dashboard. Env vars and
// ?mode=vend (preview the buy-only site on staging) override.
const PRODUCTION_HOSTS = ['zenerlink.com', 'www.zenerlink.com'];
export const IS_PRODUCTION = PRODUCTION_HOSTS.includes(host);
export const APP_MODE: 'vend' | 'full' =
  (import.meta.env.VITE_APP_MODE as 'vend' | 'full' | undefined) ??
  (IS_PRODUCTION || params.get('mode') === 'vend' ? 'vend' : 'full');

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  (IS_PRODUCTION ? 'https://api.zenerlink.com' : 'https://zieon-api.198.199.65.142.sslip.io');

export const TENANT = params.get('tenant') ?? (import.meta.env.VITE_TENANT as string | undefined) ?? 'zenerlink';
export const EMBEDDED = params.get('embed') === '1';

const REFRESH_KEY = `zieon.refresh.${TENANT}`;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export type Theme = Partial<Record<'primary' | 'secondary' | 'background' | 'surface' | 'panel' | 'border' | 'success' | 'danger' | 'text' | 'text_muted', string>>;

export type Branding = {
  tenant: string;
  display_name: string;
  logo_url: string;
  logo_dark_url: string;
  theme: Theme;
  font_family: string;
  support_email: string;
  support_phone: string;
  support_url: string;
  currency: string;
  locale: string;
  features: Record<string, boolean>;
  sandbox: boolean;
};

export type User = { id: string; email: string; phone: string; name: string; role: string };

export type ApiMeter = {
  id: string;
  label: string;
  provider_code: string;
  provider_name: string;
  meter_number: string;
  customer_name: string;
  address: string;
  meter_type: 'prepaid' | 'postpaid';
  kwh_reserve: number;
  balance_source: 'device' | 'platform_ledger';
  connectivity: 'unknown' | 'online' | 'offline';
  capabilities: { telemetry: boolean; remote_credit: boolean; remote_debit: boolean };
  is_owner: boolean;
  status: string;
};

export type Purchase = {
  id: string;
  status: string;
  meter_id: string;
  amount_kobo: number;
  energy_kwh: number;
  token: string | null;
  sandbox: boolean;
  failure_reason?: string;
  reward_earned_kobo: number;
  payment?: { reference: string; status: string; checkout_url?: string; bank_account?: { bank_name: string; account_number: string; account_name: string } };
};

export type PendingToken = { id: string; token: string; meter_id: string; energy_kwh: number; source: 'purchase' | 'share'; note: string; sandbox: boolean };
export type Recipient = { name: string; meter_number: string; last_note: string; last_kwh: number; last_shared_at: string | null };
export type Notification = { id: string; title: string; message: string; critical: boolean; created_at: string };
export type Activity = { kind: string; title: string; subtitle: string; amount_kobo?: number; kwh?: number; created_at: string };
export type Tariff = { provider_code: string; provider_name: string; rate_kobo_per_kwh: number; rate_per_kwh: number };
export type Consumption = { data_source: 'device' | 'none'; days: { date: string; kwh: number }[]; time_breakdown: Record<string, number>; message?: string };
export type Session = { access_token: string; refresh_token?: string; expires_at: string; user: User; tenant: string };

let accessToken: string | null = null;
let refreshToken: string | null = readStored();
let onSignedOut: () => void = () => undefined;

function readStored(): string | null {
  if (EMBEDDED) return null;
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function store(rt: string | null) {
  refreshToken = rt;
  if (EMBEDDED) return;
  try {
    if (rt) localStorage.setItem(REFRESH_KEY, rt);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* storage blocked: session lasts for this tab only */
  }
}

export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn;
}

function adopt(s: Session): Session {
  accessToken = s.access_token;
  if (s.refresh_token) store(s.refresh_token);
  return s;
}

async function raw<T>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else headers['X-Tenant'] = TENANT;
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  refreshing ??= raw<Session>('POST', '/v1/auth/refresh', { refresh_token: refreshToken })
    .then((s) => (adopt(s), true))
    .catch(() => (store(null), (accessToken = null), false))
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function request<T>(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
  try {
    return await raw<T>(method, path, body, extra);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && accessToken !== null && (await tryRefresh())) {
      return raw<T>(method, path, body, extra);
    }
    if (e instanceof ApiError && e.status === 401 && path !== '/v1/auth/login') {
      accessToken = null;
      onSignedOut();
    }
    throw e;
  }
}

const idem = () => ({ 'Idempotency-Key': crypto.randomUUID() });

export const api = {
  branding: () => raw<Branding>('GET', `/v1/branding?tenant=${encodeURIComponent(TENANT)}`),
  login: async (email: string, password: string) => adopt(await raw<Session>('POST', '/v1/auth/login', { email, password }, { 'X-Tenant': TENANT })),
  register: async (email: string, phone: string, name: string, password: string) =>
    adopt(await raw<Session>('POST', '/v1/auth/register', { email, phone, name, password }, { 'X-Tenant': TENANT })),
  exchangeEmbedCode: async (code: string) => adopt(await raw<Session>('POST', '/v1/embed/exchange', { code })),
  resume: async () => ((await tryRefresh()) ? request<{ user: User; branding: Branding }>('GET', '/v1/me') : null),
  logout: async () => {
    const rt = refreshToken;
    accessToken = null;
    store(null);
    if (rt) await raw('POST', '/v1/auth/logout', { refresh_token: rt }).catch(() => undefined);
  },
  me: () => request<{ user: User; branding: Branding }>('GET', '/v1/me'),
  wallet: () => request<{ balance_kobo: number; reward_balance_kobo: number }>('GET', '/v1/wallet'),
  fundWallet: (amount_kobo: number, method: 'card' | 'bank_transfer') =>
    request<{ payment: Purchase['payment']; wallet: { balance_kobo: number }; sandbox: boolean }>('POST', '/v1/wallet/fund', { amount_kobo, method }, idem()),
  meters: () => request<{ meters: ApiMeter[] }>('GET', '/v1/meters'),
  validateMeter: (provider_code: string, meter_number: string) =>
    request<{ verified: boolean; customer_name: string; address: string; message: string }>('POST', '/v1/meters/validate', { provider_code, meter_number }),
  linkMeter: (input: { provider_code: string; meter_number: string; label: string; customer_name?: string; address?: string; meter_type?: string }) =>
    request<ApiMeter>('POST', '/v1/meters', input),
  consumption: (meterId: string, days = 7) => request<Consumption>('GET', `/v1/meters/${meterId}/consumption?days=${days}`),
  tariffs: () => request<{ tariffs: Tariff[] }>('GET', '/v1/tariffs'),
  purchase: (meter_id: string, amount_kobo: number, payment_method: string) =>
    request<Purchase>('POST', '/v1/purchases', { meter_id, amount_kobo, payment_method }, idem()),
  pendingTokens: () => request<{ tokens: PendingToken[] }>('GET', '/v1/tokens'),
  redeem: (meter_id: string, token: string) =>
    request<{ status: string; energy_kwh: number; simulated: boolean; message: string; meter: ApiMeter }>('POST', '/v1/tokens/redeem', { meter_id, token }),
  share: (input: { from_meter_id: string; to_meter_number: string; kwh: number; note: string; recipient_name: string; mode: 'direct' | 'token' }) =>
    request<{ token?: string; kwh: number; simulated: boolean }>('POST', '/v1/shares', input, idem()),
  recipients: () => request<{ recipients: Recipient[] }>('GET', '/v1/recipients'),
  removeRecipient: (meterNumber: string) => request<void>('DELETE', `/v1/recipients/${encodeURIComponent(meterNumber)}`),
  notifications: () => request<{ notifications: Notification[] }>('GET', '/v1/notifications'),
  activity: () => request<{ activity: Activity[] }>('GET', '/v1/activity'),
};

// ---- Guest checkout (production buy-only site) ----
export type Disco = { provider_code: string; provider_name: string; min_purchase_kobo: number; max_purchase_kobo: number; service_fee_kobo: number };
export type PublicMeter = { verified: boolean; customer_name: string; address: string; meter_type: string; message?: string };
export type GuestOrder = {
  id: string;
  key?: string;
  status: string;
  provider_code: string;
  provider_name: string;
  meter_number: string;
  meter_type: string;
  customer_name: string;
  amount_kobo: number;
  fee_kobo: number;
  energy_kwh: number;
  token: string | null;
  checkout_url?: string;
  sandbox: boolean;
  message?: string;
  created_at: string;
};

export const guest = {
  discos: () => raw<{ discos: Disco[] }>('GET', '/v1/public/discos', undefined, { 'X-Tenant': TENANT }),
  verify: (provider_code: string, meter_number: string, meter_type: string) =>
    raw<PublicMeter>('POST', '/v1/public/meters/verify', { provider_code, meter_number, meter_type }, { 'X-Tenant': TENANT }),
  order: (input: { provider_code: string; meter_number: string; meter_type: string; amount_kobo: number; email: string; phone: string }, idempotencyKey: string) =>
    raw<GuestOrder>('POST', '/v1/public/orders', input, { 'X-Tenant': TENANT, 'Idempotency-Key': idempotencyKey }),
  get: (id: string, key: string) =>
    raw<GuestOrder>('GET', `/v1/public/orders/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`, undefined, { 'X-Tenant': TENANT }),
};

export const koboToNaira = (k: number) => k / 100;
export const nairaToKobo = (n: number) => Math.round(n * 100);
