import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  LifeBuoy,
  Loader2,
  Lock,
  LogOut,
  Plus,
  Printer,
  QrCode,
  Share2,
  X,
  Receipt,
  Search,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react';
import { brandedQr, brandedQrUrl } from './qr';
import { discoLogo } from '../assets/discos';
import logo from '../assets/logo-icon-white.svg';
import { ApiError, IS_PRODUCTION, account, api, guest, koboToNaira, nairaToKobo, setSignedOutHandler } from '../lib/api';
import type { ApiMeter, Branding, Disco, GuestOrder, PublicMeter, User } from '../lib/api';
import { BrandContext, fallbackBranding, useBrand } from '../lib/brand';
import { applyBranding } from '../lib/theme';
import { formatCurrency } from '../lib/format';
import { Landing, LoginPage } from './Landing';
import { discoBySlug } from '../seo/site';
import { buyLink, href, readPrefill } from './links';
import type { Nav, Prefill } from './links';

// Buy-only product (production zenerlink.com), modelled on BuyPower: a quick
// sign-up, then an account with a wallet, a buy form, transactions, saved
// meters and profile. Signed-out pages use the full-screen split layout.

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Network error. Check your connection and try again.');
const tokenGroups = (t: string) => t.replace(/(\d{4})(?=\d)/g, '$1 ').split(' ');
const naira = (kobo: number) => formatCurrency(koboToNaira(kobo));
const QUICK = [1000, 2000, 5000, 10000];
const shortDate = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// Signed-in state shared by every account page.
type AccountCtx = {
  user: User;
  setUser: (u: User) => void;
  nav: Nav;
  path: string;
  walletKobo: number | null;
  refreshWallet: () => void;
  signOut: () => Promise<void>;
};
const Acct = createContext<AccountCtx | null>(null);
const useAcct = () => useContext(Acct)!;

export default function VendRoot() {
  const [branding, setBranding] = useState<Branding>(fallbackBranding);
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [walletKobo, setWalletKobo] = useState<number | null>(null);

  useEffect(() => {
    api
      .branding()
      .then((b) => {
        setBranding(b);
        applyBranding(b);
      })
      .catch(() => undefined);
    setSignedOutHandler(() => setUser(null));
    api
      .resume()
      .then((r) => setUser(r?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    const onPop = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshWallet = useCallback(() => {
    api
      .wallet()
      .then((w) => setWalletKobo(w.balance_kobo))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (user) refreshWallet();
    else setWalletKobo(null);
  }, [user, refreshWallet]);

  const nav = useCallback<Nav>((p) => {
    window.history.pushState(null, '', href(p));
    setPath(window.location.pathname + window.location.search);
    const id = p.split('#')[1];
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60);
    else window.scrollTo(0, 0);
  }, []);
  const signOut = async () => {
    await api.logout();
    setUser(null);
    nav('/');
  };

  const url = new URL(path, window.location.origin);
  const orderMatch = url.pathname.match(/^\/order\/([0-9a-f-]{36})/i);
  const key = url.searchParams.get('key');
  const prefill = readPrefill(url.searchParams);

  let page: React.ReactNode;
  if (orderMatch && key) {
    // Orders placed without an account (older links, partner sites).
    page = (
      <Split>
        <OrderView load={() => guest.get(orderMatch[1], key)} />
      </Split>
    );
  } else if (url.pathname === '/electricity' || url.pathname.startsWith('/electricity/')) {
    // Public DisCo pages (search landing pages), for everyone.
    const focus = discoBySlug(url.pathname.split('/')[2] ?? '');
    page = <Landing nav={nav} signedIn={!!user} focus={focus} index={!focus} />;
  } else if (checking) {
    page = <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-zener-gold" /></div>;
  } else if (!user) {
    // The public landing page at "/"; every other page asks to sign in first
    // and stays on its URL (buy links keep their pre-filled meter).
    page =
      url.pathname === '/' && !prefill ? (
        <Landing nav={nav} signedIn={false} />
      ) : (
        <LoginPage
          prefill={prefill}
          nav={nav}
          onDone={(u) => {
            setUser(u);
            if (url.pathname === '/login') nav('/');
          }}
        />
      );
  } else if (url.pathname === '/home') {
    page = <Landing nav={nav} signedIn />;
  } else {
    const p = url.pathname;
    const body = orderMatch ? (
      <OrderPage id={orderMatch[1]} />
    ) : p.startsWith('/transactions') ? (
      <TransactionsPage />
    ) : p.startsWith('/meters') ? (
      <MetersPage />
    ) : p.startsWith('/wallet') ? (
      <WalletPage funded={url.searchParams.has('funded')} />
    ) : p.startsWith('/profile') ? (
      <ProfilePage />
    ) : p.startsWith('/password') ? (
      <PasswordPage />
    ) : p.startsWith('/help') ? (
      <HelpPage />
    ) : (
      <BuyPage meterId={url.searchParams.get('meter_id')} prefill={prefill} payWallet={url.searchParams.get('pay') === 'wallet'} />
    );
    page = (
      <Acct.Provider value={{ user, setUser, nav, path: p, walletKobo, refreshWallet, signOut }}>
        <Shell>{body}</Shell>
      </Acct.Provider>
    );
  }
  return <BrandContext.Provider value={branding}>{page}</BrandContext.Provider>;
}

// ---------------------------------------------------------------------------
// Signed-out layout
// ---------------------------------------------------------------------------

function Split({ aside, children }: { aside?: React.ReactNode; children: React.ReactNode }) {
  const brand = useBrand();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(380px,5fr)_7fr]">
      <aside className="relative flex flex-col overflow-hidden border-b border-white/[0.06] px-6 py-6 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-12 lg:py-10">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-zener-gold/[0.10] blur-3xl" />
        <a href={href('/')} className="relative flex items-center gap-3">
          <span className="text-[15px] font-black tracking-[0.3em]">{brand.display_name.toUpperCase()}</span>
        </a>
        <div className="relative mt-8 flex-1 lg:mt-16">{aside}</div>
        <SiteFooter className="relative mt-10 hidden lg:flex" />
      </aside>
      <main className="flex items-start justify-center px-6 py-8 sm:py-12 lg:items-center lg:px-16">
        <div className="w-full max-w-[460px]">{children}</div>
      </main>
      <SiteFooter className="flex border-t border-white/[0.06] px-6 py-5 lg:hidden" />
    </div>
  );
}

// Minimal footer: copyright, help, and the payment reassurance.
function SiteFooter({ className = '', onHelp }: { className?: string; onHelp?: () => void }) {
  const brand = useBrand();
  return (
    <footer className={`flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-white/35 ${className}`}>
      <span>&copy; {new Date().getFullYear()} {brand.display_name}</span>
      <span className="flex items-center gap-5">
        {onHelp ? (
          <button type="button" onClick={onHelp} className="hover:text-white/70">Help</button>
        ) : null}
        {brand.support_email ? <a href={`mailto:${brand.support_email}`} className="hover:text-white/70">{brand.support_email}</a> : null}
        <span className="flex items-center gap-1.5"><Lock size={12} /> Secured payments</span>
      </span>
    </footer>
  );
}

const initials = (u: User) =>
  (u.name || u.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

const firstName = (u: User) => (u.name || '').trim().split(/\s+/)[0] || '';

// ---------------------------------------------------------------------------
// Signed-in shell: header with wallet, sidebar navigation
// ---------------------------------------------------------------------------

const NAV: [string, string, (p: { size?: number }) => React.ReactNode][] = [
  ['/', 'Buy electricity', ZMark],
  ['/transactions', 'Transactions', Receipt],
  ['/meters', 'My meters', Gauge],
  ['/wallet', 'Wallet', Wallet],
  ['/profile', 'Profile', UserRound],
  ['/password', 'Change password', KeyRound],
  ['/help', 'Help', LifeBuoy],
];

// The Z logo as a nav icon, tinted with the text colour like the other icons.
function ZMark({ size = 17 }: { size?: number }) {
  const img = `url("${logo}")`;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 bg-current"
      style={{
        width: size,
        height: size,
        WebkitMaskImage: img,
        maskImage: img,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}

const isActive = (path: string, to: string) =>
  to === '/' ? path === '/' || path.startsWith('/buy') || path.startsWith('/order/') : path.startsWith(to);

function Shell({ children }: { children: React.ReactNode }) {
  const brand = useBrand();
  const { user, nav, path, walletKobo, signOut } = useAcct();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const link = (to: string) => ({
    href: href(to),
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      setMenu(false);
      nav(to);
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[rgb(var(--zener-background))]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a {...link('/')} className="flex items-center gap-3">
            <span className="text-[15px] font-black tracking-[0.3em]">{brand.display_name.toUpperCase()}</span>
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              {...link('/wallet')}
              className="flex items-center gap-2 rounded-full border border-white/[0.09] py-1.5 pl-3 pr-1.5 text-[13px] font-semibold hover:border-white/25"
            >
              <Wallet size={15} className="text-zener-gold" />
              {walletKobo === null ? '—' : naira(walletKobo)}
              <span className="grid h-6 w-6 place-items-center rounded-full bg-zener-gold text-black" aria-label="Fund wallet">
                <Plus size={14} strokeWidth={3} />
              </span>
            </a>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-[13px] font-semibold text-white/80 hover:text-white"
                aria-expanded={menu}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-zener-gold/15 text-[11px] font-bold text-zener-gold">{initials(user)}</span>
                <span className="hidden max-w-[120px] truncate sm:inline">{firstName(user) || 'Account'}</span>
                <ChevronDown size={15} className="text-white/40" />
              </button>
              {menu ? (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] py-1 shadow-2xl">
                  <div className="border-b border-white/[0.07] px-4 py-3">
                    <p className="truncate text-sm font-semibold">{user.name || 'Your account'}</p>
                    <p className="truncate text-xs text-white/45">{user.email}</p>
                  </div>
                  <a {...link('/profile')} className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.05] hover:text-white">Profile</a>
                  <a {...link('/transactions')} className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.05] hover:text-white">Transactions</a>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-white/75 hover:bg-white/[0.05] hover:text-zener-danger"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {/* Mobile: the sidebar becomes a scrollable tab row. */}
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:hidden">
          {NAV.slice(0, 4).map(([to, label]) => (
            <a
              key={to}
              {...link(to)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                isActive(path, to) ? 'bg-zener-gold/15 text-zener-gold' : 'text-white/55 hover:text-white'
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-10 px-4 py-6 sm:px-6 lg:py-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">
            {NAV.map(([to, label, Icon]) => (
              <a
                key={to}
                {...link(to)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  isActive(path, to) ? 'bg-zener-gold/[0.12] text-zener-gold' : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Icon size={17} /> {label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-4 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white/40 hover:bg-white/[0.04] hover:text-zener-danger"
            >
              <LogOut size={17} /> Sign out
            </button>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <div className="border-t border-white/[0.06]">
        <SiteFooter className="mx-auto flex max-w-6xl px-4 py-6 sm:px-6" onHelp={() => nav('/help')} />
      </div>
    </div>
  );
}

function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-[28px]">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-white/45">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

const card = 'rounded-2xl border border-white/[0.07] bg-white/[0.02]';

// ---------------------------------------------------------------------------
// Buy
// ---------------------------------------------------------------------------

function BuyPage({ meterId, prefill, payWallet }: { meterId: string | null; prefill: Prefill; payWallet: boolean }) {
  const { user, nav, walletKobo, refreshWallet } = useAcct();
  const [discos, setDiscos] = useState<Disco[]>([]);
  const [saved, setSaved] = useState<ApiMeter[]>([]);
  const [recent, setRecent] = useState<GuestOrder[]>([]);
  const [provider, setProvider] = useState(prefill?.disco ?? '');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>(prefill?.type ?? 'prepaid');
  const [meterNumber, setMeterNumber] = useState(prefill?.meter ?? '');
  const [meter, setMeter] = useState<PublicMeter | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'checkout' | 'wallet'>(payWallet ? 'wallet' : 'checkout');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const idemKey = useRef(crypto.randomUUID());

  const pickSaved = (m: ApiMeter) => {
    setProvider(m.provider_code);
    setMeterType(m.meter_type);
    setMeterNumber(m.meter_number);
  };

  useEffect(() => {
    guest
      .discos()
      .then((r) => {
        setDiscos(r.discos);
        setProvider(
          (p) => r.discos.find((d) => d.provider_code === p)?.provider_code || r.discos.find((d) => d.provider_code === 'IKEDC')?.provider_code || r.discos[0]?.provider_code || '',
        );
      })
      .catch((e) => setError(message(e)));
    api
      .meters()
      .then((r) => {
        const ms = r.meters.filter((m) => m.provider_code !== 'ZIEON');
        setSaved(ms);
        const pre = ms.find((m) => m.id === meterId);
        if (pre) pickSaved(pre);
      })
      .catch(() => undefined);
    account
      .orders(4)
      .then((r) => setRecent(r.orders))
      .catch(() => undefined);
  }, [meterId]);

  // A changed form is a new purchase (new idempotency key).
  useEffect(() => {
    idemKey.current = crypto.randomUUID();
  }, [provider, meterType, meterNumber, amount, method]);

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
  const walletShort = method === 'wallet' && walletKobo !== null && nairaToKobo(value) > walletKobo;
  const ready = !!meter?.verified && amountOk && !walletShort;
  const kwh = disco ? estimateKwh(disco, value) : 0;

  const pay = async () => {
    setError('');
    if (!meter?.verified) return setError('Enter a meter number we can verify.');
    if (!amountOk) return setError(`Enter an amount between ${formatCurrency(minNaira)} and ${formatCurrency(maxNaira)}.`);
    setPaying(true);
    try {
      const o = await account.order(
        { provider_code: provider, meter_number: meterNumber, meter_type: meterType, amount_kobo: nairaToKobo(value), payment_method: method },
        idemKey.current,
      );
      if (o.status === 'payment_pending' && o.checkout_url) {
        window.location.assign(o.checkout_url);
        return;
      }
      refreshWallet();
      nav(`/order/${o.id}`);
    } catch (e) {
      setError(message(e));
      setPaying(false);
    }
  };

  return (
    <>
      <PageTitle title={firstName(user) ? `Hi ${firstName(user)}` : 'Buy electricity'} sub="Recharge any prepaid meter on any DisCo. Your token appears the moment payment is confirmed." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`${card} space-y-6 p-5 sm:p-7`}>
          {saved.length ? (
            <Field label="Saved meters">
              <div className="flex flex-wrap gap-2">
                {saved.map((m) => {
                  const active = m.meter_number === meterNumber && m.provider_code === provider;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pickSaved(m)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                        active ? 'border-zener-gold/60 bg-zener-gold/10' : 'border-white/[0.08] hover:border-white/20'
                      }`}
                    >
                      <span className={`block font-semibold ${active ? 'text-zener-gold' : 'text-white/80'}`}>{m.customer_name || m.label}</span>
                      <span className="block text-white/40">{m.meter_number} · {m.provider_code}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Electricity company">
              <DiscoPicker discos={discos} value={provider} onChange={setProvider} />
            </Field>
            <Field label="Meter type">
              <Segmented value={meterType} onChange={setMeterType} options={[['prepaid', 'Prepaid'], ['postpaid', 'Postpaid']]} />
            </Field>
          </div>

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
            ) : (
              <p className="mt-2 text-xs text-white/35">We confirm the account name with your DisCo before you pay.</p>
            )}
            {meter?.message ? <p className="mt-1 text-xs text-yellow-300/90">{meter.message}</p> : null}
          </Field>

          <Field label="Amount" hint={`Min ${formatCurrency(minNaira)}`}>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-white/40">₦</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0"
                className={`${inputCls} pl-9 pr-28 text-lg font-semibold`}
              />
              {kwh > 0 ? (
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zener-gold">≈ {formatKwh(kwh)}</span>
              ) : null}
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
            {kwh > 0 ? (
              <p className="mt-2 text-xs text-white/35">
                Estimate at ₦{(disco!.rate_kobo_per_kwh! / 100).toLocaleString('en-NG')}/kWh. Your DisCo sets the final units by your tariff band.
              </p>
            ) : null}
          </Field>

          <Field label="Pay with">
            <div className="grid gap-2 sm:grid-cols-2">
              <MethodOption active={method === 'checkout'} onClick={() => setMethod('checkout')} title="Card, transfer or USSD" sub="Secure checkout" />
              <MethodOption
                active={method === 'wallet'}
                onClick={() => setMethod('wallet')}
                title="Wallet"
                sub={walletKobo === null ? 'Balance —' : `Balance ${naira(walletKobo)}`}
              />
            </div>
            {walletShort ? (
              <p className="mt-2 text-sm text-yellow-300/90">
                Your wallet balance is too low.{' '}
                <button type="button" onClick={() => nav('/wallet')} className="font-semibold text-zener-gold hover:underline">Fund wallet</button>
              </p>
            ) : null}
          </Field>

          {error ? <p className="rounded-lg bg-zener-danger/10 px-3.5 py-2.5 text-sm text-zener-danger">{error}</p> : null}

          <button
            type="button"
            disabled={paying || !ready}
            onClick={() => void pay()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-[15px] font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {paying && <Loader2 size={18} className="animate-spin" />}
            {paying ? (method === 'wallet' ? 'Buying…' : 'Starting secure payment…') : value > 0 ? `Pay ${formatCurrency(value)}` : 'Pay'}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/35">
            <Lock size={12} /> Processed securely. Receipt to {user.email}
          </p>
        </div>

        <div className="space-y-6">
          <div className={`${card} p-6`}>
            <p className="mb-4 text-xs font-semibold text-white/40">Your order</p>
            <dl className="space-y-3 text-sm">
              <SummaryRow label="DisCo" value={disco?.provider_name} />
              <SummaryRow label="Meter" value={meterNumber ? `${meterNumber} · ${meterType}` : undefined} />
              <SummaryRow label="Name" value={meter?.verified ? meter.customer_name : undefined} />
              <div className="border-t border-white/[0.08] pt-3">
                <SummaryRow label="Amount" value={value > 0 ? formatCurrency(value) : undefined} strong />
                {kwh > 0 ? <SummaryRow label="Estimated energy" value={`≈ ${formatKwh(kwh)}`} /> : null}
                {fee > 0 ? <p className="mt-1 text-right text-xs text-white/35">includes {formatCurrency(fee)} service charge</p> : null}
              </div>
            </dl>
          </div>
          {recent.length ? (
            <div className={`${card} p-6`}>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-xs font-semibold text-white/40">Recent purchases</p>
                <button type="button" onClick={() => nav('/transactions')} className="text-xs font-semibold text-white/50 hover:text-white">View all</button>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {recent.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => nav(`/order/${o.id}`)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-white/80">{o.meter_number}</span>
                        <span className="block truncate text-xs text-white/35">{o.provider_name}</span>
                      </span>
                      <span className="shrink-0 font-semibold">{naira(o.amount_kobo)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function MethodOption({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
        active ? 'border-zener-gold/60 bg-zener-gold/[0.07]' : 'border-white/[0.09] hover:border-white/20'
      }`}
    >
      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${active ? 'border-zener-gold' : 'border-white/30'}`}>
        {active ? <span className="h-2 w-2 rounded-full bg-zener-gold" /> : null}
      </span>
      <span>
        <span className="block text-sm font-semibold text-white/90">{title}</span>
        <span className="block text-xs text-white/40">{sub}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

const STATUS: Record<string, [string, string]> = {
  vended: ['Successful', 'bg-zener-success/10 text-zener-success'],
  delivered: ['Successful', 'bg-zener-success/10 text-zener-success'],
  refunded: ['Refunded', 'bg-white/[0.06] text-white/55'],
  payment_failed: ['Not paid', 'bg-white/[0.06] text-white/45'],
  needs_review: ['Delayed', 'bg-yellow-400/10 text-yellow-300'],
};
const statusOf = (s: string): [string, string] => STATUS[s] ?? ['Processing', 'bg-zener-gold/10 text-zener-gold'];

function StatusPill({ status }: { status: string }) {
  const [label, cls] = statusOf(status);
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>;
}

function useOrders(limit: number) {
  const [orders, setOrders] = useState<GuestOrder[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    account
      .orders(limit)
      .then((r) => setOrders(r.orders))
      .catch((e) => setError(message(e)));
  }, [limit]);
  return { orders, error };
}

function TransactionsPage() {
  const { nav } = useAcct();
  const { orders, error } = useOrders(100);
  return (
    <>
      <PageTitle title="Transactions" sub="Every electricity purchase on your account." />
      {error ? <ErrorBox text={error} /> : orders === null ? <Spinner /> : orders.length === 0 ? (
        <Empty text="No purchases yet." action="Buy electricity" onAction={() => nav('/')} />
      ) : (
        <div className={`${card} overflow-hidden`}>
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-white/[0.07] text-left text-xs font-semibold text-white/40">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Date</th>
                <th className="px-5 py-3.5 font-semibold">Meter</th>
                <th className="px-5 py-3.5 font-semibold">DisCo</th>
                <th className="px-5 py-3.5 text-right font-semibold">Amount</th>
                <th className="px-5 py-3.5 text-right font-semibold">Units</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {orders.map((o) => (
                <tr key={o.id} onClick={() => nav(`/order/${o.id}`)} className="cursor-pointer hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-5 py-4 text-white/55">{shortDate(o.created_at)}</td>
                  <td className="px-5 py-4 font-medium text-white/85">{o.meter_number}</td>
                  <td className="px-5 py-4 text-white/60">{o.provider_name}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-bold">{naira(o.amount_kobo)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right text-white/60">{o.energy_kwh ? `${o.energy_kwh.toFixed(1)} kWh` : '—'}</td>
                  <td className="px-5 py-4"><StatusPill status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-white/[0.06] md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => nav(`/order/${o.id}`)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white/90">{o.meter_number}</span>
                    <span className="block truncate text-xs text-white/40">{o.provider_name} · {shortDate(o.created_at)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold">{naira(o.amount_kobo)}</span>
                    <StatusPill status={o.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// My meters
// ---------------------------------------------------------------------------

function MetersPage() {
  const { nav } = useAcct();
  const [meters, setMeters] = useState<ApiMeter[] | null>(null);
  const { orders } = useOrders(100);
  const [qr, setQr] = useState<ApiMeter | null>(null);
  const closeQr = useCallback(() => setQr(null), []);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .meters()
      .then((r) => setMeters(r.meters.filter((m) => m.provider_code !== 'ZIEON')))
      .catch((e) => setError(message(e)));
  }, []);

  // Orders come newest first, so the first match is the last purchase.
  const last = (m: ApiMeter) => (orders ?? []).find((o) => o.meter_number === m.meter_number && o.provider_code === m.provider_code);
  const remove = (m: ApiMeter) => {
    if (!window.confirm(`Remove meter ${m.meter_number} from your account?`)) return;
    account
      .removeMeter(m.id)
      .then(() => setMeters((ms) => (ms ?? []).filter((x) => x.id !== m.id)))
      .catch((e) => setError(message(e)));
  };

  return (
    <>
      <PageTitle
        title="My meters"
        sub="Meters you buy for are saved here. Share a meter's QR code so anyone can scan and pay for it."
        action={
          <button type="button" onClick={() => nav('/')} className="flex h-10 items-center gap-2 rounded-lg bg-zener-gold px-4 text-sm font-bold text-black hover:brightness-110">
            <Plus size={16} strokeWidth={3} /> Add meter
          </button>
        }
      />
      {error ? <ErrorBox text={error} /> : null}
      {meters === null ? <Spinner /> : meters.length === 0 ? (
        <Empty text="No saved meters yet. Buy for a meter and it is saved here." action="Buy electricity" onAction={() => nav('/')} />
      ) : (
        <div className={`${card} overflow-hidden`}>
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-white/[0.07] text-left text-xs font-semibold text-white/40">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Meter number</th>
                <th className="px-5 py-3.5 font-semibold">Name</th>
                <th className="px-5 py-3.5 font-semibold">DisCo</th>
                <th className="px-5 py-3.5 font-semibold">Address</th>
                <th className="px-5 py-3.5 text-right font-semibold">Last purchased</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {meters.map((m) => {
                const l = last(m);
                return (
                  <tr key={m.id}>
                    <td className="px-5 py-4 font-semibold text-zener-gold">{m.meter_number}</td>
                    <td className="px-5 py-4 text-white/80">{m.customer_name || '—'}</td>
                    <td className="px-5 py-4 text-white/60">{m.provider_code}</td>
                    <td className="max-w-[200px] truncate px-5 py-4 text-white/45" title={m.address}>{m.address || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold">{l ? naira(l.amount_kobo) : '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button type="button" onClick={() => setQr(m)} className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs font-bold text-white/75 hover:border-white/25 hover:text-white">
                        <QrCode size={13} /> QR
                      </button>
                      <button type="button" onClick={() => nav(`/?meter_id=${m.id}`)} className="mr-2 rounded-lg bg-zener-gold/10 px-3 py-1.5 text-xs font-bold text-zener-gold hover:bg-zener-gold/20">
                        Buy
                      </button>
                      <button type="button" onClick={() => remove(m)} aria-label="Delete meter" className="rounded-lg p-1.5 text-white/35 hover:bg-zener-danger/10 hover:text-zener-danger">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="divide-y divide-white/[0.06] md:hidden">
            {meters.map((m) => {
              const l = last(m);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-zener-gold">{m.meter_number}</span>
                    <span className="block truncate text-xs text-white/45">{m.customer_name || '—'} · {m.provider_code}</span>
                    {l ? <span className="block text-xs text-white/35">Last: {naira(l.amount_kobo)}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => setQr(m)} aria-label="Meter QR code" className="rounded-lg border border-white/[0.1] p-1.5 text-white/70"><QrCode size={15} /></button>
                    <button type="button" onClick={() => nav(`/?meter_id=${m.id}`)} className="rounded-lg bg-zener-gold/10 px-3 py-1.5 text-xs font-bold text-zener-gold">Buy</button>
                    <button type="button" onClick={() => remove(m)} aria-label="Delete meter" className="rounded-lg p-1.5 text-white/35 hover:text-zener-danger">
                      <Trash2 size={15} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {qr ? <MeterQrDialog meter={qr} onClose={closeQr} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Meter QR: a buy link for one meter, as a code, a sticker and a share
// ---------------------------------------------------------------------------

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Draws the printable sticker (900x1200) and returns it as a PNG data URL.
async function drawSticker(m: ApiMeter, link: string, brandName: string, logoUrl: string): Promise<string> {
  const W = 900;
  const H = 1200;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#0b0b0b';
  g.fillRect(0, 0, W, 170);
  g.fillStyle = '#d4943a';
  g.fillRect(0, 170, W, 10);

  let x = W / 2;
  try {
    const logo = await loadImage(logoUrl);
    g.drawImage(logo, 0, 0, logo.width || 64, logo.height || 64, 70, 53, 64, 64);
    x = 150;
  } catch {
    /* sticker still works without the logo */
  }
  g.fillStyle = '#ffffff';
  g.font = `900 46px ${font}`;
  g.textBaseline = 'middle';
  g.textAlign = x === W / 2 ? 'center' : 'left';
  g.fillText(brandName.toUpperCase().split('').join(String.fromCharCode(8202)), x, 87);

  g.textAlign = 'center';
  g.fillStyle = '#0b0b0b';
  g.font = `800 50px ${font}`;
  g.fillText('Scan to buy electricity', W / 2, 270);

  const qr = await brandedQr(link, 600, logoUrl);
  g.drawImage(qr, (W - 600) / 2, 330, 600, 600);

  g.font = `800 58px ui-monospace, SFMono-Regular, Menlo, monospace`;
  g.fillText(m.meter_number, W / 2, 1010);
  g.fillStyle = '#555555';
  g.font = `500 32px ${font}`;
  g.fillText([m.provider_name || m.provider_code, m.customer_name].filter(Boolean).join(' · ').slice(0, 48), W / 2, 1068);
  g.fillStyle = '#999999';
  g.font = `500 28px ${font}`;
  g.fillText(window.location.host, W / 2, 1140);
  return c.toDataURL('image/png');
}

function MeterQrDialog({ meter, onClose }: { meter: ApiMeter; onClose: () => void }) {
  const brand = useBrand();
  const link = buyLink(meter);
  const [qr, setQr] = useState('');
  const [sticker, setSticker] = useState('');
  const [copied, setCopied] = useState(false);
  const fileName = `${brand.display_name.toLowerCase()}-meter-${meter.meter_number}.png`;

  useEffect(() => {
    brandedQrUrl(link, 480, brand.logo_url || logo).then(setQr).catch(() => undefined);
    drawSticker(meter, link, brand.display_name, brand.logo_url || logo).then(setSticker).catch(() => undefined);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [link, meter, brand.display_name, brand.logo_url, onClose]);

  const copy = () => {
    void navigator.clipboard?.writeText(link);
    setCopied(true);
  };
  const share = async () => {
    const text = `Pay for my electricity: meter ${meter.meter_number} (${meter.provider_name || meter.provider_code})`;
    try {
      if (sticker) {
        const file = new File([await (await fetch(sticker)).blob()], fileName, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text: `${text}\n${link}` });
      }
      if (navigator.share) return await navigator.share({ title: text, text, url: link });
      copy();
    } catch {
      /* share sheet closed */
    }
  };
  const print = () => {
    const w = window.open('', '_blank');
    if (!w || !sticker) return;
    w.document.write(
      `<!doctype html><title>${fileName}</title><style>@page{margin:12mm}body{margin:0;display:grid;place-items:center;min-height:100vh}img{width:90mm;border:1px solid #ddd}</style>` +
        `<img src="${sticker}" onload="setTimeout(()=>{print()},100)">`,
    );
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Meter QR code" className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Meter QR code</h2>
            <p className="truncate text-sm text-white/45">{meter.meter_number} · {meter.customer_name || meter.provider_code}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/45 hover:bg-white/[0.06] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="mx-auto mt-5 grid aspect-square w-full max-w-[260px] place-items-center rounded-xl bg-white p-3">
          {qr ? <img src={qr} alt={`QR code to buy electricity for meter ${meter.meter_number}`} className="h-full w-full" /> : <Loader2 className="animate-spin text-black/40" />}
        </div>
        <p className="mt-4 text-center text-sm text-white/55">
          Anyone who scans this goes straight to paying for this meter. Stick it on the meter or send it to family.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void share()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110">
            <Share2 size={16} /> Share
          </button>
          <button type="button" onClick={copy} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold hover:bg-white/[0.12]">
            {copied ? <Check size={16} className="text-zener-success" /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            href={sticker || undefined}
            download={fileName}
            aria-disabled={!sticker}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold hover:bg-white/[0.12] aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            <ArrowDownToLine size={16} /> Download
          </a>
          <button
            type="button"
            onClick={print}
            disabled={!sticker}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold hover:bg-white/[0.12] disabled:opacity-40"
          >
            <Printer size={16} /> Print sticker
          </button>
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

function WalletPage({ funded }: { funded: boolean }) {
  const { walletKobo, refreshWallet, nav } = useAcct();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState(funded ? 'Payment received. Your balance updates as soon as it is confirmed.' : '');
  const idemKey = useRef(crypto.randomUUID());
  const value = Number(amount);
  const ok = Number.isFinite(value) && value >= 100 && value <= 1000000;

  useEffect(() => {
    idemKey.current = crypto.randomUUID();
  }, [amount]);
  // Coming back from checkout: the webhook may land a moment later.
  useEffect(() => {
    if (!funded) return;
    const ts = [2000, 6000, 15000].map((d) => window.setTimeout(refreshWallet, d));
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [funded, refreshWallet]);

  const fund = async () => {
    setError('');
    setNote('');
    if (!ok) return setError('Enter an amount between ₦100 and ₦1,000,000.');
    setBusy(true);
    try {
      const r = await api.fundWallet(nairaToKobo(value), 'card');
      if (r.payment?.checkout_url && r.payment.status !== 'succeeded') {
        window.location.assign(r.payment.checkout_url);
        return;
      }
      refreshWallet();
      setAmount('');
      setNote(`${formatCurrency(value)} added to your wallet.`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Wallet" sub="Keep a balance and buy electricity in one tap." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-zener-gold/25 bg-gradient-to-br from-zener-gold/[0.16] to-zener-gold/[0.03] p-7">
          <p className="text-xs font-semibold text-white/55">Available balance</p>
          <p className="mt-2 text-4xl font-black tracking-tight">{walletKobo === null ? '—' : naira(walletKobo)}</p>
          <button type="button" onClick={() => nav('/?pay=wallet')} className="mt-6 h-10 rounded-lg bg-white/[0.1] px-4 text-sm font-bold hover:bg-white/[0.16]">
            Buy electricity
          </button>
          <Wallet size={96} strokeWidth={1.25} className="pointer-events-none absolute bottom-5 right-5 text-zener-gold/[0.12]" />
        </div>
        <div className={`${card} space-y-5 p-6`}>
          <h2 className="text-base font-bold">Fund wallet</h2>
          <Field label="Amount">
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
          {error ? <ErrorBox text={error} /> : null}
          {note ? <p className="rounded-lg bg-zener-success/10 px-3.5 py-2.5 text-sm text-zener-success">{note}</p> : null}
          <button
            type="button"
            disabled={busy || !ok}
            onClick={() => void fund()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 size={17} className="animate-spin" />}
            {value > 0 ? `Fund ${formatCurrency(value)}` : 'Fund wallet'}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-white/35"><Lock size={12} /> Card, transfer or USSD, processed securely</p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Profile, password, help
// ---------------------------------------------------------------------------

function ProfilePage() {
  const { user, setUser } = useAcct();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone(false);
    if (phone.trim() && !/^\+?\d{10,14}$/.test(phone.replace(/[\s-]/g, ''))) return setError('Enter a valid phone number.');
    setSaving(true);
    try {
      const u = await account.updateProfile({ name: name.trim(), phone: phone.replace(/[\s-]/g, '') });
      setUser({ ...user, ...u });
      setDone(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTitle title="Profile" sub="Your details for receipts and DisCo purchases." />
      <form onSubmit={(e) => void save(e)} className={`${card} max-w-xl space-y-5 p-6`}>
        <div className="flex items-center gap-4 pb-2">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-zener-gold/15 text-lg font-bold text-zener-gold">{initials(user)}</span>
          <div className="min-w-0">
            <p className="truncate font-bold">{user.name || 'Your account'}</p>
            <p className="truncate text-sm text-white/45">{user.email}</p>
          </div>
        </div>
        <Field label="Full name">
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputCls} />
        </Field>
        <Field label="Phone number">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" className={inputCls} />
        </Field>
        <Field label="Email" hint="Cannot be changed">
          <input value={user.email} disabled className={`${inputCls} cursor-not-allowed text-white/45`} />
        </Field>
        {error ? <ErrorBox text={error} /> : null}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-zener-gold px-5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40">
            {saving && <Loader2 size={16} className="animate-spin" />} Save changes
          </button>
          {done ? <span className="text-sm text-zener-success">Saved.</span> : null}
        </div>
      </form>
    </>
  );
}

function PasswordPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone(false);
    if (next.length < 8) return setError('Use at least 8 characters for the new password.');
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      await account.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Change password" />
      <form onSubmit={(e) => void submit(e)} className={`${card} max-w-xl space-y-5 p-6`}>
        <Field label="Current password">
          <input value={current} onChange={(e) => setCurrent(e.target.value)} type="password" autoComplete="current-password" className={inputCls} />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <input value={next} onChange={(e) => setNext(e.target.value)} type="password" autoComplete="new-password" className={inputCls} />
        </Field>
        <Field label="Confirm new password">
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" className={inputCls} />
        </Field>
        {error ? <ErrorBox text={error} /> : null}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !current || !next || !confirm}
            className="flex h-11 items-center gap-2 rounded-xl bg-zener-gold px-5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
          >
            {busy && <Loader2 size={16} className="animate-spin" />} Update password
          </button>
          {done ? <span className="text-sm text-zener-success">Password changed.</span> : null}
        </div>
      </form>
    </>
  );
}

function HelpPage() {
  const brand = useBrand();
  const faqs: [string, string][] = [
    ['I paid but have no token', 'Most tokens arrive within seconds. If the DisCo is slow, the order shows "Delayed" and we keep trying. You will not be charged twice. If the DisCo fails, your money is refunded.'],
    ['Where do I enter the token?', 'Type the 20 digits on your meter keypad and press Enter (or #, depending on your meter).'],
    ['Why are my units different from the estimate?', 'Your DisCo calculates the final units from your tariff band. The units on your receipt are the DisCo’s figure.'],
    ['Can I buy for someone else?', 'Yes. Enter their meter number. We show the name on the meter before you pay.'],
  ];
  return (
    <>
      <PageTitle title="Help" sub="Answers to common questions, or reach our team." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className={`${card} divide-y divide-white/[0.06]`}>
          {faqs.map(([q, a]) => (
            <details key={q} className="group px-6 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white/90">
                {q}
                <ChevronDown size={16} className="shrink-0 text-white/40 transition group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm leading-6 text-white/55">{a}</p>
            </details>
          ))}
        </div>
        <div className={`${card} space-y-3 p-6 text-sm`}>
          <p className="font-bold">Contact us</p>
          {brand.support_email ? <a href={`mailto:${brand.support_email}`} className="block text-zener-gold hover:underline">{brand.support_email}</a> : null}
          {brand.support_phone ? <a href={`tel:${brand.support_phone}`} className="block text-white/70 hover:text-white">{brand.support_phone}</a> : null}
          {!brand.support_email && !brand.support_phone ? <p className="text-white/50">Support details coming soon.</p> : null}
          <p className="text-xs text-white/35">Include your order reference so we can help faster.</p>
        </div>
      </div>
    </>
  );
}

function Spinner() {
  return <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-zener-gold" /></div>;
}

function ErrorBox({ text }: { text: string }) {
  return <p className="rounded-lg bg-zener-danger/10 px-3.5 py-2.5 text-sm text-zener-danger">{text}</p>;
}

function Empty({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.1] px-6 py-14 text-center">
      <p className="text-sm text-white/50">{text}</p>
      <button type="button" onClick={onAction} className="mt-5 h-10 rounded-lg bg-zener-gold px-5 text-sm font-bold text-black hover:brightness-110">
        {action}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order / token
// ---------------------------------------------------------------------------

const FINAL = ['vended', 'delivered', 'refunded', 'payment_failed', 'needs_review'];

function OrderPage({ id }: { id: string }) {
  const { nav, refreshWallet } = useAcct();
  return (
    <div className="max-w-xl">
      <OrderView load={() => account.get(id)} onFinal={refreshWallet} />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => nav('/')} className="flex h-12 items-center justify-center rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110">
          Buy again
        </button>
        <button type="button" onClick={() => nav('/transactions')} className="flex h-12 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-bold hover:bg-white/[0.1]">
          All transactions
        </button>
      </div>
    </div>
  );
}

function OrderView({ load, onFinal }: { load: () => Promise<GuestOrder>; onFinal?: () => void }) {
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const loadRef = useRef(load);
  const finalRef = useRef(onFinal);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const poll = async (attempt: number) => {
      try {
        const o = await loadRef.current();
        if (stop) return;
        setOrder(o);
        if (FINAL.includes(o.status)) finalRef.current?.();
        else if (attempt < 100) timer = window.setTimeout(() => void poll(attempt + 1), 3000);
      } catch (e) {
        if (!stop) setError(message(e));
      }
    };
    void poll(0);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (error) return <ErrorBox text={error} />;
  if (!order) return <Spinner />;
  const done = order.status === 'vended' || order.status === 'delivered';
  const pending = !FINAL.includes(order.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-[28px]">{done ? 'Your token is ready' : pending ? 'Almost there' : 'Purchase update'}</h1>
        <p className="mt-1 text-sm text-white/45">
          {done ? 'Enter the 20-digit token on your meter keypad to load the units.' : pending ? 'This page updates automatically.' : order.message}
        </p>
      </div>
      {done && order.token ? (
        <div className="rounded-2xl border border-zener-gold/30 bg-zener-gold/[0.06] p-6 text-center">
          <p className="text-xs font-semibold text-white/45">Electricity token</p>
          <p className="mt-3 flex flex-wrap justify-center gap-x-2.5 gap-y-1 font-mono text-[22px] font-bold tracking-wide text-zener-gold sm:text-[24px]">
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
      ) : null}

      <dl className={`${card} space-y-3 p-6 text-sm`}>
        <SummaryRow label="Electricity company" value={order.provider_name} />
        <SummaryRow label="Meter" value={`${order.meter_number} · ${order.meter_type}`} />
        <SummaryRow label="Account name" value={order.customer_name} />
        {done && order.energy_kwh ? <SummaryRow label="Units" value={`${order.energy_kwh.toFixed(1)} kWh`} /> : null}
        <SummaryRow label="Date" value={shortDate(order.created_at)} />
        <SummaryRow label="Reference" value={order.id.slice(0, 8).toUpperCase()} />
        <div className="border-t border-white/[0.08] pt-3">
          <SummaryRow label="Amount paid" value={naira(order.amount_kobo)} strong />
        </div>
      </dl>
      {order.sandbox ? <p className="text-center text-xs text-yellow-300/80">Test mode: this token is not valid on a real meter.</p> : null}
    </div>
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
    <div className="grid gap-1 rounded-xl border border-white/[0.09] bg-white/[0.03] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
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
            <DiscoLogo disco={selected} />
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
                    <DiscoLogo disco={d} />
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

// DisCo logo from the vending provider's catalogue; some provider images are
// missing, so fall back to the DisCo code.
function DiscoLogo({ disco }: { disco: Disco }) {
  const [broken, setBroken] = useState(false);
  const src = discoLogo(disco.provider_code, disco.logo_url);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-7 w-7 shrink-0 rounded-md bg-white object-contain"
      />
    );
  }
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[0.07] text-[8px] font-bold tracking-tight text-white/70">
      {disco.provider_code.slice(0, 5)}
    </span>
  );
}

// Mirrors the backend quote: the service fee comes off first, VAT is included
// in the rest, and the remainder buys energy at the DisCo's rate.
function estimateKwh(d: Disco, naira: number): number {
  if (!d.rate_kobo_per_kwh || !Number.isFinite(naira) || naira <= 0) return 0;
  const net = Math.round(naira * 100) - d.service_fee_kobo;
  if (net <= 0) return 0;
  const bps = d.vat_bps ?? 0;
  const energyKobo = net - Math.floor((net * bps) / (10000 + bps));
  return energyKobo / d.rate_kobo_per_kwh;
}

function formatKwh(kwh: number): string {
  return `${kwh.toLocaleString('en-NG', { maximumFractionDigits: kwh < 10 ? 1 : 0 })} kWh`;
}
