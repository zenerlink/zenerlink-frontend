import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Loader2, Lock, Search, Zap } from 'lucide-react';
import { AppLogo } from '../components/ui/AppLogo';
import { ApiError, api, guest, koboToNaira, nairaToKobo } from '../lib/api';
import type { Branding, Disco, GuestOrder, PublicMeter } from '../lib/api';
import { BrandContext, fallbackBranding, useBrand } from '../lib/brand';
import { applyBranding } from '../lib/theme';
import { formatCurrency } from '../lib/format';

// Buy-only product (production zenerlink.com): a full-screen guest checkout.
// Left: brand + live order summary. Right: the form, alone, using full height.

const RECENT_KEY = 'zenerlink.recentOrders';
type Recent = { id: string; key: string; meter: string; disco: string; amount: number; at: string };

const loadRecent = (): Recent[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Recent[];
  } catch {
    return [];
  }
};
const saveRecent = (r: Recent) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([r, ...loadRecent().filter((x) => x.id !== r.id)].slice(0, 10)));
  } catch {
    /* storage unavailable: the order page link still works */
  }
};

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Network error. Check your connection and try again.');
const tokenGroups = (t: string) => t.replace(/(\d{4})(?=\d)/g, '$1 ').split(' ');
const naira = (kobo: number) => formatCurrency(koboToNaira(kobo));
const QUICK = [1000, 2000, 5000, 10000];
const keepMode = () => (window.location.search.includes('mode=vend') ? 'mode=vend' : '');

export default function VendRoot() {
  const [branding, setBranding] = useState<Branding>(fallbackBranding);
  useEffect(() => {
    api
      .branding()
      .then((b) => {
        setBranding(b);
        applyBranding(b);
      })
      .catch(() => undefined);
  }, []);
  const orderMatch = window.location.pathname.match(/^\/order\/([0-9a-f-]{36})/i);
  const key = new URLSearchParams(window.location.search).get('key');
  return (
    <BrandContext.Provider value={branding}>
      {orderMatch && key ? <OrderPage id={orderMatch[1]} orderKey={key} /> : <BuyPage />}
    </BrandContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function Split({ aside, children }: { aside: React.ReactNode; children: React.ReactNode }) {
  const brand = useBrand();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(380px,5fr)_7fr]">
      <aside className="relative flex flex-col overflow-hidden border-b border-white/[0.06] px-6 py-6 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-12 lg:py-10">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-zener-gold/[0.10] blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <a href={'/' + (keepMode() ? `?${keepMode()}` : '')} className="flex items-center gap-3">
            <AppLogo size={22} />
            <span className="text-[13px] font-black tracking-[0.3em]">{brand.display_name.toUpperCase()}</span>
          </a>
          {brand.sandbox ? (
            <span className="rounded-full border border-yellow-400/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-yellow-300/90">
              Test mode
            </span>
          ) : null}
        </div>
        <div className="relative mt-8 flex-1 lg:mt-16">{aside}</div>
        <footer className="relative mt-10 hidden items-center justify-between text-xs text-white/35 lg:flex">
          <span>{brand.support_email ? <>Help: {brand.support_email}</> : <>&copy; {new Date().getFullYear()} {brand.display_name}</>}</span>
          <span className="flex items-center gap-1.5"><Lock size={12} /> Secured payments</span>
        </footer>
      </aside>
      <main className="flex items-start justify-center px-6 py-8 sm:py-12 lg:items-center lg:px-16">
        <div className="w-full max-w-[460px]">{children}</div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buy
// ---------------------------------------------------------------------------

function BuyPage() {
  const brand = useBrand();
  const [discos, setDiscos] = useState<Disco[]>([]);
  const [provider, setProvider] = useState('');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [meterNumber, setMeterNumber] = useState('');
  const [meter, setMeter] = useState<PublicMeter | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const idemKey = useRef(crypto.randomUUID());
  const recent = useMemo(loadRecent, []);

  useEffect(() => {
    guest
      .discos()
      .then((r) => {
        setDiscos(r.discos);
        setProvider((p) => p || r.discos.find((d) => d.provider_code === 'IKEDC')?.provider_code || r.discos[0]?.provider_code || '');
      })
      .catch((e) => setError(message(e)));
  }, []);

  // A changed form is a new purchase (new idempotency key).
  useEffect(() => {
    idemKey.current = crypto.randomUUID();
  }, [provider, meterType, meterNumber, amount, phone, email]);

  // Verify automatically once the meter number looks complete.
  useEffect(() => {
    setMeter(null);
    setVerifyError('');
    if (!provider || meterNumber.length < 11) return;
    let live = true;
    const t = window.setTimeout(async () => {
      setVerifying(true);
      try {
        const m = await guest.verify(provider, meterNumber, meterType);
        if (live) setMeter(m);
      } catch (e) {
        if (live) setVerifyError(message(e));
      } finally {
        if (live) setVerifying(false);
      }
    }, 550);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [provider, meterType, meterNumber]);

  const disco = discos.find((d) => d.provider_code === provider);
  const value = Number(amount);
  const minNaira = disco ? koboToNaira(disco.min_purchase_kobo) : 500;
  const maxNaira = disco ? koboToNaira(disco.max_purchase_kobo) : 500000;
  const fee = disco ? koboToNaira(disco.service_fee_kobo) : 0;
  const amountOk = Number.isFinite(value) && value >= minNaira && value <= maxNaira;
  const phoneOk = /^\+?\d{10,14}$/.test(phone.replace(/[\s-]/g, ''));
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const ready = !!meter?.verified && amountOk && phoneOk && emailOk;

  const pay = async () => {
    setError('');
    if (!meter?.verified) return setError('Enter a meter number we can verify.');
    if (!amountOk) return setError(`Enter an amount between ${formatCurrency(minNaira)} and ${formatCurrency(maxNaira)}.`);
    if (!phoneOk) return setError('Enter a valid phone number.');
    if (!emailOk) return setError('Enter a valid email address.');
    setPaying(true);
    try {
      const o = await guest.order(
        { provider_code: provider, meter_number: meterNumber, meter_type: meterType, amount_kobo: nairaToKobo(value), email: email.trim(), phone: phone.trim() },
        idemKey.current,
      );
      if (o.key) saveRecent({ id: o.id, key: o.key, meter: o.meter_number, disco: o.provider_name, amount: o.amount_kobo, at: o.created_at });
      if (o.status === 'payment_pending' && o.checkout_url) {
        window.location.assign(o.checkout_url);
        return;
      }
      window.location.assign(`/order/${o.id}?key=${encodeURIComponent(o.key ?? '')}${keepMode() ? '&' + keepMode() : ''}`);
    } catch (e) {
      setError(message(e));
      setPaying(false);
    }
  };

  const summary = (
    <dl className="space-y-3 text-sm">
      <SummaryRow label="Electricity company" value={disco?.provider_name} />
      <SummaryRow label="Meter" value={meterNumber ? `${meterNumber} · ${meterType}` : undefined} />
      <SummaryRow label="Account name" value={meter?.verified ? meter.customer_name : undefined} />
      <div className="border-t border-white/[0.08] pt-3">
        <SummaryRow label="Amount" value={value > 0 ? formatCurrency(value) : undefined} strong />
        {fee > 0 ? <p className="mt-1 text-right text-xs text-white/35">includes {formatCurrency(fee)} service charge</p> : null}
      </div>
    </dl>
  );

  return (
    <Split
      aside={
        <div className="flex h-full flex-col">
          <h1 className="max-w-md text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl lg:text-[44px]">
            Buy electricity in seconds.
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-7 text-white/55">
            Recharge any prepaid meter on any DisCo. No account needed. Your token appears the moment payment is confirmed.
          </p>
          <div className="mt-10 hidden max-w-sm rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 lg:block">
            <p className="mb-4 text-xs font-semibold text-white/40">Your order</p>
            {summary}
          </div>
          {recent.length ? (
            <div className="mt-8 hidden max-w-sm lg:block">
              <p className="mb-2 text-xs font-semibold text-white/40">Recent on this device</p>
              <ul className="divide-y divide-white/[0.06]">
                {recent.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <a href={`/order/${r.id}?key=${encodeURIComponent(r.key)}`} className="flex items-center justify-between py-2.5 text-sm text-white/70 hover:text-white">
                      <span>{r.meter} <span className="text-white/30">· {r.disco}</span></span>
                      <span className="font-semibold">{naira(r.amount)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Meter details</h2>
          <p className="mt-1 text-sm text-white/45">We confirm the account name with your DisCo before you pay.</p>
        </div>

        <Field label="Electricity company">
          <DiscoPicker discos={discos} value={provider} onChange={setProvider} />
        </Field>

        <Field label="Meter type">
          <Segmented value={meterType} onChange={setMeterType} options={[['prepaid', 'Prepaid'], ['postpaid', 'Postpaid']]} />
        </Field>

        <Field label="Meter number">
          <div className="relative">
            <input
              inputMode="numeric"
              autoComplete="off"
              value={meterNumber}
              onChange={(e) => setMeterNumber(e.target.value.replace(/\D/g, '').slice(0, 20))}
              placeholder="Enter your meter number"
              className={`${inputCls} pr-11 tracking-wide`}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
              {verifying ? <Loader2 size={18} className="animate-spin text-white/40" /> : meter?.verified ? <Check size={18} className="text-zener-success" /> : null}
            </span>
          </div>
          {meter?.verified ? (
            <p className="mt-2 text-sm">
              <span className="font-semibold text-white">{meter.customer_name}</span>
              {meter.address ? <span className="text-white/40"> · {meter.address}</span> : null}
            </p>
          ) : verifyError ? (
            <p className="mt-2 text-sm text-zener-danger">{verifyError}</p>
          ) : null}
          {meter?.message ? <p className="mt-1 text-xs text-yellow-300/90">{meter.message}</p> : null}
        </Field>

        <div className="pt-2">
          <h2 className="text-xl font-bold">Payment</h2>
        </div>

        <Field label="Amount" hint={`Min ${formatCurrency(minNaira)}`}>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-white/40">₦</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0"
              className={`${inputCls} pl-9 text-lg font-semibold`}
            />
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={`rounded-lg border py-2 text-xs font-semibold transition ${
                  value === q ? 'border-zener-gold/60 bg-zener-gold/10 text-zener-gold' : 'border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white'
                }`}
              >
                ₦{q.toLocaleString('en-NG')}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" inputMode="tel" autoComplete="tel" className={inputCls} />
          </Field>
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" className={inputCls} />
          </Field>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 lg:hidden">{summary}</div>

        {error ? <p className="rounded-lg bg-zener-danger/10 px-3.5 py-2.5 text-sm text-zener-danger">{error}</p> : null}

        <button
          type="button"
          disabled={paying || !ready}
          onClick={() => void pay()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-[15px] font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {paying ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
          {paying ? 'Starting secure payment…' : value > 0 ? `Pay ${formatCurrency(value)}` : 'Pay'}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-white/35">
          <Lock size={12} /> Card, transfer or USSD, processed securely{brand.sandbox ? ' · test mode' : ''}
        </p>
      </div>
    </Split>
  );
}

// ---------------------------------------------------------------------------
// Order / token
// ---------------------------------------------------------------------------

const FINAL = ['vended', 'delivered', 'refunded', 'payment_failed', 'needs_review'];

function OrderPage({ id, orderKey }: { id: string; orderKey: string }) {
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const load = async (attempt: number) => {
      try {
        const o = await guest.get(id, orderKey);
        if (stop) return;
        setOrder(o);
        saveRecent({ id: o.id, key: orderKey, meter: o.meter_number, disco: o.provider_name, amount: o.amount_kobo, at: o.created_at });
        if (!FINAL.includes(o.status) && attempt < 100) timer = window.setTimeout(() => void load(attempt + 1), 3000);
      } catch (e) {
        if (!stop) setError(message(e));
      }
    };
    void load(0);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [id, orderKey]);

  const done = order?.status === 'vended' || order?.status === 'delivered';
  const pending = order && !FINAL.includes(order.status);

  return (
    <Split
      aside={
        <div>
          <h1 className="max-w-md text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl lg:text-[44px]">
            {done ? 'Your token is ready.' : pending ? 'Almost there.' : order ? 'Purchase update' : 'Loading your order…'}
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-7 text-white/55">
            {done
              ? 'Enter the 20-digit token on your meter keypad to load the units.'
              : pending
                ? 'This page updates automatically. You can close it and come back from the same device.'
                : order?.message ?? ''}
          </p>
        </div>
      }
    >
      {error ? (
        <p className="rounded-lg bg-zener-danger/10 px-4 py-3 text-sm text-zener-danger">{error}</p>
      ) : !order ? (
        <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-zener-gold" /></div>
      ) : (
        <div className="space-y-6">
          {done && order.token ? (
            <div className="rounded-2xl border border-zener-gold/30 bg-zener-gold/[0.06] p-6 text-center">
              <p className="text-xs font-semibold text-white/45">Electricity token</p>
              <p className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-[26px] font-bold tracking-wider text-zener-gold sm:text-3xl">
                {tokenGroups(order.token).map((g, i) => <span key={i} className="whitespace-nowrap">{g}</span>)}
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(order.token ?? '');
                  setCopied(true);
                }}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold hover:border-white/25"
              >
                {copied ? <Check size={15} className="text-zener-success" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy token'}
              </button>
            </div>
          ) : done ? (
            <p className="rounded-2xl border border-zener-success/30 bg-zener-success/[0.06] p-6 text-sm">Your postpaid bill payment was received.</p>
          ) : pending ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] p-6 text-sm text-white/60">
              <Loader2 size={18} className="animate-spin text-zener-gold" /> {order.message || 'Processing…'}
            </div>
          ) : (
            <p className="rounded-2xl border border-white/[0.07] p-6 text-sm text-white/70">{order.message}</p>
          )}

          <dl className="space-y-3 rounded-2xl border border-white/[0.07] p-6 text-sm">
            <SummaryRow label="Electricity company" value={order.provider_name} />
            <SummaryRow label="Meter" value={`${order.meter_number} · ${order.meter_type}`} />
            <SummaryRow label="Account name" value={order.customer_name} />
            {done && order.energy_kwh ? <SummaryRow label="Units" value={`${order.energy_kwh.toFixed(1)} kWh`} /> : null}
            <SummaryRow label="Reference" value={order.id.slice(0, 8).toUpperCase()} />
            <div className="border-t border-white/[0.08] pt-3">
              <SummaryRow label="Amount paid" value={naira(order.amount_kobo)} strong />
            </div>
          </dl>
          {order.sandbox ? <p className="text-center text-xs text-yellow-300/80">Test mode: this token is not valid on a real meter.</p> : null}

          <button
            type="button"
            onClick={() => window.location.assign('/' + (keepMode() ? `?${keepMode()}` : ''))}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-white/[0.06] text-sm font-bold hover:bg-white/[0.1]"
          >
            Buy again
          </button>
        </div>
      )}
    </Split>
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const inputCls =
  'h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-zener-gold/70 focus:bg-white/[0.05] focus:ring-4 focus:ring-zener-gold/10';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-white/70">{label}</span>
        {hint ? <span className="text-xs text-white/35">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-white/45">{label}</dt>
      <dd className={`truncate text-right ${strong ? 'text-base font-bold text-white' : 'font-medium text-white/85'}`}>{value || <span className="text-white/20">—</span>}</dd>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.09] bg-white/[0.03] p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`h-10 rounded-lg text-sm font-semibold transition ${value === v ? 'bg-white/[0.1] text-white shadow-sm' : 'text-white/45 hover:text-white/75'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DiscoPicker({ discos, value, onChange }: { discos: Disco[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = discos.find((d) => d.provider_code === value);
  const shown = discos.filter((d) => `${d.provider_name} ${d.provider_code}`.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="flex items-center gap-3">
            <DiscoBadge code={selected.provider_code} />
            <span>{selected.provider_name}</span>
          </span>
        ) : (
          <span className="text-white/30">{discos.length ? 'Choose your DisCo' : 'Loading DisCos…'}</span>
        )}
        <ChevronDown size={18} className={`text-white/40 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-3">
            <Search size={15} className="text-white/35" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search DisCo or state"
              className="h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-auto py-1">
            {shown.map((d) => (
              <li key={d.provider_code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={d.provider_code === value}
                  onClick={() => {
                    onChange(d.provider_code);
                    setOpen(false);
                    setQ('');
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]"
                >
                  <span className="flex items-center gap-3">
                    <DiscoBadge code={d.provider_code} />
                    {d.provider_name}
                  </span>
                  {d.provider_code === value ? <Check size={16} className="text-zener-gold" /> : null}
                </button>
              </li>
            ))}
            {!shown.length ? <li className="px-3 py-3 text-sm text-white/40">No match</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DiscoBadge({ code }: { code: string }) {
  return (
    <span className="grid h-7 min-w-[44px] place-items-center rounded-md bg-white/[0.07] px-1.5 text-[10px] font-bold tracking-wide text-white/70">
      {code}
    </span>
  );
}
