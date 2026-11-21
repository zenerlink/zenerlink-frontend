import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  LifeBuoy,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Plus,
  Printer,
  QrCode,
  Share2,
  ShieldCheck,
  Smartphone,
  X,
  Receipt,
  RotateCcw,
  ScanLine,
  Search,
  Trash2,
  Tv,
  UserRound,
  Wallet,
  BatteryCharging,
} from 'lucide-react';
import { brandedQr, brandedQrUrl } from './qr';
import { ScanDialog } from './scan';
import { ConfirmHost, askConfirm } from './confirm';
import { DiscoLogo, DiscoPicker, ErrorBox, Field, PageTitle, Spinner, estimateKwh, formatKwh, actionBtn, card, inputCls, message, naira, shortDate } from './kit';
import { MissingPaymentDialog, WithdrawCard } from './money';
import { StaffPage, isStaff } from './staff';
import { GiftPage, UnitsPage } from './units';
import { PeriodicFeedback, PurchaseFeedback } from './feedback';
import { IdentityCard } from './identity';
import type { ScanResult } from './scan';
import { discoLogo } from '../assets/discos';
import { BILL_LOGOS } from '../assets/bills';
import logo from '../assets/logo-icon-white.svg';
import payrepMark from '../assets/payrep-mark.png';
import { ApiError, IS_PRODUCTION, account, api, bills, guest, koboToNaira, nairaToKobo, requests, setSignedOutHandler } from '../lib/api';
import type { ApiMeter, BankTransfer, Bill, Notification, BillProduct, BillService, Branding, DeliveryChannel, Disco, GuestOrder, OrderGroup, PaymentRequest, PublicMeter, Schedule, User, WalletActivity, WalletEntry } from '../lib/api';
import { BrandContext, fallbackBranding, useBrand } from '../lib/brand';
import { applyBranding } from '../lib/theme';
import { formatCurrency } from '../lib/format';
import { Landing, LoginPage, ResetPasswordPage } from './Landing';
import { LegalPage } from './Legal';
import { ReceiptButton, ShareTokenDialog, StatementDialog, TokenSharePage } from './receipts';
import { legalByPath } from '../seo/legal';
import { discoBySlug } from '../seo/site';
import { buyLink, giftCode, href, readPrefill, requestCode, requestLink } from './links';
import type { Nav, Prefill } from './links';

// Buy-only product (production zenerlink.com), modelled on BuyPower: a quick
// sign-up, then an account with a wallet, a buy form, transactions, saved
// meters and profile. Signed-out pages use the full-screen split layout.

const tokenGroups = (t: string) => t.replace(/(\d{4})(?=\d)/g, '$1 ').split(' ');
const QUICK = [1000, 2000, 5000, 10000];

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
  const payCode = requestCode(url.pathname);
  const gift = giftCode(url.pathname);
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
  } else if (url.pathname.startsWith('/t/')) {
    // A shared token QR, for anyone (no account needed).
    page = <TokenSharePage code={url.pathname.slice(3)} />;
  } else if (url.pathname === '/reset-password') {
    // Opened from the reset email; works signed in or out.
    page = <ResetPasswordPage code={url.searchParams.get('code') ?? ''} nav={nav} />;
  } else if (legalByPath(url.pathname)) {
    page = <LegalPage doc={legalByPath(url.pathname)!} nav={nav} />;
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
            // The sign-in reply has no profile picture; /v1/me does.
            api.me().then((r) => r.user.avatar && setUser((cur) => (cur ? { ...cur, avatar: r.user.avatar } : cur)), () => undefined);
            // Land on Buy electricity, unless they came from a buy link or a receipt.
            if (!prefill && !orderMatch && !payCode && !gift) nav('/');
          }}
        />
      );
  } else if (url.pathname === '/home') {
    page = <Landing nav={nav} signedIn />;
  } else {
    const p = url.pathname;
    const body = orderMatch ? (
      <OrderPage id={orderMatch[1]} />
    ) : payCode ? (
      <PayRequestPage code={payCode} />
    ) : gift ? (
      <GiftPage code={gift} nav={nav} />
    ) : p.startsWith('/units') ? (
      <UnitsPage nav={nav} walletKobo={walletKobo} refreshWallet={refreshWallet} />
    ) : p.startsWith('/transactions') ? (
      <TransactionsPage />
    ) : p.startsWith('/meters') ? (
      <MetersPage />
    ) : p.startsWith('/wallet') ? (
      <WalletPage funded={url.searchParams.has('funded')} />
    ) : p.startsWith('/profile') || p.startsWith('/password') ? (
      <ProfilePage />

    ) : p.startsWith('/help') ? (
      <HelpPage />
    ) : p.startsWith('/staff') && isStaff(user.role) ? (
      <StaffPage role={user.role} />
    ) : p.startsWith('/airtime') ? (
      <BillsPage kind="phone" />
    ) : p.startsWith('/tv') ? (
      <BillsPage kind="cable" />
    ) : (
      <BuyPage
        meterId={url.searchParams.get('meter_id')}
        prefill={prefill}
        prefillAmount={url.searchParams.get('amount')}
        payWallet={url.searchParams.get('pay') === 'wallet'}
      />
    );
    page = (
      <Acct.Provider value={{ user, setUser, nav, path: p, walletKobo, refreshWallet, signOut }}>
        <Shell>{body}</Shell>
        <ConfirmHost />
        <PeriodicFeedback />
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
        <a href={href('/terms')} className="hover:text-white/70">Terms</a>
        <a href={href('/privacy')} className="hover:text-white/70">Privacy</a>
        <a href={href('/refunds')} className="hover:text-white/70">Refunds</a>
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

// The profile picture, or the initials when there is none.
function Avatar({ user, className }: { user: User; className: string }) {
  return user.avatar ? (
    <img src={user.avatar} alt="" className={`${className} rounded-full object-cover`} />
  ) : (
    <span className={`${className} grid place-items-center rounded-full bg-zener-gold/15 font-bold text-zener-gold`}>{initials(user)}</span>
  );
}

// Crops the chosen photo to a centred square and shrinks it to 256px, so the
// upload stays small whatever the phone camera produced.
async function squarePhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

const firstName = (u: User) => (u.name || '').trim().split(/\s+/)[0] || '';

// ---------------------------------------------------------------------------
// Signed-in shell: header with wallet, sidebar navigation
// ---------------------------------------------------------------------------

// Electricity is the product; airtime and TV sit below it under "More".
const MORE_NAV: [string, string, (p: { size?: number }) => React.ReactNode][] = [
  ['/airtime', 'Airtime & data', Smartphone],
  ['/tv', 'Cable TV', Tv],
];

const NAV: [string, string, (p: { size?: number }) => React.ReactNode][] = [
  ['/', 'Buy electricity', ZMark],
  ['/transactions', 'Transactions', Receipt],
  ['/meters', 'My meters', Gauge],
  ['/wallet', 'Wallet', Wallet],
  ['/units', 'Saved units', BatteryCharging],
  ['/profile', 'Profile', UserRound],
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
            <span className="text-[13px] font-black tracking-[0.2em] sm:text-[15px] sm:tracking-[0.3em]">{brand.display_name.toUpperCase()}</span>
          </a>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <a
              {...link('/wallet')}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.09] py-1.5 pl-2.5 pr-1.5 text-[13px] font-semibold hover:border-white/25 sm:gap-2 sm:pl-3"
            >
              <Wallet size={15} className="hidden text-zener-gold min-[380px]:block" />
              {walletKobo === null ? '—' : naira(walletKobo)}
              <span className="grid h-6 w-6 place-items-center rounded-full bg-zener-gold text-black" aria-label="Fund wallet">
                <Plus size={14} strokeWidth={3} />
              </span>
            </a>
            <NotificationBell />
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-[13px] font-semibold text-white/80 hover:text-white"
                aria-expanded={menu}
              >
                <Avatar user={user} className="h-8 w-8 text-[11px]" />
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
                  <a {...link('/units')} className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.05] hover:text-white">Saved units</a>
                  <a {...link('/airtime')} className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.05] hover:text-white">Airtime & data</a>
                  <a {...link('/tv')} className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.05] hover:text-white">Cable TV</a>
                  <a {...link('/transactions')} className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.05] hover:text-white">Transactions</a>
                  {isStaff(user.role) ? (
                    <a {...link('/staff')} className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.05] hover:text-white">Staff</a>
                  ) : null}
                  <a {...link('/help')} className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.05] hover:text-white">Help</a>
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
            <p className="px-3.5 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-white/30">More</p>
            {MORE_NAV.map(([to, label, Icon]) => (
              <a
                key={to}
                {...link(to)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  isActive(path, to) ? 'bg-zener-gold/[0.12] text-zener-gold' : 'text-white/45 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Icon size={16} /> {label}
              </a>
            ))}
            {isStaff(user.role) ? (
              <a
                {...link('/staff')}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  isActive(path, '/staff') ? 'bg-zener-gold/[0.12] text-zener-gold' : 'text-white/45 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <ShieldCheck size={16} /> Staff
              </a>
            ) : null}
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
      <div className="border-t border-white/[0.06] pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <SiteFooter className="mx-auto flex max-w-6xl px-4 py-6 sm:px-6" onHelp={() => nav('/help')} />
      </div>

      {/* Mobile: an app-style bottom bar, Buy first. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/[0.08] bg-[rgb(var(--zener-background))]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {MOBILE_NAV.map(([to, label, Icon]) => {
          const on = isActive(path, to);
          return (
            <a
              key={to}
              {...link(to)}
              aria-current={on ? 'page' : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${on ? 'text-zener-gold' : 'text-white/50'}`}
            >
              <Icon size={20} />
              {label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return shortDate(iso);
};

// NotificationBell shows the unread count; opening it lists the latest and marks them read.
function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api
      .notifications()
      .then((r) => {
        setItems(r.notifications);
        setUnread(r.unread ?? 0);
        setLoaded(true);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      api.readAllNotifications().catch(() => undefined);
    }
    if (!next) load(); // the dots clear once the list has been seen
  };

  return (
    <div ref={ref} className="sm:relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-white/[0.09] text-white/70 transition hover:border-white/25 hover:text-white"
      >
        <Bell size={16} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-zener-gold px-1 text-[10px] font-bold text-black">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="fixed inset-x-3 top-[4.25rem] z-40 overflow-hidden rounded-2xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-white/45 hover:bg-white/[0.06] hover:text-white">
              <X size={16} />
            </button>
          </div>
          <ul className="max-h-[min(70vh,480px)] divide-y divide-white/[0.06] overflow-y-auto overscroll-contain">
            {!loaded ? (
              <li className="grid place-items-center py-10">
                <Loader2 size={18} className="animate-spin text-white/40" />
              </li>
            ) : items.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-white/40">No notifications yet. Purchases, top-ups and requests show up here.</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.read_at ? (n.critical ? 'bg-zener-danger' : 'bg-zener-gold') : 'bg-transparent'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`truncate text-sm font-semibold ${n.read_at ? 'text-white/70' : 'text-white'}`}>{n.title}</span>
                      <span className="shrink-0 text-[11px] text-white/35">{timeAgo(n.created_at)}</span>
                    </span>
                    <span className="mt-0.5 block break-words text-[13px] leading-snug text-white/50">{n.message}</span>
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const MOBILE_NAV: [string, string, (p: { size?: number }) => React.ReactNode][] = [
  ['/', 'Buy', ZMark],
  ['/transactions', 'History', Receipt],
  ['/meters', 'Meters', Gauge],
  ['/wallet', 'Wallet', Wallet],
  ['/profile', 'Account', UserRound],
];



// ---------------------------------------------------------------------------
// Buy
// ---------------------------------------------------------------------------

function BuyPage({
  meterId,
  prefill,
  prefillAmount,
  payWallet,
}: {
  meterId: string | null;
  prefill: Prefill;
  prefillAmount?: string | null;
  payWallet: boolean;
}) {
  const { user, nav, walletKobo, refreshWallet } = useAcct();
  const [discos, setDiscos] = useState<Disco[]>([]);
  const [channels, setChannels] = useState<DeliveryChannel[]>([]);
  const [checkoutKind, setCheckoutKind] = useState<'transfer' | 'hosted'>('hosted');
  const [deliver, setDeliver] = useState<Record<DeliveryChannel, boolean>>({ email: true, sms: false, whatsapp: false });
  const [deliverPhone, setDeliverPhone] = useState('');
  // Email always goes out; only SMS and WhatsApp are opt-in.
  const extraChannels = channels.filter((c) => c !== 'email');
  const [saved, setSaved] = useState<ApiMeter[]>([]);
  const [recent, setRecent] = useState<GuestOrder[]>([]);
  const [provider, setProvider] = useState(prefill?.disco ?? '');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>(prefill?.type ?? 'prepaid');
  const [meterNumber, setMeterNumber] = useState(prefill?.meter ?? '');
  const [meter, setMeter] = useState<PublicMeter | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  // "Buy again" passes the last amount (whole naira).
  const [amount, setAmount] = useState(() => (prefillAmount && /^\d{1,7}$/.test(prefillAmount) ? prefillAmount : ''));
  const [method, setMethod] = useState<'checkout' | 'wallet'>(payWallet ? 'wallet' : 'checkout');
  // Auto-buy: repeat this purchase from the wallet every week or month.
  const [repeat, setRepeat] = useState<'once' | 'weekly' | 'monthly'>('once');
  const [weekday, setWeekday] = useState(() => new Date().getDay());
  const [monthDay, setMonthDay] = useState(() => Math.min(new Date().getDate(), 28));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduled, setScheduled] = useState('');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState<PaymentRequest | null>(null);
  const [myRequests, setMyRequests] = useState<PaymentRequest[]>([]);
  const idemKey = useRef(crypto.randomUUID());
  const loadRequests = useCallback(() => {
    requests
      .mine(10)
      .then((r) => setMyRequests(r.requests))
      .catch(() => undefined);
  }, []);
  const repeating = repeat !== 'once';
  const onScan = useCallback((r: ScanResult) => {
    setScanning(false);
    if ('request' in r) return nav(`/pay/${r.request}`);
    if ('gift' in r) return nav(`/gift/${r.gift}`);
    if ('disco' in r) {
      setProvider(r.disco);
      setMeterType(r.type);
    }
    setMeterNumber(r.meter);
  }, [nav]);
  const loadSchedules = useCallback(() => {
    account
      .schedules()
      .then((r) => setSchedules(r.schedules))
      .catch(() => undefined);
  }, []);

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
        setChannels(r.delivery_channels ?? []);
        setCheckoutKind(r.checkout === 'transfer' ? 'transfer' : 'hosted');
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
      .orders(100)
      .then((r) => setRecent(r.orders))
      .catch(() => undefined);
    loadSchedules();
    loadRequests();
  }, [meterId, loadSchedules, loadRequests]);

  // A changed form is a new purchase (new idempotency key).
  useEffect(() => {
    idemKey.current = crypto.randomUUID();
    setScheduled('');
  }, [provider, meterType, meterNumber, amount, method, repeat, weekday, monthDay]);

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
  // Convenience fee by payment method, added on top of the electricity amount.
  const feeFor = (m: 'checkout' | 'wallet') => koboToNaira((m === 'wallet' ? disco?.wallet_fee_kobo : disco?.checkout_fee_kobo) ?? 0);
  const methodFee = feeFor(repeating ? 'wallet' : method);
  const amountOk = Number.isFinite(value) && value >= minNaira && value <= maxNaira;
  const total = amountOk ? value + methodFee : value;
  const walletShort = !repeating && method === 'wallet' && walletKobo !== null && amountOk && nairaToKobo(total) > walletKobo;
  const feeNote = (m: 'checkout' | 'wallet') => (feeFor(m) > 0 ? ` · ₦${feeFor(m).toLocaleString('en-NG')} fee` : feeFor(m === 'wallet' ? 'checkout' : 'wallet') > 0 ? ' · No fee' : '');
  const ready = !!meter?.verified && amountOk && !walletShort;
  const kwh = disco ? estimateKwh(disco, value) : 0;

  const repeatDay = repeat === 'weekly' ? weekday : monthDay;
  const repeatLabel = repeating ? repeatText(repeat, repeatDay) : '';
  const repeatWhen = repeating ? repeatPhrase(repeat, repeatDay) : '';

  const schedule = async () => {
    setError('');
    if (!meter?.verified) return setError('Enter a meter number we can verify.');
    if (!amountOk) return setError(`Enter an amount between ${formatCurrency(minNaira)} and ${formatCurrency(maxNaira)}.`);
    setPaying(true);
    try {
      const sc = await account.createSchedule(
        {
          provider_code: provider,
          meter_number: meterNumber,
          meter_type: meterType,
          amount_kobo: nairaToKobo(value),
          frequency: repeat as 'weekly' | 'monthly',
          day: repeat === 'weekly' ? weekday : monthDay,
        },
        idemKey.current,
      );
      setScheduled(`Auto-buy is on. First purchase ${formatRunDate(sc.next_run_at)}.`);
      loadSchedules();
    } catch (e) {
      setError(message(e));
    } finally {
      setPaying(false);
    }
  };

  // "Ask someone to pay": a QR / link for exactly this meter and amount.
  const ask = async () => {
    setError('');
    if (!meter?.verified) return setError('Enter a meter number we can verify.');
    if (!amountOk) return setError(`Enter an amount between ${formatCurrency(minNaira)} and ${formatCurrency(maxNaira)}.`);
    setAsking(true);
    try {
      const r = await requests.create(
        { provider_code: provider, meter_number: meterNumber, meter_type: meterType, amount_kobo: nairaToKobo(value) },
        `req-${idemKey.current}`,
      );
      setAsked(r);
      loadRequests();
    } catch (e) {
      setError(message(e));
    } finally {
      setAsking(false);
    }
  };

  const pay = async () => {
    if (repeating) return schedule();
    setError('');
    if (!meter?.verified) return setError('Enter a meter number we can verify.');
    if (!amountOk) return setError(`Enter an amount between ${formatCurrency(minNaira)} and ${formatCurrency(maxNaira)}.`);
    setPaying(true);
    try {
      const o = await account.order(
        {
          provider_code: provider,
          meter_number: meterNumber,
          meter_type: meterType,
          amount_kobo: nairaToKobo(value),
          payment_method: method,
          deliver_to: {
            email: channels.includes('email'),
            sms: channels.includes('sms') && deliver.sms,
            whatsapp: channels.includes('whatsapp') && deliver.whatsapp,
            phone: deliverPhone || user.phone,
          },
        },
        idemKey.current,
      );
      if (o.status === 'payment_pending' && o.checkout_url && !o.bank_transfer) {
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
        <div className={`${card} min-w-0 space-y-6 p-5 sm:p-7`}>
          {saved.length ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white/70">Saved meters</span>
                <button type="button" onClick={() => nav('/meters')} className="text-xs font-semibold text-white/40 hover:text-white">
                  Manage
                </button>
              </div>
              {/* One scrolling row, so many meters never crowd the form. */}
              <div
                onWheel={(e) => {
                  // A mouse wheel scrolls the row sideways.
                  const el = e.currentTarget;
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) el.scrollLeft += e.deltaY;
                }}
                className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [mask-image:linear-gradient(to_right,#000_85%,transparent)] sm:-mx-7 sm:px-7">
                {saved.map((m) => {
                  const active = m.meter_number === meterNumber && m.provider_code === provider;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pickSaved(m)}
                      className={`flex shrink-0 items-center gap-2.5 rounded-lg border py-2 pl-2 pr-3 text-left text-xs transition ${
                        active ? 'border-zener-gold/60 bg-zener-gold/10' : 'border-white/[0.08] hover:border-white/20'
                      }`}
                    >
                      <DiscoLogo disco={{ provider_code: m.provider_code, logo_url: '' } as Disco} />
                      <span className="min-w-0">
                        <span className={`block max-w-[150px] truncate font-semibold ${active ? 'text-zener-gold' : 'text-white/80'}`}>{m.label || m.customer_name}</span>
                        <span className="block font-mono text-[11px] text-white/40">{m.meter_number}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
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
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
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
              <button
                type="button"
                onClick={() => setScanning(true)}
                aria-label="Scan meter QR code"
                className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.09] px-4 text-sm font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
              >
                <ScanLine size={18} /> <span className="hidden sm:inline">Scan</span>
              </button>
            </div>
            {scanning ? <ScanDialog onResult={onScan} onClose={() => setScanning(false)} /> : null}
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

          <Field label="How often">
            <Segmented
              value={repeat}
              onChange={setRepeat}
              options={[
                ['once', 'Just now'],
                ['weekly', 'Every week'],
                ['monthly', 'Every month'],
              ]}
            />
            {repeat === 'weekly' ? (
              <div className="mt-2.5 grid grid-cols-7 gap-2">
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setWeekday(i)}
                    className={`rounded-lg border py-2 text-xs font-semibold transition ${
                      weekday === i ? 'border-zener-gold/60 bg-zener-gold/10 text-zener-gold' : 'border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            ) : repeat === 'monthly' ? (
              <select value={monthDay} onChange={(e) => setMonthDay(Number(e.target.value))} className={`${inputCls} mt-2.5`}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d} className="bg-zener-surface">
                    On the {ordinal(d)} of every month
                  </option>
                ))}
              </select>
            ) : null}
            {repeating ? (
              <p className="mt-2 text-xs text-white/35">
                We buy from your wallet at 8:00 am {repeatWhen} and email your token. If your balance is low, we remind you the day before.
              </p>
            ) : null}
          </Field>

          {repeating ? (
            <Field label="Pay with">
              <MethodOption
                active
                onClick={() => undefined}
                title="Wallet"
                sub={`${walletKobo === null ? 'Balance —' : `Balance ${naira(walletKobo)}`}${feeNote('wallet')}`}
              />
              {walletKobo !== null && amountOk && nairaToKobo(total) > walletKobo ? (
                <p className="mt-2 text-sm text-yellow-300/90">
                  Fund your wallet before the first date.{' '}
                  <button type="button" onClick={() => nav('/wallet')} className="font-semibold text-zener-gold hover:underline">Fund wallet</button>
                </p>
              ) : null}
            </Field>
          ) : (
            <Field label="Pay with">
              <div className="grid gap-2 sm:grid-cols-2">
                <MethodOption
                  active={method === 'checkout'}
                  onClick={() => setMethod('checkout')}
                  title={checkoutKind === 'transfer' ? 'Bank transfer' : 'Card, transfer or USSD'}
                  sub={`${checkoutKind === 'transfer' ? 'Pay from any bank app' : 'Secure checkout'}${feeNote('checkout')}`}
                />
                <MethodOption
                  active={method === 'wallet'}
                  onClick={() => setMethod('wallet')}
                  title="Wallet"
                  sub={`${walletKobo === null ? 'Balance —' : `Balance ${naira(walletKobo)}`}${feeNote('wallet')}`}
                />
              </div>
              {walletShort ? (
                <p className="mt-2 text-sm text-yellow-300/90">
                  Your wallet balance is too low.{' '}
                  <button type="button" onClick={() => nav('/wallet')} className="font-semibold text-zener-gold hover:underline">Fund wallet</button>
                </p>
              ) : null}
            </Field>
          )}

          {channels.includes('email') ? (
            <p className="flex items-center gap-2 text-xs text-white/45">
              <Check size={14} className="shrink-0 text-zener-gold" />
              <span className="min-w-0 break-words">Your token and receipt will also be emailed to {user.email}</span>
            </p>
          ) : null}

          {extraChannels.length && !repeating ? (
            <Field label="Also send my token by">
              <div className="flex flex-wrap gap-2">
                {extraChannels.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={deliver[c]}
                    onClick={() => setDeliver((d) => ({ ...d, [c]: !d[c] }))}
                    className={`flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition ${
                      deliver[c] ? 'border-zener-gold/60 bg-zener-gold/10 text-zener-gold' : 'border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {deliver[c] ? <Check size={15} /> : null}
                    {c === 'sms' ? 'SMS' : 'WhatsApp'}
                  </button>
                ))}
              </div>
              {(deliver.sms && channels.includes('sms')) || (deliver.whatsapp && channels.includes('whatsapp')) ? (
                <input
                  value={deliverPhone || user.phone}
                  onChange={(e) => setDeliverPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Phone number, e.g. 0803 123 4567"
                  className={`${inputCls} mt-2.5`}
                />
              ) : null}
            </Field>
          ) : null}

          {error ? <p className="rounded-lg bg-zener-danger/10 px-3.5 py-2.5 text-sm text-zener-danger">{error}</p> : null}
          {scheduled ? (
            <p className="flex items-center gap-2 rounded-lg bg-zener-success/10 px-3.5 py-2.5 text-sm text-zener-success">
              <Check size={15} className="shrink-0" /> {scheduled}
            </p>
          ) : null}

          <button
            type="button"
            disabled={paying || !ready || !!scheduled}
            onClick={() => void pay()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-[15px] font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {paying && <Loader2 size={18} className="animate-spin" />}
            {repeating
              ? paying
                ? 'Setting up…'
                : value > 0
                  ? `Auto-buy ${formatCurrency(total)} ${repeatWhen}`
                  : 'Start auto-buy'
              : paying
                ? method === 'wallet'
                  ? 'Buying…'
                  : 'Starting secure payment…'
                : value > 0
                  ? `Pay ${formatCurrency(total)}`
                  : 'Pay'}
          </button>
          {!repeating ? (
            <button
              type="button"
              disabled={asking || !meter?.verified || !amountOk}
              onClick={() => void ask()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] text-sm font-semibold text-white/80 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {asking ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
              {value > 0 && amountOk ? `Ask someone to pay ${formatCurrency(value)}` : 'Ask someone to pay'}
            </button>
          ) : null}
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/35">
            <Lock size={12} /> Processed securely. Receipt to {user.email}
          </p>
          {asked ? <RequestQrDialog request={asked} onClose={() => setAsked(null)} /> : null}
        </div>

        <div className="space-y-6">
          <div className={`${card} p-6`}>
            <p className="mb-4 text-xs font-semibold text-white/40">Your order</p>
            <dl className="space-y-3 text-sm">
              <SummaryRow label="DisCo" value={disco?.provider_name} />
              <SummaryRow label="Meter" value={meterNumber ? `${meterNumber} · ${meterType}` : undefined} />
              <SummaryRow label="Name" value={meter?.verified ? meter.customer_name : undefined} />
              <div className="border-t border-white/[0.08] pt-3">
                <SummaryRow label="Electricity" value={value > 0 ? formatCurrency(value) : undefined} />
                {kwh > 0 ? <SummaryRow label="Estimated energy" value={`≈ ${formatKwh(kwh)}`} /> : null}
                {fee > 0 ? <p className="mt-1 text-right text-xs text-white/35">includes {formatCurrency(fee)} service charge</p> : null}
                {methodFee > 0 ? <SummaryRow label={repeating || method === 'wallet' ? 'Wallet fee' : 'Convenience fee'} value={formatCurrency(methodFee)} /> : null}
              </div>
              {repeating ? (
                <div className="border-t border-white/[0.08] pt-3">
                  <SummaryRow label="Repeats" value={repeatLabel} />
                </div>
              ) : null}
              <div className="border-t border-white/[0.08] pt-3">
                <SummaryRow label={repeating ? 'Each time' : 'Total'} value={value > 0 ? formatCurrency(total) : undefined} strong />
              </div>
            </dl>
          </div>
          <UnitsCard orders={recent} />
          <AutoBuyCard schedules={schedules} onChange={loadSchedules} />
          <RequestsCard requests={myRequests} onOpen={(r) => (r.status === 'open' ? setAsked(r) : nav(`/pay/${r.code}`))} />
          {recent.length ? (
            <div className={`${card} p-6`}>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-xs font-semibold text-white/40">Recent purchases</p>
                <button type="button" onClick={() => nav('/transactions')} className="text-xs font-semibold text-white/50 hover:text-white">View all</button>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {recent.slice(0, 4).map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => nav(`/order/${o.id}`)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-white/80">{o.meter_number}</span>
                        <span className="block truncate text-xs text-white/35">{o.provider_name}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold">{naira(o.amount_kobo)}</span>
                        {bought(o) && o.energy_kwh ? <span className="block text-xs text-zener-gold">{formatKwh(o.energy_kwh)}</span> : null}
                      </span>
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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

// "Every Wednesday" / "Monthly on the 1st"; repeatPhrase is the same inside a sentence.
function repeatText(freq: 'weekly' | 'monthly', day: number): string {
  return freq === 'weekly' ? `Every ${WEEKDAYS[day]}` : `Monthly on the ${ordinal(day)}`;
}

function repeatPhrase(freq: 'weekly' | 'monthly', day: number): string {
  return freq === 'weekly' ? `every ${WEEKDAYS[day]}` : `on the ${ordinal(day)} of every month`;
}

const formatRunDate = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });

// AutoBuyCard lists the customer's auto-buys, with pause / resume / remove.
function AutoBuyCard({ schedules, onChange }: { schedules: Schedule[]; onChange: () => void }) {
  const [busy, setBusy] = useState('');
  if (!schedules.length) return null;
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
    } catch {
      /* the list reloads either way */
    } finally {
      setBusy('');
      onChange();
    }
  };
  return (
    <div className={`${card} p-6`}>
      <p className="mb-2 text-xs font-semibold text-white/40">Auto-buy</p>
      <ul className="divide-y divide-white/[0.06]">
        {schedules.map((sc) => (
          <li key={sc.id} className="py-2.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-white/80">{sc.meter_number}</span>
                <span className="block truncate text-xs text-white/35">
                  {sc.provider_name} · {repeatText(sc.frequency, sc.day)}
                </span>
              </span>
              <span className="shrink-0 text-right font-semibold">{naira(sc.amount_kobo)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
              <span className={sc.active && sc.last_status === 'waiting_funds' ? 'text-yellow-300/90' : sc.active ? 'text-zener-gold' : 'text-white/35'}>
                {!sc.active
                  ? 'Paused'
                  : sc.last_status === 'waiting_funds'
                    ? 'Waiting for wallet funds'
                    : `Next: ${formatRunDate(sc.next_run_at)}`}
              </span>
              <span className="flex shrink-0 gap-3">
                <button
                  type="button"
                  disabled={busy === sc.id}
                  onClick={() => void act(sc.id, () => account.setScheduleActive(sc.id, !sc.active))}
                  className="font-semibold text-white/50 hover:text-white disabled:opacity-40"
                >
                  {sc.active ? 'Pause' : 'Resume'}
                </button>
                <button
                  type="button"
                  disabled={busy === sc.id}
                  onClick={async () => {
                    const ok = await askConfirm({
                      title: 'Stop this auto-buy?',
                      message: `We won't buy ${naira(sc.amount_kobo)} for meter ${sc.meter_number} any more. You can set it up again any time.`,
                      confirmLabel: 'Stop auto-buy',
                      cancelLabel: 'Keep it',
                      danger: true,
                    });
                    if (ok) void act(sc.id, () => account.removeSchedule(sc.id));
                  }}
                  className="font-semibold text-white/50 hover:text-zener-danger disabled:opacity-40"
                >
                  Remove
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment requests: "pay for my electricity"
// ---------------------------------------------------------------------------

const REQUEST_STATUS: Record<PaymentRequest['status'], [string, string]> = {
  open: ['Waiting', 'text-zener-gold'],
  paying: ['Being paid', 'text-yellow-300/90'],
  paid: ['Paid', 'text-zener-success'],
  cancelled: ['Cancelled', 'text-white/35'],
  expired: ['Expired', 'text-white/35'],
};

// RequestQrDialog shows the QR and link for a request, to share with whoever pays.
function RequestQrDialog({ request, onClose }: { request: PaymentRequest; onClose: () => void }) {
  const brand = useBrand();
  const link = requestLink(request.code);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);
  const sendEmail = async () => {
    setSending(true);
    setSent(null);
    try {
      const r = await requests.email(request.code, to);
      setSent({ ok: true, text: `Sent to ${r.sent_to}` });
      setTo('');
    } catch (e) {
      setSent({ ok: false, text: message(e) });
    } finally {
      setSending(false);
    }
  };
  const text = `Please pay ${naira(request.amount_kobo)} for my electricity (${request.provider_name}, meter ${request.meter_number}).`;

  useEffect(() => {
    brandedQrUrl(link, 480, brand.logo_url || logo).then(setQr).catch(() => undefined);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [link, brand.logo_url, onClose]);

  const copy = () => {
    void navigator.clipboard?.writeText(link);
    setCopied(true);
  };
  const share = async () => {
    try {
      if (qr) {
        const file = new File([await (await fetch(qr)).blob()], `pay-${request.code}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text: `${text}\n${link}` });
      }
      if (navigator.share) return await navigator.share({ title: 'Pay for my electricity', text, url: link });
      copy();
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Payment request" className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Ask someone to pay</h2>
            <p className="truncate text-sm text-white/45">
              {naira(request.amount_kobo)} · {request.meter_number} · {request.customer_name || request.provider_name}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/45 hover:bg-white/[0.06] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="mx-auto mt-5 grid aspect-square w-full max-w-[260px] place-items-center rounded-xl bg-white p-3">
          {qr ? <img src={qr} alt="QR code to pay this request" className="h-full w-full" /> : <Loader2 className="animate-spin text-black/40" />}
        </div>
        <p className="mt-4 text-center text-sm text-white/55">
          They scan this in {brand.display_name} or with their phone camera and pay exactly {naira(request.amount_kobo)}. Your token comes to you by email and
          on this page. It works once and expires in 7 days.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void share()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110">
            <Share2 size={16} /> Share
          </button>
          <button type="button" onClick={copy} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold hover:bg-white/[0.12]">
            {copied ? <Check size={16} className="text-zener-success" /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        {request.status === 'open' ? (
          <form
            className="mt-4 border-t border-white/[0.08] pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (to.trim()) void sendEmail();
            }}
          >
            <label className="mb-2 block text-sm font-medium text-white/70">Or send it by email</label>
            <div className="flex gap-2">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="their@email.com"
                className={`${inputCls} min-w-0 flex-1`}
              />
              <button
                type="submit"
                disabled={sending || !to.trim()}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-bold hover:bg-white/[0.12] disabled:opacity-40"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Send
              </button>
            </div>
            {sent ? <p className={`mt-2 text-sm ${sent.ok ? 'text-zener-success' : 'text-zener-danger'}`}>{sent.text}</p> : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}

// RequestsCard lists the customer's recent requests on the buy page.
function RequestsCard({ requests: list, onOpen }: { requests: PaymentRequest[]; onOpen: (r: PaymentRequest) => void }) {
  if (!list.length) return null;
  return (
    <div className={`${card} p-6`}>
      <p className="mb-2 text-xs font-semibold text-white/40">Payment requests</p>
      <ul className="divide-y divide-white/[0.06]">
        {list.slice(0, 4).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(r)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm">
              <span className="min-w-0">
                <span className="block truncate text-white/80">{r.meter_number}</span>
                <span className="block truncate text-xs text-white/35">
                  {r.status === 'paid' && r.payer_name ? `Paid by ${r.payer_name}` : r.provider_name}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold">{naira(r.amount_kobo)}</span>
                <span className={`block text-xs ${REQUEST_STATUS[r.status][1]}`}>{REQUEST_STATUS[r.status][0]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// PayRequestPage is where a scanned request lands: the payer pays the exact
// amount; the requester sees its status and, once paid, the token.
function PayRequestPage({ code }: { code: string }) {
  const { nav, walletKobo, refreshWallet } = useAcct();
  const [req, setReq] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState('');
  const [checkoutKind, setCheckoutKind] = useState<'transfer' | 'hosted'>('hosted');
  const [method, setMethod] = useState<'checkout' | 'wallet'>('checkout');
  const [paying, setPaying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const idemKey = useRef(crypto.randomUUID());

  const load = useCallback(() => {
    requests
      .get(code)
      .then(setReq)
      .catch((e) => setError(message(e)));
  }, [code]);
  useEffect(() => {
    load();
    guest
      .discos()
      .then((r) => setCheckoutKind(r.checkout === 'transfer' ? 'transfer' : 'hosted'))
      .catch(() => undefined);
  }, [load]);
  // The requester's page updates by itself once someone pays.
  useEffect(() => {
    if (!req?.mine || (req.status !== 'open' && req.status !== 'paying')) return;
    const t = window.setInterval(load, 8000);
    return () => window.clearInterval(t);
  }, [req?.mine, req?.status, load]);
  useEffect(() => {
    idemKey.current = crypto.randomUUID();
  }, [method]);

  if (error && !req) return <ErrorBox text={error} />;
  if (!req) return <Spinner />;

  const short = method === 'wallet' && walletKobo !== null && req.amount_kobo > walletKobo;
  const pay = async () => {
    setError('');
    setPaying(true);
    try {
      const o = await requests.pay(code, { payment_method: method }, idemKey.current);
      if (o.status === 'payment_pending' && o.checkout_url && !o.bank_transfer) {
        window.location.assign(o.checkout_url);
        return;
      }
      refreshWallet();
      nav(`/order/${o.id}`);
    } catch (e) {
      setError(message(e));
      setPaying(false);
      load();
    }
  };

  const details = (
    <dl className={`${card} space-y-3 p-6 text-sm`}>
      <SummaryRow label="Electricity company" value={req.provider_name} />
      <SummaryRow label="Meter" value={`${req.meter_number} · ${req.meter_type}`} />
      <SummaryRow label="Account name" value={req.customer_name} />
      {req.note ? <SummaryRow label="Note" value={req.note} /> : null}
      <div className="border-t border-white/[0.08] pt-3">
        <SummaryRow label="Amount" value={naira(req.amount_kobo)} strong />
      </div>
    </dl>
  );

  if (req.mine) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <PageTitle title="Payment request" sub={`Created ${shortDate(req.created_at)}`} />
        {req.status === 'paid' ? (
          <div className="rounded-2xl border border-zener-success/30 bg-zener-success/[0.06] p-6 text-center">
            <p className="text-sm text-white/60">{req.payer_name ? `${req.payer_name} paid your request` : 'Your request was paid'}</p>
            {req.token ? (
              <>
                <p className="mt-3 font-mono text-2xl font-bold tracking-wider text-zener-gold">{req.token.replace(/(\d{4})(?=\d)/g, '$1-')}</p>
                {req.energy_kwh ? <p className="mt-1 text-sm text-white/50">{req.energy_kwh.toFixed(1)} kWh</p> : null}
                <div className="mt-3 flex justify-center">
                  <CopyButton text={req.token} />
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] p-6 text-sm text-white/60">
            {req.status === 'open' || req.status === 'paying' ? <Loader2 size={18} className="animate-spin text-zener-gold" /> : null}
            {req.status === 'open'
              ? 'Waiting for someone to pay. This page updates by itself.'
              : req.status === 'paying'
                ? 'Someone is paying this now…'
                : req.status === 'cancelled'
                  ? 'You cancelled this request.'
                  : 'This request expired before anyone paid it.'}
          </div>
        )}
        {details}
        {req.status === 'paid' && req.order_id ? (
          <button type="button" onClick={() => nav(`/order/${req.order_id}`)} className="flex h-12 w-full items-center justify-center rounded-xl border border-white/[0.1] text-sm font-semibold text-white/80 hover:border-white/25 hover:text-white">
            View receipt
          </button>
        ) : null}
        {req.status === 'open' ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSharing(true)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110">
              <QrCode size={16} /> Show QR
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await askConfirm({
                  title: 'Cancel this request?',
                  message: 'The QR code and link will stop working, so nobody can pay it.',
                  confirmLabel: 'Cancel request',
                  cancelLabel: 'Keep it',
                  danger: true,
                });
                if (ok)
                  requests
                    .cancel(code)
                    .then(setReq)
                    .catch((e) => setError(message(e)));
              }}
              className="flex h-12 items-center justify-center rounded-xl border border-white/[0.1] text-sm font-semibold text-white/70 hover:border-zener-danger/50 hover:text-zener-danger"
            >
              Cancel request
            </button>
          </div>
        ) : null}
        {error ? <ErrorBox text={error} /> : null}
        {sharing ? <RequestQrDialog request={req} onClose={() => setSharing(false)} /> : null}
      </div>
    );
  }

  const closed = req.status !== 'open' && !(req.status === 'paying' && req.paid_by_me);
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageTitle title={`Pay for ${req.requester_name || 'their'}${req.requester_name ? "'s" : ''} electricity`} sub={`${req.requester_name || 'Someone'} asked you to pay ${naira(req.amount_kobo)}.`} />
      {details}
      {closed ? (
        <div className="rounded-2xl border border-white/[0.07] p-6 text-sm text-white/60">
          {req.status === 'paid'
            ? req.paid_by_me
              ? 'You paid this request. Thank you!'
              : 'This request has already been paid.'
            : req.status === 'paying'
              ? 'Someone is paying this request right now.'
              : req.status === 'cancelled'
                ? 'This request was cancelled.'
                : 'This request has expired. Ask for a new one.'}
          {req.paid_by_me && req.order_id ? (
            <button type="button" onClick={() => nav(`/order/${req.order_id}`)} className="mt-3 block font-semibold text-zener-gold hover:underline">
              View your receipt
            </button>
          ) : null}
        </div>
      ) : (
        <div className={`${card} space-y-5 p-6`}>
          <Field label="Pay with">
            <div className="grid gap-2 sm:grid-cols-2">
              <MethodOption
                active={method === 'checkout'}
                onClick={() => setMethod('checkout')}
                title={checkoutKind === 'transfer' ? 'Bank transfer' : 'Card, transfer or USSD'}
                sub={checkoutKind === 'transfer' ? 'Pay from any bank app' : 'Secure checkout'}
              />
              <MethodOption active={method === 'wallet'} onClick={() => setMethod('wallet')} title="Wallet" sub={walletKobo === null ? 'Balance —' : `Balance ${naira(walletKobo)}`} />
            </div>
            {short ? (
              <p className="mt-2 text-sm text-yellow-300/90">
                Your wallet balance is too low.{' '}
                <button type="button" onClick={() => nav('/wallet')} className="font-semibold text-zener-gold hover:underline">
                  Fund wallet
                </button>
              </p>
            ) : null}
          </Field>
          {error ? <p className="rounded-lg bg-zener-danger/10 px-3.5 py-2.5 text-sm text-zener-danger">{error}</p> : null}
          <button
            type="button"
            disabled={paying || short}
            onClick={() => void pay()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-[15px] font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {paying && <Loader2 size={18} className="animate-spin" />}
            {paying ? 'Starting payment…' : `Pay ${naira(req.amount_kobo + (method === 'checkout' ? req.fee_kobo : 0))}`}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/35">
            <Lock size={12} /> The token goes to {req.requester_name || 'them'}; you get the receipt.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Airtime, data and cable TV (paid from the wallet)
// ---------------------------------------------------------------------------

const AIRTIME_QUICK = [100, 200, 500, 1000];

const BILL_STATUS: Record<Bill['status'], [string, string]> = {
  successful: ['Successful', 'text-zener-success'],
  processing: ['Processing', 'text-yellow-300/90'],
  needs_review: ['Delayed', 'text-yellow-300/90'],
  refunded: ['Refunded', 'text-white/50'],
};

function billTitle(b: Bill): string {
  if (b.category === 'airtime') return `${b.service_name} airtime`;
  if (b.category === 'data') return b.product_name || `${b.service_name} data`;
  return `${b.service_name} · ${b.product_name}`;
}

// ServicePicker chooses a network or cable provider, with its logo.
function ServicePicker({ services, value, onChange }: { services: BillService[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(services.length, 1)}, minmax(0, 1fr))` }}>
      {services.map((sv) => {
        const on = sv.code === value;
        const logo = BILL_LOGOS[sv.code];
        return (
          <button
            key={sv.code}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(sv.code)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-xs font-semibold transition ${
              on ? 'border-zener-gold/60 bg-zener-gold/10 text-zener-gold' : 'border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white'
            }`}
          >
            {logo ? (
              <img src={logo} alt="" className={`h-9 w-9 rounded-lg object-cover transition ${on ? '' : 'opacity-70'}`} />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.07] text-[9px] font-bold">{sv.code.slice(0, 4)}</span>
            )}
            <span className="truncate">{sv.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function BillsPage({ kind }: { kind: 'phone' | 'cable' }) {
  const { user, nav, walletKobo, refreshWallet } = useAcct();
  const [networks, setNetworks] = useState<BillService[]>([]);
  const [providers, setProviders] = useState<BillService[]>([]);
  const [limits, setLimits] = useState({ min: 50, max: 50000 });
  const [category, setCategory] = useState<'airtime' | 'data'>('airtime');
  const [service, setService] = useState(kind === 'cable' ? 'DSTV' : '');
  const [recipient, setRecipient] = useState(kind === 'phone' ? user.phone || '' : '');
  const [lookup, setLookup] = useState<{ name?: string; current?: string; error?: string }>({});
  const [checking, setChecking] = useState(false);
  const [products, setProducts] = useState<BillProduct[]>([]);
  const [productId, setProductId] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<Bill | null>(null);
  const [recent, setRecent] = useState<Bill[]>([]);
  const idemKey = useRef(crypto.randomUUID());
  const cat = kind === 'cable' ? 'cable' : category;

  const loadRecent = useCallback(() => {
    bills
      .list(50)
      .then((r) => setRecent(r.bills.filter((b) => (kind === 'cable' ? b.category === 'cable' : b.category !== 'cable'))))
      .catch(() => undefined);
  }, [kind]);

  useEffect(() => {
    bills
      .services()
      .then((r) => {
        setNetworks(r.networks);
        setProviders(r.cable);
        setLimits({ min: koboToNaira(r.airtime.min_kobo), max: koboToNaira(r.airtime.max_kobo) });
      })
      .catch((e) => setError(message(e)));
    loadRecent();
  }, [loadRecent]);

  // A changed form is a new purchase.
  useEffect(() => {
    idemKey.current = crypto.randomUUID();
  }, [cat, service, recipient, productId, amount]);

  // Phone: find the network once the number is complete. Cable: check the card.
  useEffect(() => {
    setLookup({});
    const digits = recipient.replace(/\D/g, '');
    if (kind === 'phone' ? digits.length < 11 : digits.length < 8 || !service) return;
    let live = true;
    const t = window.setTimeout(async () => {
      setChecking(true);
      try {
        const r = await bills.lookup(cat, service, recipient);
        if (!live) return;
        if (kind === 'phone') {
          if (r.network) setService(r.network);
        } else setLookup({ name: r.customer_name, current: r.current_package });
      } catch (e) {
        if (live) setLookup({ error: message(e) });
      } finally {
        if (live) setChecking(false);
      }
    }, 500);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // The network is an output of the phone lookup, so it is not a dependency there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipient, kind === 'cable' ? service : '']);

  // Plans for data and cable.
  useEffect(() => {
    setProducts([]);
    setProductId('');
    if (cat === 'airtime' || !service) return;
    let live = true;
    setLoadingPlans(true);
    bills
      .products(cat, service)
      .then((r) => live && setProducts(r.products))
      .catch((e) => live && setError(message(e)))
      .finally(() => live && setLoadingPlans(false));
    return () => {
      live = false;
    };
  }, [cat, service]);

  const product = products.find((p) => p.id === productId);
  const value = cat === 'airtime' ? Number(amount) : product ? koboToNaira(product.price_kobo) : 0;
  const amountOk = cat === 'airtime' ? Number.isInteger(value) && value >= limits.min && value <= limits.max : !!product;
  const phoneOk = recipient.replace(/\D/g, '').length >= 10;
  const short = walletKobo !== null && amountOk && nairaToKobo(value) > walletKobo;
  const ready = !!service && amountOk && !short && (kind === 'phone' ? phoneOk : !!lookup.name);
  const groups = products.reduce<Record<string, BillProduct[]>>((acc, p) => {
    const g = p.group || 'Plans';
    (acc[g] ||= []).push(p);
    return acc;
  }, {});
  const serviceName = (kind === 'cable' ? providers : networks).find((n) => n.code === service)?.name;

  const pay = async () => {
    setError('');
    setPaying(true);
    try {
      let b = await bills.buy(
        { category: cat, service, recipient, product_id: cat === 'airtime' ? undefined : productId, amount_kobo: cat === 'airtime' ? nairaToKobo(value) : undefined },
        idemKey.current,
      );
      setResult(b);
      refreshWallet();
      for (let i = 0; i < 20 && b.status === 'processing'; i++) {
        await new Promise((r) => window.setTimeout(r, 3000));
        b = await bills.get(b.id);
        setResult(b);
      }
      refreshWallet();
      loadRecent();
    } catch (e) {
      setError(message(e));
    } finally {
      setPaying(false);
    }
  };

  const again = () => {
    setResult(null);
    setAmount('');
    setProductId('');
    idemKey.current = crypto.randomUUID();
  };

  return (
    <>
      <PageTitle
        title={kind === 'cable' ? 'Cable TV' : 'Airtime & data'}
        sub={kind === 'cable' ? 'Renew DStv, GOtv or StarTimes from your wallet in seconds.' : 'Top up any MTN, Airtel, Glo or 9mobile number from your wallet.'}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`${card} min-w-0 space-y-6 p-5 sm:p-7`}>
          {result ? (
            <div className="space-y-4">
              <div
                className={`rounded-2xl border p-6 text-sm ${
                  result.status === 'successful'
                    ? 'border-zener-success/30 bg-zener-success/[0.06]'
                    : result.status === 'refunded'
                      ? 'border-white/[0.08]'
                      : 'border-yellow-300/20 bg-yellow-300/[0.04]'
                }`}
              >
                <p className="flex items-center gap-2 text-base font-semibold">
                  {result.status === 'processing' ? <Loader2 size={18} className="animate-spin text-zener-gold" /> : result.status === 'successful' ? <Check size={18} className="text-zener-success" /> : null}
                  {result.status === 'successful' ? 'Done' : result.status === 'refunded' ? 'Not completed' : 'Processing'}
                </p>
                <p className="mt-1.5 text-white/60">
                  {result.status === 'successful'
                    ? `${billTitle(result)} for ${result.customer_name || result.recipient} — ${naira(result.amount_kobo)}.`
                    : result.message}
                </p>
              </div>
              <dl className="space-y-3 text-sm">
                <SummaryRow label={kind === 'cable' ? 'Provider' : 'Network'} value={result.service_name} />
                <SummaryRow label={kind === 'cable' ? 'Smartcard / IUC' : 'Phone number'} value={result.recipient} />
                {result.customer_name ? <SummaryRow label="Name" value={result.customer_name} /> : null}
                {result.product_name ? <SummaryRow label={kind === 'cable' ? 'Package' : 'Plan'} value={result.product_name} /> : null}
                <SummaryRow label="Reference" value={result.id.slice(0, 8).toUpperCase()} />
                <SummaryRow label="Amount" value={naira(result.amount_kobo)} strong />
              </dl>
              {result.sandbox ? <p className="text-xs text-yellow-300/80">Test mode: nothing was sent to the network.</p> : null}
              <button
                type="button"
                onClick={again}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-white/[0.1] text-sm font-semibold text-white/80 transition hover:border-white/25 hover:text-white"
              >
                Buy another
              </button>
            </div>
          ) : (
            <>
              {kind === 'phone' ? (
                <Field label="What do you want to buy?">
                  <Segmented value={category} onChange={setCategory} options={[['airtime', 'Airtime'], ['data', 'Data']]} />
                </Field>
              ) : (
                <Field label="Provider">
                  <ServicePicker services={providers} value={service} onChange={setService} />
                </Field>
              )}

              <Field label={kind === 'cable' ? 'Smartcard / IUC number' : 'Phone number'}>
                <div className="relative">
                  <input
                    inputMode={kind === 'cable' ? 'numeric' : 'tel'}
                    autoComplete={kind === 'cable' ? 'off' : 'tel'}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value.replace(kind === 'cable' ? /\D/g : /[^\d+ ]/g, '').slice(0, 20))}
                    placeholder={kind === 'cable' ? 'Enter the number on your decoder' : '0803 123 4567'}
                    className={`${inputCls} pr-11 tracking-wide`}
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
                    {checking ? <Loader2 size={18} className="animate-spin text-white/40" /> : lookup.name ? <Check size={18} className="text-zener-success" /> : null}
                  </span>
                </div>
                {kind === 'cable' ? (
                  lookup.name ? (
                    <p className="mt-2 text-sm">
                      <span className="font-semibold text-white">{lookup.name}</span>
                      {lookup.current ? <span className="text-white/40"> · Current package: {lookup.current}</span> : null}
                    </p>
                  ) : lookup.error ? (
                    <p className="mt-2 text-sm text-zener-danger">{lookup.error}</p>
                  ) : (
                    <p className="mt-2 text-xs text-white/35">We confirm the name on the card before you pay.</p>
                  )
                ) : lookup.error ? (
                  <p className="mt-2 text-xs text-yellow-300/90">{lookup.error}</p>
                ) : null}
              </Field>

              {kind === 'phone' ? (
                <Field label="Network" hint={service ? 'Detected from the number — change it if you ported' : undefined}>
                  <ServicePicker services={networks} value={service} onChange={setService} />
                </Field>
              ) : null}

              {cat === 'airtime' ? (
                <Field label="Amount" hint={`₦${limits.min.toLocaleString('en-NG')} – ₦${limits.max.toLocaleString('en-NG')}`}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-white/40">₦</span>
                    <input
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="0"
                      className={`${inputCls} pl-9 text-lg font-semibold`}
                    />
                  </div>
                  <div className="mt-2.5 grid grid-cols-4 gap-2">
                    {AIRTIME_QUICK.map((q) => (
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
              ) : (
                <Field label={kind === 'cable' ? 'Package' : 'Data plan'}>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    disabled={!service || loadingPlans}
                    className={`${inputCls} disabled:opacity-50`}
                  >
                    <option value="" className="bg-zener-surface">
                      {!service ? (kind === 'cable' ? 'Choose a provider first' : 'Enter the phone number first') : loadingPlans ? 'Loading plans…' : 'Choose a plan'}
                    </option>
                    {Object.entries(groups).map(([g, ps]) => (
                      <optgroup key={g} label={g.charAt(0).toUpperCase() + g.slice(1)} className="bg-zener-surface">
                        {ps.map((p) => (
                          <option key={p.id} value={p.id} className="bg-zener-surface">
                            {p.name} — {naira(p.price_kobo)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Pay with">
                <MethodOption active onClick={() => undefined} title="Wallet" sub={walletKobo === null ? 'Balance —' : `Balance ${naira(walletKobo)}`} />
                {short ? (
                  <p className="mt-2 text-sm text-yellow-300/90">
                    Your wallet balance is too low.{' '}
                    <button type="button" onClick={() => nav('/wallet')} className="font-semibold text-zener-gold hover:underline">
                      Fund wallet
                    </button>
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
                {paying ? 'Paying…' : value > 0 ? `Pay ${formatCurrency(value)}` : 'Pay'}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/35">
                <Lock size={12} /> Paid from your wallet. If it doesn't go through, the money comes straight back.
              </p>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className={`${card} p-6`}>
            <p className="mb-4 text-xs font-semibold text-white/40">Your order</p>
            <dl className="space-y-3 text-sm">
              <SummaryRow label={kind === 'cable' ? 'Provider' : 'Network'} value={serviceName} />
              <SummaryRow label={kind === 'cable' ? 'Smartcard' : 'Phone'} value={recipient || undefined} />
              {kind === 'cable' ? <SummaryRow label="Name" value={lookup.name} /> : <SummaryRow label="Type" value={category === 'airtime' ? 'Airtime' : 'Data'} />}
              {cat !== 'airtime' ? <SummaryRow label={kind === 'cable' ? 'Package' : 'Plan'} value={product?.name} /> : null}
              <div className="border-t border-white/[0.08] pt-3">
                <SummaryRow label="Total" value={value > 0 ? formatCurrency(value) : undefined} strong />
              </div>
            </dl>
          </div>
          {recent.length ? (
            <div className={`${card} p-6`}>
              <p className="mb-2 text-xs font-semibold text-white/40">Recent</p>
              <ul className="divide-y divide-white/[0.06]">
                {recent.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        if (kind === 'phone') setCategory(b.category === 'data' ? 'data' : 'airtime');
                        setService(b.service);
                        setRecipient(b.recipient);
                        if (b.category === 'airtime') setAmount(String(koboToNaira(b.amount_kobo)));
                      }}
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        {BILL_LOGOS[b.service] ? <img src={BILL_LOGOS[b.service]} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" /> : null}
                        <span className="min-w-0">
                          <span className="block truncate text-white/80">{b.recipient}</span>
                          <span className="block truncate text-xs text-white/35">{billTitle(b)}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold">{naira(b.amount_kobo)}</span>
                        <span className={`block text-xs ${BILL_STATUS[b.status][1]}`}>{BILL_STATUS[b.status][0]}</span>
                      </span>
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

// A completed purchase of real electricity (test-mode orders are left out).
const bought = (o: GuestOrder) => (o.status === 'vended' || o.status === 'delivered') && !o.sandbox;

// UnitsCard totals the electricity bought this month (Lagos calendar month).
function UnitsCard({ orders }: { orders: GuestOrder[] }) {
  const { nav } = useAcct();
  const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }).slice(0, 7);
  const done = orders.filter(bought);
  const thisMonth = done.filter((o) => new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }).startsWith(month));
  const kwh = thisMonth.reduce((t, o) => t + (o.energy_kwh || 0), 0);
  const spent = thisMonth.reduce((t, o) => t + o.amount_kobo, 0);
  const last = done[0];
  // Days of the month so far, today included: "in 22 days" on the 22nd.
  const days = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }).slice(8, 10));
  if (!done.length) return null;
  return (
    <div className={`${card} p-6`}>
      <p className="text-xs font-semibold text-white/40">Units bought this month</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-zener-gold">{formatKwh(kwh)}</p>
      <p className="mt-1 text-xs text-white/45">
        {thisMonth.length} {thisMonth.length === 1 ? 'purchase' : 'purchases'} in {days} {days === 1 ? 'day' : 'days'} · {naira(spent)}
      </p>
      {last ? (
        <dl className="mt-4 space-y-2 border-t border-white/[0.08] pt-3 text-sm">
          <SummaryRow label="Last purchase" value={last.energy_kwh ? formatKwh(last.energy_kwh) : '—'} />
          <SummaryRow label="Meter" value={last.meter_number} />
          <SummaryRow label="Date" value={shortDate(last.created_at)} />
        </dl>
      ) : null}
      {spent ? (
        <button
          type="button"
          onClick={() => nav(`/units?send=${spent}&disco=${last?.provider_code ?? ''}`)}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] text-sm font-bold hover:border-zener-gold/50 hover:text-zener-gold"
        >
          <Share2 size={15} /> Send electricity like this
        </button>
      ) : null}
    </div>
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

const rowBtn = 'grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] text-xs font-bold text-white/75 hover:border-white/25 hover:text-white disabled:opacity-50';

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

const PAGE_SIZE = 20;
const ORDER_FILTERS: [OrderGroup | '', string][] = [
  ['', 'All'],
  ['successful', 'Successful'],
  ['processing', 'Processing'],
  ['delayed', 'Delayed'],
  ['refunded', 'Refunded'],
  ['not_paid', 'Not paid'],
];

function TransactionsPage() {
  const { nav } = useAcct();
  // Filter and page live in the URL, so back from an order returns here.
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('status') as OrderGroup | null;
  const [status, setStatus] = useState<OrderGroup | ''>(initial && ORDER_FILTERS.some(([k]) => k === initial) ? initial : '');
  const [page, setPage] = useState(() => Math.max(1, Number(params.get('page')) || 1));
  const [data, setData] = useState<{ orders: GuestOrder[]; total: number; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setError('');
    account
      .ordersPage({ status: status || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then((r) => live && setData(r))
      .catch((e) => live && setError(message(e)));
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (page > 1) q.set('page', String(page));
    const qs = q.toString();
    window.history.replaceState(window.history.state, '', `/transactions${qs ? `?${qs}` : ''}`);
    return () => {
      live = false;
    };
  }, [status, page]);
  const orders = data?.orders ?? null;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const pick = (s: OrderGroup | '') => {
    setStatus(s);
    setPage(1);
    setData(null);
  };
  const go = (n: number) => {
    setPage(n);
    setData(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [statement, setStatement] = useState(false);
  const [sharing, setSharing] = useState<GuestOrder | null>(null);
  const closeStatement = useCallback(() => setStatement(false), []);
  const closeShare = useCallback(() => setSharing(null), []);
  return (
    <>
      <PageTitle
        title="Transactions"
        sub="Every electricity purchase on your account."
        action={
          <button type="button" onClick={() => setStatement(true)} className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.1] px-4 text-sm font-bold hover:border-white/25">
            <Receipt size={16} /> Statement
          </button>
        }
      />
      {statement ? <StatementDialog onClose={closeStatement} /> : null}
      {sharing ? <ShareTokenDialog order={sharing} onClose={closeShare} /> : null}
      {data && data.counts.all > 0 ? (
        <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-2">
            {ORDER_FILTERS.filter(([k]) => !k || k === status || (data.counts[k] ?? 0) > 0).map(([k, label]) => (
              <button
                key={k || 'all'}
                type="button"
                onClick={() => pick(k)}
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition ${
                  status === k ? 'border-zener-gold/60 bg-zener-gold/10 text-zener-gold' : 'border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white'
                }`}
              >
                {label}
                <span className={status === k ? 'text-zener-gold/70' : 'text-white/30'}>{data.counts[k || 'all'] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {error ? <ErrorBox text={error} /> : orders === null ? <Spinner /> : orders.length === 0 ? (
        status ? (
          <Empty text="No purchases with this status." action="Show all" onAction={() => pick('')} />
        ) : (
          <Empty text="No purchases yet." action="Buy electricity" onAction={() => nav('/')} />
        )
      ) : (
        <>
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
                <th className="px-5 py-3.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {orders.map((o) => (
                <tr key={o.id} onClick={() => nav(`/order/${o.id}`)} className="cursor-pointer hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-5 py-4 text-white/55">{shortDate(o.created_at)}</td>
                  <td className="px-5 py-4 font-medium text-white/85">
                    {o.meter_number}
                    {o.paid_for_you ? <span className="block text-xs font-semibold text-zener-gold">Paid for you</span> : null}
                  </td>
                  <td className="px-5 py-4 text-white/60">{o.provider_name}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-bold">{naira(o.amount_kobo)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right text-white/60">{o.energy_kwh ? `${o.energy_kwh.toFixed(1)} kWh` : '—'}</td>
                  <td className="px-5 py-4"><StatusPill status={o.status} /></td>
                  <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                    {o.status === 'vended' || o.status === 'delivered' ? (
                      <span className="flex justify-end gap-1.5">
                        <ReceiptButton order={o} className={rowBtn} compact />
                        {o.token ? (
                          <button type="button" onClick={() => setSharing(o)} className={rowBtn} title="Share token as a one-time QR" aria-label="Share token as a one-time QR">
                            <QrCode size={15} />
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </td>
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
                    <span className="block truncate text-xs text-white/40">
                      {o.paid_for_you ? <span className="font-semibold text-zener-gold">Paid for you · </span> : null}
                      {o.provider_name} · {shortDate(o.created_at)}
                    </span>
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
        {data && data.total > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-white/40">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => go(page - 1)}
                className="flex h-9 items-center gap-1 rounded-lg border border-white/[0.1] px-3 text-xs font-bold text-white/75 hover:border-white/25 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft size={15} /> Previous
              </button>
              <span className="px-1 text-xs text-white/45">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => go(page + 1)}
                className="flex h-9 items-center gap-1 rounded-lg border border-white/[0.1] px-3 text-xs font-bold text-white/75 hover:border-white/25 hover:text-white disabled:opacity-30"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        ) : null}
        </>
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
  const remove = async (m: ApiMeter) => {
    const ok = await askConfirm({
      title: 'Remove this meter?',
      message: `Meter ${m.meter_number} will be removed from your account. Your past purchases stay in your history.`,
      confirmLabel: 'Remove meter',
      danger: true,
    });
    if (!ok) return;
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

  // The meter number is inside the QR; the sticker only names the meter.
  g.font = `700 40px ${font}`;
  g.fillText((m.label || m.customer_name || '').slice(0, 32), W / 2, 1012);
  g.fillStyle = '#555555';
  g.font = `500 32px ${font}`;
  g.fillText(m.provider_name || m.provider_code, W / 2, 1066);
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
  const { user, walletKobo, refreshWallet, nav } = useAcct();
  const [activity, setActivity] = useState<WalletActivity | null>(null);
  const [meters, setMeters] = useState<ApiMeter[]>([]);
  const [error, setError] = useState('');
  const fundRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.walletActivity(30).then(setActivity).catch((e) => setError(message(e)));
  }, []);
  useEffect(() => {
    load();
    api
      .meters()
      .then((r) => setMeters(r.meters.filter((m) => m.provider_code !== 'ZIEON')))
      .catch(() => undefined);
  }, [load]);
  // Coming back from checkout: the webhook may land a moment later.
  useEffect(() => {
    if (!funded) return;
    const ts = [2000, 6000, 15000].map((d) =>
      window.setTimeout(() => {
        refreshWallet();
        load();
      }, d),
    );
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [funded, refreshWallet, load]);

  const [missing, setMissing] = useState(false);
  const refreshAll = useCallback(() => {
    refreshWallet();
    load();
  }, [refreshWallet, load]);

  const months = activity?.months ?? [];
  const now = months[months.length - 1];
  const prev = months[months.length - 2];
  const fundBoxRef = useRef<HTMLDivElement>(null);
  // Scroll to the funding card: the amount box when there is one, else the account number.
  const fund = () => {
    const target = fundRef.current ?? fundBoxRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    fundRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <PageTitle title="Wallet" sub="Keep a balance and buy electricity in one tap." />
      {error ? <ErrorBox text={error} /> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className={`${card} p-6`}>
            <p className="text-sm font-semibold text-white/50">Wallet balance</p>
            <p className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{walletKobo === null ? '—' : naira(walletKobo)}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <MonthTile label="Added this month" kobo={now?.in_kobo} prevKobo={prev?.in_kobo} dir="in" />
              <MonthTile label="Spent this month" kobo={now?.out_kobo} prevKobo={prev?.out_kobo} dir="out" />
            </div>
          </section>

          <section className={`${card} p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold">Last 6 months</h2>
              <span className="flex items-center gap-4 text-xs text-white/50">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zener-gold" /> Added</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/30" /> Spent</span>
              </span>
            </div>
            {activity === null ? <Spinner /> : <MonthChart months={months} />}
          </section>

          <section className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 px-6 pt-6">
              <h2 className="text-base font-bold">Wallet activity</h2>
              <button type="button" onClick={() => nav('/transactions')} className="text-xs font-semibold text-white/45 hover:text-white">
                All purchases
              </button>
            </div>
            {activity === null ? (
              <Spinner />
            ) : activity.entries.length === 0 ? (
              <p className="px-6 pb-8 pt-4 text-sm text-white/45">No wallet activity yet. Fund your wallet to pay for electricity in one tap.</p>
            ) : (
              <WalletEntries entries={activity.entries} nav={nav} />
            )}
          </section>
        </div>

        <div className="order-first min-w-0 space-y-6 xl:order-none">
          <section className={`${card} p-5`}>
            <WalletCard name={user.name || user.email} kobo={walletKobo} />
            <div className="mt-5 grid grid-cols-4 gap-2">
              <QuickAction label="Fund" onClick={fund} icon={<Plus size={19} />} />
              <QuickAction label="Buy" onClick={() => nav('/?pay=wallet')} icon={<ZMark size={18} />} />
              <QuickAction label="Meters" onClick={() => nav('/meters')} icon={<Gauge size={19} />} />
              <QuickAction label="History" onClick={() => nav('/transactions')} icon={<Receipt size={19} />} />
            </div>
          </section>

          <div ref={fundBoxRef}>
            <FundWallet inputRef={fundRef} funded={funded} onFunded={() => { refreshWallet(); load(); }} />
          </div>
          <button
            type="button"
            onClick={() => setMissing(true)}
            className="-mt-3 w-full text-center text-xs font-semibold text-white/45 hover:text-white"
          >
            Sent money but it's not in your wallet?
          </button>

          <WithdrawCard walletKobo={walletKobo} onDone={refreshAll} />

          <section className={`${card} flex items-center gap-4 p-5`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zener-gold/15 text-zener-gold">
              <BatteryCharging size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Saved units</span>
              <span className="block text-xs text-white/45">Keep electricity in the app; load it or send it to anyone.</span>
            </span>
            <button type="button" onClick={() => nav('/units')} className="h-8 shrink-0 rounded-lg border border-white/[0.1] px-3 text-xs font-bold hover:border-zener-gold/50 hover:text-zener-gold">
              Open
            </button>
          </section>

          {meters.length ? (
            <section className={`${card} p-5`}>
              <h2 className="text-base font-bold">Pay from wallet</h2>
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {meters.slice(0, 4).map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <DiscoLogo disco={{ provider_code: m.provider_code, logo_url: '' } as Disco} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{m.label || m.customer_name || m.meter_number}</span>
                      <span className="block truncate font-mono text-xs text-white/40">{m.meter_number}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => nav(`/?meter_id=${m.id}&pay=wallet`)}
                      className="h-8 rounded-lg border border-white/[0.1] px-3 text-xs font-bold hover:border-zener-gold/50 hover:text-zener-gold"
                    >
                      Buy
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
      {missing ? <MissingPaymentDialog onClose={() => setMissing(false)} onFound={refreshAll} /> : null}
    </>
  );
}

function MonthTile({ label, kobo, prevKobo, dir }: { label: string; kobo?: number; prevKobo?: number; dir: 'in' | 'out' }) {
  const change = kobo !== undefined && prevKobo ? Math.round(((kobo - prevKobo) / prevKobo) * 100) : null;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-black/40 p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${dir === 'in' ? 'bg-zener-gold/[0.12] text-zener-gold' : 'bg-white/[0.06] text-white/70'}`}>
        {dir === 'in' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-white/45">{label}</span>
        <span className="mt-0.5 block text-xl font-black tracking-tight">{kobo === undefined ? '—' : naira(kobo)}</span>
        {change !== null ? (
          <span className="block text-[11px] text-white/35">
            {change >= 0 ? '+' : ''}
            {change}% vs last month
          </span>
        ) : null}
      </span>
    </div>
  );
}

const compactNaira = (kobo: number) => {
  const n = kobo / 100;
  if (n >= 1_000_000) return `₦${+(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1000) return `₦${+(n / 1000).toFixed(1)}k`;
  return `₦${Math.round(n)}`;
};

function MonthChart({ months }: { months: WalletActivity['months'] }) {
  const max = Math.max(...months.flatMap((m) => [m.in_kobo, m.out_kobo]), 0);
  // Round the scale up to a tidy number so the gridlines read well.
  const step = max > 0 ? 10 ** Math.floor(Math.log10(max)) : 100000;
  const top = max > 0 ? Math.ceil(max / step) * step : 1000000;
  const pct = (k: number) => `${Math.max((k / top) * 100, k > 0 ? 2 : 0)}%`;
  const label = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleString('en-NG', { month: 'short' });
  return (
    <div className="mt-6 flex gap-3">
      <div className="flex h-44 flex-col justify-between pb-0 text-right text-[10px] text-white/30">
        <span>{compactNaira(top)}</span>
        <span>{compactNaira(top / 2)}</span>
        <span>₦0</span>
      </div>
      <div className="flex-1">
        <div className="relative h-44">
          {[0, 50, 100].map((y) => (
            <span key={y} className="absolute inset-x-0 border-t border-dashed border-white/[0.07]" style={{ top: `${y}%` }} />
          ))}
          <div className="relative flex h-full items-end justify-around gap-2">
            {months.map((m) => (
              <div key={m.month} className="flex h-full flex-1 items-end justify-center gap-1" title={`${label(m.month)}: added ${naira(m.in_kobo)}, spent ${naira(m.out_kobo)}`}>
                <span className="w-full max-w-[22px] rounded-t-md bg-zener-gold transition-[height] duration-700" style={{ height: pct(m.in_kobo) }} />
                <span className="w-full max-w-[22px] rounded-t-md bg-white/25 transition-[height] duration-700" style={{ height: pct(m.out_kobo) }} />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-around gap-2">
          {months.map((m, i) => (
            <span key={m.month} className={`flex-1 text-center text-[11px] ${i === months.length - 1 ? 'font-bold text-white' : 'text-white/40'}`}>
              {label(m.month)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const ENTRY_LABEL: Record<string, string> = {
  wallet_fund: 'Wallet top-up',
  purchase: 'Electricity purchase',
  refund: 'Refund',
  bill: 'Airtime, data or TV',
  bill_refund: 'Refund',
};

function WalletEntries({ entries, nav }: { entries: WalletEntry[]; nav: Nav }) {
  const title = (e: WalletEntry) => ENTRY_LABEL[e.kind] ?? (e.memo || e.kind);
  const detail = (e: WalletEntry) => (e.kind === 'purchase' ? e.memo.replace(/^Electricity purchase\s*/, 'Meter ') : e.kind === 'refund' ? e.memo.replace(/^Refund:\s*/, '') : '');
  const open = (e: WalletEntry) => (e.order_id ? () => nav(`/order/${e.order_id}`) : undefined);
  const amount = (e: WalletEntry) => (
    <span className={`font-semibold tabular-nums ${e.amount_kobo > 0 ? 'text-zener-success' : ''}`}>
      {e.amount_kobo > 0 ? '+' : '−'}
      {naira(Math.abs(e.amount_kobo))}
    </span>
  );
  const icon = (e: WalletEntry) => (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${e.amount_kobo > 0 ? 'bg-zener-success/10 text-zener-success' : 'bg-white/[0.06] text-white/60'}`}>
      {e.kind === 'purchase' ? <ZMark size={15} /> : e.kind === 'refund' ? <RotateCcw size={15} /> : <ArrowDownLeft size={16} />}
    </span>
  );
  return (
    <ul className="mt-3 divide-y divide-white/[0.05]">
      {entries.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={open(e)}
            disabled={!e.order_id}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left enabled:hover:bg-white/[0.02] sm:px-6"
          >
            {icon(e)}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{title(e)}</span>
              <span className="block truncate text-xs text-white/40">
                {detail(e) ? `${detail(e)} · ` : ''}
                {shortDate(e.created_at)}
              </span>
            </span>
            <span className="shrink-0 text-right text-sm">
              {amount(e)}
              <span className="block text-[11px] tabular-nums text-white/35">Bal {naira(e.balance_after_kobo)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function WalletCard({ name, kobo }: { name: string; kobo: number | null }) {
  const brand = useBrand();
  return (
    <div className="relative aspect-[1.6] overflow-hidden rounded-2xl border border-zener-gold/25 bg-[linear-gradient(135deg,rgb(var(--zener-gold)/0.22),rgb(var(--zener-gold)/0.04)_60%)] px-5 pb-8 pt-5">
      <span className="pointer-events-none absolute -bottom-8 -right-6 text-zener-gold/[0.10]">
        <ZMark size={170} />
      </span>
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-black tracking-[0.3em]">{brand.display_name.toUpperCase()}</span>
          <span className="text-[11px] font-semibold text-white/50">Wallet</span>
        </div>
        <p className="text-[28px] font-black tracking-tight">{kobo === null ? '—' : naira(kobo)}</p>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Account</p>
          <p className="truncate text-sm font-semibold">{name}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-2">
      <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/80 transition group-hover:border-zener-gold/40 group-hover:text-zener-gold">
        {icon}
      </span>
      <span className="text-xs font-semibold text-white/60 group-hover:text-white">{label}</span>
    </button>
  );
}

function FundWallet({ inputRef, funded, onFunded }: { inputRef: React.RefObject<HTMLInputElement>; funded: boolean; onFunded: () => void }) {
  // Funding by transfer to the customer's own account number, when the bank side is on.
  const [own, setOwn] = useState<BankTransfer | null | undefined>(undefined);
  useEffect(() => {
    let stop = false;
    api
      .walletAccount()
      .then((a) => !stop && setOwn(a))
      .catch(() => !stop && setOwn(null));
    return () => {
      stop = true;
    };
  }, []);
  // A transfer is credited by the bank's notification: refresh the balance meanwhile.
  const fundedRef = useRef(onFunded);
  fundedRef.current = onFunded;
  useEffect(() => {
    if (!own) return;
    const t = window.setInterval(() => fundedRef.current(), 15000);
    return () => window.clearInterval(t);
  }, [own]);
  if (own === undefined) return <section className={`${card} p-5`}><Spinner /></section>;
  if (own) {
    return (
      <section className={`${card} space-y-4 p-5`}>
        <div>
          <h2 className="text-base font-bold">Fund wallet</h2>
          <p className="mt-1 text-sm text-white/45">Transfer any amount to your own Zenerlink account:</p>
        </div>
        <TransferDetails transfer={own} waiting={false} />
        <p className="text-xs text-white/35">Money arrives in your wallet within seconds. A small bank fee may apply.</p>
      </section>
    );
  }
  return <FundByCheckout inputRef={inputRef} funded={funded} onFunded={onFunded} />;
}

function FundByCheckout({ inputRef, funded, onFunded }: { inputRef: React.RefObject<HTMLInputElement>; funded: boolean; onFunded: () => void }) {
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

  const fund = async () => {
    setError('');
    setNote('');
    if (!ok) return setError('Enter an amount between ₦100 and ₦1,000,000.');
    setBusy(true);
    try {
      // Come back to this wallet page (keeps ?mode=vend on staging).
      const r = await api.fundWallet(nairaToKobo(value), 'card', window.location.origin + href('/wallet?funded=1'));
      if (r.payment?.checkout_url && r.payment.status !== 'succeeded') {
        window.location.assign(r.payment.checkout_url);
        return;
      }
      onFunded();
      setAmount('');
      setNote(`${formatCurrency(value)} added to your wallet.`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} space-y-4 p-5`}>
      <h2 className="text-base font-bold">Fund wallet</h2>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-white/40">₦</span>
        <input
          ref={inputRef}
          inputMode="decimal"
          aria-label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="0"
          className={`${inputCls} pl-9 text-lg font-semibold`}
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
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
    </section>
  );
}

// ---------------------------------------------------------------------------
// Profile, password, help
// ---------------------------------------------------------------------------

function ProfilePage() {
  const { user, setUser, path } = useAcct();
  // Old "Change password" links land on the profile, at the password form.
  useEffect(() => {
    if (path.startsWith('/password')) window.setTimeout(() => document.getElementById('password')?.scrollIntoView({ behavior: 'smooth' }), 60);
    if (window.location.hash === '#identity') window.setTimeout(() => document.getElementById('identity')?.scrollIntoView({ behavior: 'smooth' }), 400);
  }, [path]);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setPhotoBusy(true);
    let image: string;
    try {
      image = await squarePhoto(file);
    } catch {
      setPhotoBusy(false);
      return setError('That picture could not be opened. Try a JPEG or PNG photo.');
    }
    try {
      const r = await account.setAvatar(image);
      setUser({ ...user, avatar: r.avatar });
    } catch (err) {
      setError(message(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setError('');
    setPhotoBusy(true);
    try {
      await account.removeAvatar();
      setUser({ ...user, avatar: undefined });
    } catch (err) {
      setError(message(err));
    } finally {
      setPhotoBusy(false);
    }
  };

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
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={(e) => void save(e)} className={`${card} space-y-5 p-6`}>
        <div className="flex items-center gap-4 pb-2">
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            disabled={photoBusy}
            className="group relative shrink-0 rounded-full"
            aria-label={user.avatar ? 'Change profile picture' : 'Add a profile picture'}
          >
            <Avatar user={user} className="h-16 w-16 text-lg" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 opacity-0 transition group-hover:opacity-100">
              <Camera size={18} className="text-white" />
            </span>
            {photoBusy ? (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55">
                <Loader2 size={18} className="animate-spin text-white" />
              </span>
            ) : null}
          </button>
          <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => void pickPhoto(e)} />
          <div className="min-w-0">
            <p className="truncate font-bold">{user.name || 'Your account'}</p>
            <p className="truncate text-sm text-white/45">{user.email}</p>
            <div className="mt-1 flex gap-3 text-xs font-semibold">
              <button type="button" onClick={() => photoRef.current?.click()} disabled={photoBusy} className="text-zener-gold hover:brightness-110 disabled:opacity-40">
                {user.avatar ? 'Change photo' : 'Add photo'}
              </button>
              {user.avatar ? (
                <button type="button" onClick={() => void removePhoto()} disabled={photoBusy} className="text-white/45 hover:text-white disabled:opacity-40">
                  Remove
                </button>
              ) : null}
            </div>
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
      <IdentityCard />
      <LinkedMeters />
      <PasswordForm />
      </div>
    </>
  );
}

// The meters on this account, on the profile page.
function LinkedMeters() {
  const { nav } = useAcct();
  const [meters, setMeters] = useState<ApiMeter[] | null>(null);
  useEffect(() => {
    api
      .meters()
      .then((r) => setMeters(r.meters.filter((m) => m.provider_code !== 'ZIEON')))
      .catch(() => setMeters([]));
  }, []);
  return (
    <section className={`${card} self-start p-6`}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Linked meters{meters?.length ? <span className="ml-2 text-sm font-semibold text-white/40">{meters.length}</span> : null}</h2>
        <button type="button" onClick={() => nav('/meters')} className="text-xs font-semibold text-white/45 hover:text-white">Manage</button>
      </div>
      {meters === null ? (
        <Spinner />
      ) : meters.length === 0 ? (
        <p className="mt-4 text-sm text-white/45">No meters yet. Buy for a meter and it is linked to your account.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {meters.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <DiscoLogo disco={{ provider_code: m.provider_code, logo_url: '' } as Disco} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-sm font-semibold">{m.meter_number}</span>
                <span className="block truncate text-xs text-white/40">{m.label || m.customer_name} · {m.provider_name || m.provider_code} · {m.meter_type}</span>
              </span>
              <button type="button" onClick={() => nav(`/?meter_id=${m.id}`)} className="h-8 rounded-lg border border-white/[0.1] px-3 text-xs font-bold hover:border-zener-gold/50 hover:text-zener-gold">
                Buy
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PasswordForm() {
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
    <form id="password" onSubmit={(e) => void submit(e)} className={`${card} scroll-mt-24 space-y-5 p-6`}>
        <div className="flex items-center gap-2.5">
          <KeyRound size={18} className="text-zener-gold" />
          <h2 className="text-base font-bold">Change password</h2>
        </div>
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

// needs_review isn't final for the customer: we keep asking the DisCo for 24 hours.
const FINAL = ['vended', 'delivered', 'refunded', 'payment_failed'];

function OrderPage({ id }: { id: string }) {
  const { nav, refreshWallet } = useAcct();
  const [order, setOrder] = useState<GuestOrder | null>(null);
  // Buy again: same DisCo, meter and amount (without the fee), ready to pay.
  const buyAgain = () => {
    if (!order) return nav('/');
    const naira = Math.round((order.amount_kobo - (order.fee_kobo ?? 0)) / 100);
    const q = new URLSearchParams({ disco: order.provider_code, meter: order.meter_number, type: order.meter_type });
    if (naira > 0) q.set('amount', String(naira));
    nav(`/buy?${q.toString()}`);
  };
  return (
    <div className="max-w-xl">
      <OrderView load={() => account.get(id)} onFinal={refreshWallet} onLoad={setOrder} canShare />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={buyAgain} className="flex h-12 items-center justify-center rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110">
          Buy again
        </button>
        <button type="button" onClick={() => nav('/transactions')} className="flex h-12 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-bold hover:bg-white/[0.1]">
          All transactions
        </button>
      </div>
    </div>
  );
}

function OrderView({
  load,
  onFinal,
  onLoad,
  canShare = false,
}: {
  load: () => Promise<GuestOrder>;
  onFinal?: () => void;
  onLoad?: (o: GuestOrder) => void;
  canShare?: boolean;
}) {
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [resent, setResent] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [missing, setMissing] = useState(false);
  // "I've sent the money" asks the bank right away; the token still only
  // comes once the bank confirms the transfer arrived.
  const [checking, setChecking] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [notYet, setNotYet] = useState(false);
  const checkNow = async () => {
    setChecking(true);
    setNotYet(false);
    setSentAt((t) => t ?? Date.now());
    try {
      const o = await loadRef.current();
      setOrder(o);
      loadedRef.current?.(o);
      if (FINAL.includes(o.status)) finalRef.current?.();
      else setNotYet(true);
    } catch (e) {
      setCancelError(message(e));
    } finally {
      setChecking(false);
    }
  };
  const cancelOrder = async () => {
    if (!order) return;
    const ok = await askConfirm({
      title: 'Cancel this order?',
      message: "Only cancel if you haven't sent the money yet. If you already sent it, don't worry: it will be added to your wallet.",
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep order',
      danger: true,
    });
    if (!ok) return;
    setCancelling(true);
    setCancelError('');
    try {
      setOrder(await account.cancel(order.id));
    } catch (e) {
      setCancelError(message(e));
    } finally {
      setCancelling(false);
    }
  };
  const loadRef = useRef(load);
  const finalRef = useRef(onFinal);
  const loadedRef = useRef(onLoad);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const poll = async (attempt: number) => {
      try {
        const o = await loadRef.current();
        if (stop) return;
        setOrder(o);
        loadedRef.current?.(o);
        if (FINAL.includes(o.status)) finalRef.current?.();
        // Every 3 seconds at first; a slow DisCo can take hours, so then every 30.
        else timer = window.setTimeout(() => void poll(attempt + 1), attempt < (o.bank_transfer ? 400 : 100) ? 3000 : 30000);
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
  const transfer = pending ? order.bank_transfer : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-[28px]">
          {done ? 'Your token is ready' : transfer ? `Transfer ${naira(transfer.amount_kobo ?? order.amount_kobo)}` : pending ? 'Almost there' : 'Purchase update'}
        </h1>
        <p className="mt-1 text-sm text-white/45">
          {done
            ? 'Enter the 20-digit token on your meter keypad to load the units.'
            : transfer
              ? 'to complete your order'
              : pending
                ? 'This page updates automatically.'
                : order.message}
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
      ) : transfer ? (
        <>
          <TransferDetails transfer={transfer} note={order.message} />
          {canShare ? (
            <div className="space-y-2">
              <button
                type="button"
                disabled={checking}
                onClick={() => void checkNow()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checking ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{' '}
                {checking ? 'Checking for your transfer…' : sentAt ? 'Check again' : "I've sent the money"}
              </button>
              {notYet && !checking ? (
                <p className="text-center text-sm text-white/60">
                  We haven't received it yet. Transfers can take a few minutes, and this page updates by itself the moment it lands.
                </p>
              ) : null}
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void cancelOrder()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] text-sm font-semibold text-white/70 transition hover:border-zener-danger/50 hover:text-zener-danger disabled:opacity-50"
              >
                {cancelling ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Cancel order
              </button>
              {cancelError ? <p className="text-center text-sm text-zener-danger">{cancelError}</p> : null}
              <button
                type="button"
                onClick={() => setMissing(true)}
                className={`w-full py-1 text-center text-xs font-semibold hover:text-white ${sentAt && Date.now() - sentAt > 5 * 60_000 ? 'text-zener-gold' : 'text-white/45'}`}
              >
                I've paid but nothing happened
              </button>
            </div>
          ) : null}
        </>
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
          {order.fee_kobo > 0 ? (
            <>
              <SummaryRow label="Electricity" value={naira(order.amount_kobo - order.fee_kobo)} />
              <SummaryRow label="Fee" value={naira(order.fee_kobo)} />
            </>
          ) : null}
          <SummaryRow label="Amount paid" value={naira(order.amount_kobo)} strong />
        </div>
      </dl>
      {done ? (
        <div className="grid grid-cols-2 gap-2">
          <ReceiptButton order={order} className={actionBtn} />
          {canShare && order.token ? (
            <button type="button" onClick={() => setSharing(true)} className={actionBtn}>
              <QrCode size={15} /> Share as QR
            </button>
          ) : null}
          {canShare && order.token ? (
            <button
              type="button"
              disabled={!!resent}
              onClick={() =>
                account
                  .resend(order.id)
                  .then((r) => setResent(`Sent to ${r.sent_to}`))
                  .catch((e) => setResent(message(e)))
              }
              className={`${actionBtn} col-span-2 disabled:opacity-60`}
            >
              <Mail size={15} /> {resent || 'Email me this token again'}
            </button>
          ) : null}
        </div>
      ) : null}
      {done && canShare ? <PurchaseFeedback orderId={order.id} /> : null}
      {canShare && order.status === 'payment_failed' ? (
        <button type="button" onClick={() => setMissing(true)} className={`${actionBtn} w-full`}>
          I paid but nothing came
        </button>
      ) : null}
      {missing ? (
        <MissingPaymentDialog
          orderId={order.id}
          amountKobo={order.bank_transfer?.amount_kobo ?? order.amount_kobo}
          onClose={() => setMissing(false)}
          onFound={() => void loadRef.current().then(setOrder).catch(() => undefined)}
        />
      ) : null}
      {sharing ? <ShareTokenDialog order={order} onClose={() => setSharing(false)} /> : null}
      {order.sandbox ? <p className="text-center text-xs text-yellow-300/80">Test mode: this token is not valid on a real meter.</p> : null}
    </div>
  );
}

// TransferDetails is an account to pay into: the one-time account for an
// order (with its countdown) or the customer's own wallet account.
function TransferDetails({ transfer, note, waiting = true }: { transfer: BankTransfer; note?: string; waiting?: boolean }) {
  const brand = useBrand();
  const left = useCountdown(transfer.expires_at);
  const isPayRep = /payrep/i.test(transfer.bank_name);
  return (
    <div className={`${card} space-y-3 p-6 text-sm`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black ring-1 ring-white/10">
            <img src={brand.logo_url || logo} alt="" className="h-5 w-5 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] text-white/40">Pay to</span>
            <span className="block truncate font-bold">{brand.display_name}</span>
          </span>
        </span>
        {isPayRep ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/45">
            via <img src={payrepMark} alt="" className="h-5 w-5 rounded" /> <span className="font-semibold text-white/70">PayRep MFB</span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-white/45">Bank</span>
        <span className="flex min-w-0 items-center gap-2 font-medium text-white/85">
          {isPayRep ? <img src={payrepMark} alt="" className="h-5 w-5 shrink-0 rounded" /> : null}
          <span className="truncate">{transfer.bank_name}</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-white/45">Account no.</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-base font-bold tracking-wide">{groupAccount(transfer.account_number)}</span>
          <CopyButton text={transfer.account_number} />
        </span>
      </div>
      <SummaryRow label="Name" value={transfer.account_name} />
      {left !== null || note ? (
        <div className="space-y-1 border-t border-white/[0.08] pt-3 text-white/60">
          {left !== null ? <p className="font-semibold text-white">{left > 0 ? `Expires in ${mmss(left)}` : 'This account has expired'}</p> : null}
          {note ? <p>{note}</p> : null}
        </div>
      ) : null}
      {waiting && (left === null || left > 0) ? (
        <p className="flex items-center gap-2 text-white/60">
          <Loader2 size={16} className="animate-spin text-zener-gold" /> Waiting for your transfer…
        </p>
      ) : null}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-semibold hover:border-white/25"
    >
      {copied ? <Check size={13} className="text-zener-success" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// Seconds until the ISO time, ticking each second; null without a time.
function useCountdown(until?: string) {
  const end = until ? Date.parse(until) : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(end)) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [end]);
  return Number.isNaN(end) ? null : Math.max(0, Math.floor((end - now) / 1000));
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const groupAccount = (n: string) => (n.length === 10 ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}` : n);


// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------



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



// Mirrors the backend quote: the service fee comes off first, VAT is included
// in the rest, and the remainder buys energy at the DisCo's rate.

