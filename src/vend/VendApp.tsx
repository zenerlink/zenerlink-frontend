import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, Loader2, Receipt, ShieldCheck, Zap } from 'lucide-react';
import { AppLogo } from '../components/ui/AppLogo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ApiError, api, guest, koboToNaira, nairaToKobo } from '../lib/api';
import type { Branding, Disco, GuestOrder, PublicMeter } from '../lib/api';
import { BrandContext, fallbackBranding, useBrand } from '../lib/brand';
import { applyBranding } from '../lib/theme';
import { formatCurrency } from '../lib/format';

// Buy-only product (production zenerlink.com): BuyPower-style guest checkout.

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
const formatToken = (t: string) => t.replace(/(\d{4})(?=\d)/g, '$1 ');
const QUICK = [1000, 2000, 5000, 10000];

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
  return (
    <BrandContext.Provider value={branding}>
      <VendApp />
    </BrandContext.Provider>
  );
}

function VendApp() {
  const orderMatch = window.location.pathname.match(/^\/order\/([0-9a-f-]{36})/i);
  const key = new URLSearchParams(window.location.search).get('key');
  return (
    <Shell>
      {orderMatch && key ? <OrderPage id={orderMatch[1]} orderKey={key} /> : <BuyPage />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const brand = useBrand();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5">
        <a href="/" className="flex min-w-0 items-center gap-3">
          <AppLogo size={26} />
          <span className="text-sm font-black tracking-[0.28em]">{brand.display_name.toUpperCase()}</span>
        </a>
        {brand.sandbox ? (
          <span className="shrink-0 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-yellow-300">
            Test mode<span className="hidden sm:inline"> · tokens are not real</span>
          </span>
        ) : null}
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-white/35">
        {brand.support_email ? <>Need help? {brand.support_email}</> : null}
      </footer>
    </div>
  );
}

function BuyPage() {
  const [discos, setDiscos] = useState<Disco[]>([]);
  const [provider, setProvider] = useState('');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [meterNumber, setMeterNumber] = useState('');
  const [meter, setMeter] = useState<PublicMeter | null>(null);
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

  // A changed form is a new purchase: new idempotency key, re-verify the meter.
  useEffect(() => {
    idemKey.current = crypto.randomUUID();
  }, [provider, meterType, meterNumber, amount, phone, email]);
  useEffect(() => setMeter(null), [provider, meterType, meterNumber]);

  const disco = discos.find((d) => d.provider_code === provider);
  const naira = Number(amount);
  const minNaira = disco ? koboToNaira(disco.min_purchase_kobo) : 500;
  const maxNaira = disco ? koboToNaira(disco.max_purchase_kobo) : 500000;
  const fee = disco ? koboToNaira(disco.service_fee_kobo) : 0;

  const verify = async () => {
    setError('');
    if (meterNumber.trim().length < 10) {
      setError('Enter your full meter number.');
      return;
    }
    setVerifying(true);
    try {
      setMeter(await guest.verify(provider, meterNumber.trim(), meterType));
    } catch (e) {
      setMeter(null);
      setError(message(e));
    } finally {
      setVerifying(false);
    }
  };

  const pay = async () => {
    setError('');
    if (!meter?.verified) return setError('Verify your meter first.');
    if (!Number.isFinite(naira) || naira < minNaira || naira > maxNaira)
      return setError(`Enter an amount between ${formatCurrency(minNaira)} and ${formatCurrency(maxNaira)}.`);
    if (!/^\+?\d{10,14}$/.test(phone.replace(/[\s-]/g, ''))) return setError('Enter a valid phone number.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    setPaying(true);
    try {
      const o = await guest.order(
        { provider_code: provider, meter_number: meterNumber.trim(), meter_type: meterType, amount_kobo: nairaToKobo(naira), email: email.trim(), phone: phone.trim() },
        idemKey.current,
      );
      if (o.key) saveRecent({ id: o.id, key: o.key, meter: o.meter_number, disco: o.provider_name, amount: o.amount_kobo, at: o.created_at });
      if (o.status === 'payment_pending' && o.checkout_url) {
        window.location.assign(o.checkout_url);
        return;
      }
      window.location.assign(`/order/${o.id}?key=${encodeURIComponent(o.key ?? '')}${window.location.search.includes('mode=vend') ? '&mode=vend' : ''}`);
    } catch (e) {
      setError(message(e));
      setPaying(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="min-w-0 p-5 sm:p-7" accent>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-zener-gold">Buy electricity</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">Recharge any prepaid meter in seconds</h1>
        <p className="mt-2 text-sm text-white/55">No account needed. Your token appears here and you can load it straight away.</p>

        <div className="mt-6 grid gap-4">
          <Field label="Electricity company">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-md border border-zener-border bg-zener-surface px-3 py-3 text-sm text-white outline-none focus:border-zener-gold"
            >
              {discos.map((d) => (
                <option key={d.provider_code} value={d.provider_code}>
                  {d.provider_name} ({d.provider_code})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Meter type">
            <div className="grid grid-cols-2 gap-2">
              {(['prepaid', 'postpaid'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMeterType(t)}
                  className={`rounded-md border py-3 text-sm font-bold capitalize ${meterType === t ? 'border-zener-gold bg-zener-gold text-black' : 'border-zener-border text-white/60'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Meter number">
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                value={meterNumber}
                onChange={(e) => setMeterNumber(e.target.value.replace(/\D/g, ''))}
                onBlur={() => meterNumber.length >= 10 && !meter && void verify()}
                placeholder="e.g. 45012345678"
                className="w-full rounded-md border border-zener-border bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-zener-gold"
              />
              <Button variant="secondary" disabled={verifying} onClick={() => void verify()}>
                {verifying ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}
              </Button>
            </div>
            {meter?.verified ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-zener-success/30 bg-zener-success/10 px-3 py-2 text-sm">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-zener-success" />
                <span>
                  <span className="font-bold">{meter.customer_name}</span>
                  {meter.address ? <span className="block text-xs text-white/50">{meter.address}</span> : null}
                  {meter.message ? <span className="block text-xs text-yellow-300">{meter.message}</span> : null}
                </span>
              </div>
            ) : null}
          </Field>

          <Field label="Amount (₦)">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder={`Minimum ${formatCurrency(minNaira)}`}
              className="w-full rounded-md border border-zener-border bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-zener-gold"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button key={q} onClick={() => setAmount(String(q))} className="rounded-full border border-zener-border px-3 py-1 text-xs font-bold text-white/60 hover:border-zener-gold hover:text-zener-gold">
                  {formatCurrency(q)}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone number">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" inputMode="tel"
                className="w-full rounded-md border border-zener-border bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-zener-gold" />
            </Field>
            <Field label="Email (for your receipt)">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email"
                className="w-full rounded-md border border-zener-border bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-zener-gold" />
            </Field>
          </div>
        </div>

        {error ? <p className="mt-5 rounded-md border border-zener-danger/40 bg-zener-danger/10 px-3 py-2 text-sm font-bold text-zener-danger">{error}</p> : null}

        <Button className="mt-6 w-full py-4 text-base" icon={Zap} disabled={paying || !meter?.verified} onClick={() => void pay()}>
          {paying ? 'Starting payment…' : naira > 0 ? `Pay ${formatCurrency(naira)}` : 'Pay'}
        </Button>
        {fee > 0 ? <p className="mt-2 text-center text-xs text-white/40">Includes a {formatCurrency(fee)} service charge.</p> : null}
      </Card>

      <div className="grid content-start gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-zener-gold" /> How it works</div>
          <ol className="mt-3 space-y-2 text-sm text-white/60">
            <li>1. Choose your DisCo and enter your meter number.</li>
            <li>2. Check the name on the meter, then pay securely.</li>
            <li>3. Copy your 20-digit token and enter it on your meter keypad.</li>
          </ol>
        </Card>
        {recent.length ? (
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-bold"><Receipt size={16} className="text-zener-gold" /> Your recent purchases</div>
            <div className="mt-3 divide-y divide-zener-border">
              {recent.map((r) => (
                <a key={r.id} href={`/order/${r.id}?key=${encodeURIComponent(r.key)}`} className="flex items-center justify-between py-3 text-sm hover:text-zener-gold">
                  <span>
                    <span className="block font-bold">{r.meter}</span>
                    <span className="text-xs text-white/40">{r.disco} · {new Date(r.at).toLocaleDateString('en-NG')}</span>
                  </span>
                  <span className="font-black">{formatCurrency(koboToNaira(r.amount))}</span>
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/30">Saved on this device only.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

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

  if (error) return <Card className="mx-auto max-w-xl p-6 text-sm text-zener-danger">{error}</Card>;
  if (!order)
    return (
      <Card className="mx-auto grid max-w-xl place-items-center p-10">
        <Loader2 className="animate-spin text-zener-gold" />
      </Card>
    );

  const done = order.status === 'vended' || order.status === 'delivered';
  return (
    <Card className="mx-auto max-w-xl p-6 sm:p-8" accent>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-zener-gold">{done ? 'Purchase successful' : 'Purchase status'}</p>
      <h1 className="mt-1 text-2xl font-black">
        {done ? `${formatCurrency(koboToNaira(order.amount_kobo))} of electricity` : order.message || 'Processing…'}
      </h1>

      {done && order.token ? (
        <div className="mt-6 rounded-lg border border-zener-gold/40 bg-zener-panel p-5 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Your token</p>
          <p className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-2xl font-black tracking-[0.08em] text-zener-gold sm:text-3xl">
            {formatToken(order.token).split(' ').map((group, i) => (
              <span key={i} className="whitespace-nowrap">{group}</span>
            ))}
          </p>
          <Button
            variant="secondary"
            icon={Copy}
            className="mt-4"
            onClick={() => {
              void navigator.clipboard?.writeText(order.token ?? '');
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy token'}
          </Button>
          <p className="mt-3 text-xs text-white/45">Enter this token on your meter keypad to load the units.</p>
        </div>
      ) : done ? (
        <p className="mt-6 rounded-lg border border-zener-success/30 bg-zener-success/10 p-4 text-sm">Your postpaid bill payment was received.</p>
      ) : !FINAL.includes(order.status) ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-white/60">
          <Loader2 size={18} className="animate-spin text-zener-gold" /> This page updates automatically.
        </div>
      ) : null}

      <div className="mt-6 grid gap-2 rounded-lg border border-zener-border bg-black/20 p-4 text-sm">
        <Row label="Meter" value={`${order.meter_number} · ${order.meter_type}`} />
        <Row label="Name" value={order.customer_name} />
        <Row label="DisCo" value={order.provider_name} />
        <Row label="Amount" value={formatCurrency(koboToNaira(order.amount_kobo))} />
        {done && order.energy_kwh ? <Row label="Units" value={`${order.energy_kwh.toFixed(1)} kWh`} /> : null}
        <Row label="Reference" value={order.id.slice(0, 8).toUpperCase()} />
      </div>
      {order.sandbox ? <p className="mt-3 text-xs text-yellow-300">Test mode: this token is not valid on a real meter.</p> : null}
      <Button className="mt-6 w-full" onClick={() => window.location.assign('/' + (window.location.search.includes('mode=vend') ? '?mode=vend' : ''))}>
        Buy again
      </Button>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-white/35">{label}</span>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  );
}
