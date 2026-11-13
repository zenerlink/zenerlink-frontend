import { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronDown, ChevronRight, Eye, EyeOff, Loader2, Lock, Menu, QrCode, UserRound, Wallet, X } from 'lucide-react';
import QRCode from 'qrcode';
import { ApiError, api, guest } from '../lib/api';
import type { Disco, User } from '../lib/api';
import { useBrand } from '../lib/brand';
import { href } from './links';
import type { Nav, Prefill } from './links';

// The public site (zenerlink.com): a product landing page in the spirit of a
// hardware brand's site, full-bleed dark panels, one clear action per panel,
// and an account button that goes straight to sign-in.

const SECTIONS: [string, string][] = [
  ['#buy', 'Buy electricity'],
  ['#how', 'How it works'],
  ['#business', 'Business'],
  ['#faq', 'Support'],
];

function useDiscos() {
  const [discos, setDiscos] = useState<Disco[]>([]);
  useEffect(() => {
    guest
      .discos()
      .then((r) => setDiscos(r.discos))
      .catch(() => undefined);
  }, []);
  return discos;
}

// Scroll to the #section in the address bar once the page has rendered.
function useHashScroll() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView(), 50);
  }, []);
}

function Wordmark({ onClick }: { onClick: () => void }) {
  const brand = useBrand();
  return (
    <a
      href={href('/')}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="text-[17px] font-black tracking-[0.32em] text-white"
    >
      {brand.display_name.toUpperCase()}
    </a>
  );
}

function AccountButton({ nav, signedIn }: { nav: Nav; signedIn: boolean }) {
  return (
    <button
      type="button"
      onClick={() => nav(signedIn ? '/' : '/login')}
      aria-label={signedIn ? 'Your account' : 'Sign in'}
      title={signedIn ? 'Your account' : 'Sign in'}
      className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.1] text-white/85 transition hover:bg-white/[0.18] hover:text-white"
    >
      <UserRound size={19} strokeWidth={1.6} />
    </button>
  );
}

function TopNav({ nav, signedIn }: { nav: Nav; signedIn: boolean }) {
  const brand = useBrand();
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-colors ${solid || open ? 'bg-black/85 backdrop-blur-md' : 'bg-transparent'}`}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <div className="flex items-center gap-10">
          <Wordmark onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <nav className="hidden items-center gap-1 lg:flex">
            {SECTIONS.map(([to, label]) => (
              <a key={to} href={to} className="rounded-md px-3 py-2 text-[14px] font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white">
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {brand.support_phone ? (
            <a href={`tel:${brand.support_phone}`} className="hidden text-[13px] text-white/60 hover:text-white md:inline">
              Call <span className="font-semibold text-white/85 underline underline-offset-4">{brand.support_phone}</span>
            </a>
          ) : null}
          <AccountButton nav={nav} signedIn={signedIn} />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.1] text-white/85 lg:hidden"
          >
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-white/[0.08] px-5 pb-6 pt-2 lg:hidden">
          {SECTIONS.map(([to, label]) => (
            <a key={to} href={to} onClick={() => setOpen(false)} className="block border-b border-white/[0.06] py-4 text-[17px] font-semibold text-white/85">
              {label}
            </a>
          ))}
          <button type="button" onClick={() => nav(signedIn ? '/' : '/login')} className="mt-5 h-12 w-full rounded-lg bg-white text-sm font-bold text-black">
            {signedIn ? 'Go to my account' : 'Sign in'}
          </button>
        </nav>
      ) : null}
    </header>
  );
}

// A night-side planet horizon with a gold rim: the grid at dusk.
function Horizon() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgb(var(--zener-gold)/0.28),transparent_60%)]" />
      <div
        className="absolute left-1/2 top-[80%] aspect-square w-[230vw] -translate-x-1/2 rounded-full border-t border-zener-gold/50 bg-black sm:top-[70%] sm:w-[170vw] lg:top-[60%] lg:w-[140vw]"
        style={{
          boxShadow: '0 -30px 120px rgb(var(--zener-gold) / 0.32), inset 0 30px 80px rgb(var(--zener-gold) / 0.12)',
          backgroundImage:
            'radial-gradient(circle at 50% 2%, rgb(var(--zener-gold) / 0.55) 0 1px, transparent 1.5px), radial-gradient(circle, rgb(255 210 150 / 0.35) 0 1px, transparent 1.4px)',
          backgroundSize: '100% 100%, 26px 26px',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

function HeroBuyForm({ discos, nav }: { discos: Disco[]; nav: Nav }) {
  const [disco, setDisco] = useState('');
  const [meter, setMeter] = useState('');
  const chosen = disco || discos.find((d) => d.provider_code === 'IKEDC')?.provider_code || discos[0]?.provider_code || '';
  const ok = !!chosen && meter.length >= 6;
  return (
    <form
      id="buy"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) nav(`/buy?disco=${chosen}&meter=${meter}&type=prepaid`);
      }}
      className="mt-9 flex w-full max-w-2xl scroll-mt-28 flex-col gap-2 rounded-2xl border border-white/[0.12] bg-black/50 p-2 backdrop-blur sm:flex-row"
    >
      <label className="relative sm:w-56">
        <span className="sr-only">Electricity company</span>
        <select
          value={chosen}
          onChange={(e) => setDisco(e.target.value)}
          className="h-14 w-full appearance-none rounded-xl bg-white/[0.06] pl-4 pr-10 text-[15px] font-semibold text-white outline-none focus:bg-white/[0.1]"
        >
          {discos.length ? null : <option value="">Loading DisCos…</option>}
          {discos.map((d) => (
            <option key={d.provider_code} value={d.provider_code} className="bg-[#111]">
              {d.provider_name}
            </option>
          ))}
        </select>
        <ChevronDown size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45" />
      </label>
      <label className="flex-1">
        <span className="sr-only">Meter number</span>
        <input
          inputMode="numeric"
          value={meter}
          onChange={(e) => setMeter(e.target.value.replace(/\D/g, '').slice(0, 20))}
          placeholder="Enter your meter number"
          className="h-14 w-full rounded-xl bg-white/[0.06] px-4 text-[15px] text-white outline-none placeholder:text-white/35 focus:bg-white/[0.1]"
        />
      </label>
      <button
        type="submit"
        disabled={!ok}
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-zener-gold px-7 text-[15px] font-bold text-black transition hover:brightness-110 disabled:opacity-50"
      >
        Buy now <ArrowRight size={17} />
      </button>
    </form>
  );
}

function Panel({ id, eyebrow, title, body, children, cta, reverse = false }: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
  cta?: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-white/[0.06]">
      <div className={`mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-28 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zener-gold">{eyebrow}</p>
          <h2 className="mt-4 max-w-xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">{title}</h2>
          <p className="mt-5 max-w-lg text-[17px] leading-8 text-white/60">{body}</p>
          {cta ? <div className="mt-8 flex flex-wrap gap-3">{cta}</div> : null}
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

const primaryBtn = 'inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-sm font-bold text-black transition hover:bg-white/85';
const ghostBtn = 'inline-flex h-12 items-center gap-2 rounded-lg border border-white/25 px-6 text-sm font-bold text-white transition hover:border-white/60';

function WalletMock() {
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-6 shadow-2xl">
      <div className="rounded-2xl border border-zener-gold/25 bg-gradient-to-br from-zener-gold/[0.2] to-zener-gold/[0.03] p-6">
        <p className="flex items-center gap-2 text-xs font-semibold text-white/60"><Wallet size={14} className="text-zener-gold" /> Wallet balance</p>
        <p className="mt-2 text-4xl font-black tracking-tight">₦12,500.00</p>
      </div>
      <p className="mb-2 mt-6 text-xs font-semibold text-white/40">Saved meters</p>
      {[
        ['Home', '0101 2345 678', 'Ikeja Electric'],
        ['Shop', '4512 0098 331', 'Abuja Electricity'],
      ].map(([n, m, d]) => (
        <div key={m} className="mb-2 flex items-center justify-between rounded-xl border border-white/[0.07] px-4 py-3">
          <span>
            <span className="block text-sm font-semibold">{n}</span>
            <span className="block text-xs text-white/40">{m} · {d}</span>
          </span>
          <span className="rounded-md bg-zener-gold/15 px-3 py-1.5 text-xs font-bold text-zener-gold">Buy</span>
        </div>
      ))}
      <div className="mt-4 rounded-xl bg-zener-gold/[0.08] p-4 text-center">
        <p className="text-[11px] font-semibold text-white/45">Electricity token</p>
        <p className="mt-1 font-mono text-lg font-bold tracking-wider text-zener-gold">2636 2054 4059 8275 7802</p>
      </div>
    </div>
  );
}

function StickerMock() {
  const brand = useBrand();
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toDataURL(window.location.origin, { margin: 0, width: 320 }).then(setQr).catch(() => undefined);
  }, []);
  return (
    <div className="mx-auto w-64 rotate-[-4deg] overflow-hidden rounded-2xl bg-white text-black shadow-[0_40px_120px_rgba(0,0,0,0.6)] sm:w-72">
      <div className="border-b-4 border-zener-gold bg-[#0b0b0b] py-4 text-center text-sm font-black tracking-[0.3em] text-white">{brand.display_name.toUpperCase()}</div>
      <div className="px-7 pb-6 pt-5 text-center">
        <p className="text-lg font-extrabold">Scan to buy electricity</p>
        <div className="mx-auto mt-4 aspect-square w-full">{qr ? <img src={qr} alt="" className="h-full w-full" /> : null}</div>
        <p className="mt-4 font-mono text-xl font-extrabold">0101 2345 678</p>
        <p className="text-xs text-black/50">Ikeja Electric · Flat 4B</p>
      </div>
    </div>
  );
}

const FAQS: [string, string][] = [
  ['Which meters can I recharge?', 'Any prepaid (and postpaid) meter on the DisCos listed on this page. Enter the meter number and we confirm the name on it with your DisCo before you pay.'],
  ['How fast is my token?', 'Usually seconds after payment. If your DisCo is slow the order shows as delayed and we keep trying. You are never charged twice, and failed purchases are refunded.'],
  ['How do I pay?', 'By card, bank transfer or USSD through a secure checkout, or from your Zenerlink wallet in one tap.'],
  ['Why are my units different from the estimate?', 'Your DisCo calculates the final units from your tariff band. The units on your receipt are the DisCo’s own figure.'],
  ['Can I pay for someone else’s meter?', 'Yes. Enter their meter number, or scan the QR sticker on their meter. We show the name on the meter before you pay.'],
];

export function Landing({ nav, signedIn }: { nav: Nav; signedIn: boolean }) {
  const brand = useBrand();
  const discos = useDiscos();
  useHashScroll();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav nav={nav} signedIn={signedIn} />

      {/* Hero */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden">
        <Horizon />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-40 pt-32 sm:px-8 lg:pb-48">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-white/55">Prepaid electricity · Nigeria</p>
          <h1 className="mt-5 max-w-3xl text-[44px] font-black leading-[1.02] tracking-tight sm:text-7xl lg:text-[86px]">Power, on demand.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
            Recharge any prepaid meter on any DisCo. Pay by card, transfer or USSD and your token appears in seconds.
          </p>
          <HeroBuyForm discos={discos} nav={nav} />
          <p className="mt-4 text-sm text-white/45">
            {signedIn ? (
              <button type="button" onClick={() => nav('/')} className="font-semibold text-white/80 underline-offset-4 hover:underline">Go to your account</button>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => nav('/login')} className="font-semibold text-white/80 underline-offset-4 hover:underline">Sign in</button>
              </>
            )}
          </p>
        </div>
      </section>

      {/* Facts */}
      <section className="border-t border-white/[0.06] bg-black">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-y-8 px-5 py-12 sm:px-8 lg:grid-cols-4">
          {[
            [discos.length ? String(discos.length) : '11', 'DisCos supported'],
            ['Seconds', 'From payment to token'],
            ['24/7', 'Buy any time, day or night'],
            ['Card · Transfer · USSD', 'Or pay from your wallet'],
          ].map(([v, l]) => (
            <div key={l} className="border-l border-white/[0.1] pl-5">
              <dt className="text-2xl font-black tracking-tight sm:text-3xl">{v}</dt>
              <dd className="mt-1 text-sm text-white/45">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zener-gold">How it works</p>
          <h2 className="mt-4 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">From meter number to token in three steps.</h2>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-3">
            {[
              ['Enter your meter', 'Pick your DisCo and type your meter number. We confirm the account name with the DisCo before you pay.'],
              ['Pay your way', 'Card, bank transfer or USSD through a secure checkout, or one tap from your wallet.'],
              ['Load your token', 'Your 20-digit token appears instantly and is saved to your account. Type it on your meter keypad.'],
            ].map(([t, d], i) => (
              <li key={t} className="bg-black p-8 lg:p-10">
                <span className="font-mono text-sm font-bold text-zener-gold">0{i + 1}</span>
                <h3 className="mt-6 text-xl font-bold">{t}</h3>
                <p className="mt-3 text-[15px] leading-7 text-white/55">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Panel
        eyebrow="Your account"
        title="Your wallet. Your meters. One tap."
        body="Keep a balance, save every meter you buy for, and find any token again from your purchase history. Buying for home, the shop and your parents takes seconds."
        cta={
          <button type="button" onClick={() => nav(signedIn ? '/' : '/login')} className={primaryBtn}>
            {signedIn ? 'Go to my account' : 'Create a free account'}
          </button>
        }
      >
        <WalletMock />
      </Panel>

      <Panel
        reverse
        eyebrow="Meter QR"
        title="Scan to pay. For anyone, anywhere."
        body="Every saved meter gets its own QR code. Stick it on the meter or send it on WhatsApp. Whoever scans it lands on a pre-filled order and only enters the amount."
        cta={
          <button type="button" onClick={() => nav(signedIn ? '/meters' : '/login')} className={ghostBtn}>
            <QrCode size={16} /> Get your meter QR
          </button>
        }
      >
        <StickerMock />
      </Panel>

      <Panel
        id="business"
        eyebrow="Business"
        title="Built for estates, landlords and property managers."
        body="Print a QR sticker for every unit so tenants recharge themselves, keep track of every purchase, and stop collecting cash for tokens. White-label options are available for partners."
        cta={
          brand.support_email ? (
            <a href={`mailto:${brand.support_email}?subject=${encodeURIComponent('Zenerlink for business')}`} className={primaryBtn}>
              Talk to us <ArrowRight size={16} />
            </a>
          ) : null
        }
      >
        <ul className="space-y-3">
          {[
            ['QR stickers for every meter', 'Tenants scan and pay. No meter numbers to copy, no mistakes.'],
            ['One account, many meters', 'Every flat, office and shop in one list, with the last purchase for each.'],
            ['Your brand, our platform', 'Run Zenerlink under your own name and colours.'],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
              <Check size={20} className="mt-0.5 shrink-0 text-zener-gold" />
              <span>
                <span className="block font-bold">{t}</span>
                <span className="mt-1 block text-[15px] text-white/55">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* DisCos */}
      {discos.length ? (
        <section className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Works with your DisCo</h2>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {discos.map((d) => (
                <li key={d.provider_code} className="flex items-center gap-3 rounded-xl border border-white/[0.08] px-4 py-3.5">
                  <DiscoMark disco={d} />
                  <span className="truncate text-sm font-semibold text-white/80">{d.provider_name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-white/[0.06]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zener-gold">Support</p>
            <h2 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">Questions, answered.</h2>
            {brand.support_email ? (
              <p className="mt-5 text-[17px] leading-8 text-white/60">
                Still stuck? Email{' '}
                <a href={`mailto:${brand.support_email}`} className="font-semibold text-white underline underline-offset-4">{brand.support_email}</a>
                {brand.support_phone ? <> or call <a href={`tel:${brand.support_phone}`} className="font-semibold text-white underline underline-offset-4">{brand.support_phone}</a></> : null}.
              </p>
            ) : null}
          </div>
          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-semibold">
                  {q}
                  <ChevronDown size={18} className="shrink-0 text-white/45 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-white/55">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="relative overflow-hidden border-t border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(var(--zener-gold)/0.22),transparent_65%)]" />
        <div className="relative mx-auto max-w-7xl px-5 py-24 text-center sm:px-8 lg:py-32">
          <h2 className="mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Never get caught in the dark.</h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href="#buy" className={primaryBtn}>Buy electricity</a>
            <button type="button" onClick={() => nav(signedIn ? '/' : '/login')} className={ghostBtn}>{signedIn ? 'My account' : 'Sign in'}</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-sm text-white/45 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[15px] font-black tracking-[0.3em] text-white/85">{brand.display_name.toUpperCase()}</p>
            <p className="mt-2">&copy; {year} {brand.display_name}. A product of Zieon Energies Ltd, RC 9519634.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {SECTIONS.map(([to, label]) => (
              <a key={to} href={to} className="hover:text-white">{label}</a>
            ))}
            {brand.support_email ? <a href={`mailto:${brand.support_email}`} className="hover:text-white">{brand.support_email}</a> : null}
            <span className="flex items-center gap-1.5"><Lock size={13} /> Secured payments</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function DiscoMark({ disco }: { disco: Disco }) {
  const [broken, setBroken] = useState(false);
  if (disco.logo_url && !broken) {
    return <img src={disco.logo_url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-8 w-8 shrink-0 rounded-md bg-white object-contain" />;
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/[0.08] text-[8px] font-bold text-white/70">{disco.provider_code.slice(0, 5)}</span>
  );
}

// ---------------------------------------------------------------------------
// Sign in: email first, then password. A new email creates the account.
// ---------------------------------------------------------------------------

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Network error. Check your connection and try again.');

export function LoginPage({ onDone, prefill, nav }: { onDone: (u: User) => void; prefill: Prefill; nav: Nav }) {
  const brand = useBrand();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (step === 'email') {
      if (!emailOk) return setError('Enter a valid email address.');
      return setStep('password');
    }
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    try {
      let s;
      try {
        s = await api.register(email.trim(), '', '', password);
      } catch (err) {
        if (!(err instanceof ApiError && err.code === 'email_taken')) throw err;
        s = await api.login(email.trim(), password);
      }
      onDone(s.user);
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'invalid_credentials' ? 'That password is not right for this email.' : message(err));
      setBusy(false);
    }
  };

  const links: [string, string, () => void][] = [
    ['Buy electricity', 'Recharge any prepaid meter on any DisCo', () => nav('/#buy')],
    ['How it works', 'From meter number to token in three steps', () => nav('/#how')],
    ['For estates and businesses', 'QR stickers for every meter you manage', () => nav('/#business')],
    ['Visit our help center', 'Answers to common questions', () => nav('/#faq')],
  ];

  const field =
    'h-14 w-full rounded-md border border-white/20 bg-transparent px-4 text-[16px] text-white outline-none transition placeholder:text-white/40 focus:border-white/70';

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="mx-auto flex h-[72px] max-w-7xl items-center px-5 sm:px-8">
        <Wordmark onClick={() => nav('/')} />
      </header>
      <main className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-4 sm:px-8 lg:min-h-[calc(100vh-72px)] lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:pb-24">
        <div className="rounded-lg border border-white/[0.12] px-6 py-12 sm:px-14 sm:py-20 lg:px-24">
          <form onSubmit={(e) => void submit(e)} noValidate className="mx-auto max-w-md">
            <h1 className="text-4xl font-black tracking-tight sm:text-[44px]">{step === 'email' ? 'Sign in' : 'Welcome'}</h1>
            {prefill ? (
              <p className="mt-4 flex items-center gap-2.5 rounded-md bg-zener-gold/[0.08] px-3.5 py-2.5 text-sm text-white/75">
                <QrCode size={16} className="shrink-0 text-zener-gold" /> Buying for meter <span className="font-semibold text-white">{prefill.meter}</span> ({prefill.disco})
              </p>
            ) : null}

            {step === 'email' ? (
              <>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="Email"
                  aria-label="Email"
                  className={`${field} mt-8`}
                />
                <p className="mt-3 text-xs text-white/40">New to {brand.display_name}? Enter your email and we’ll set up your account.</p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setPassword('');
                    setError('');
                  }}
                  className="mt-3 text-sm text-white/55 hover:text-white"
                >
                  {email.trim()} · <span className="underline underline-offset-4">Change</span>
                </button>
                <div className="relative mt-8">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoFocus
                    placeholder="Password"
                    aria-label="Password"
                    className={`${field} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/45 hover:text-white/80"
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-3 text-xs text-white/40">New here? Choose a password (8+ characters) and we’ll create your account.</p>
              </>
            )}

            {error ? <p className="mt-4 rounded-md bg-zener-danger/10 px-3.5 py-2.5 text-sm text-zener-danger">{error}</p> : null}

            <button
              type="submit"
              disabled={busy || (step === 'email' ? !emailOk : password.length < 8)}
              className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-white text-[15px] font-bold text-black transition hover:bg-white/85 disabled:opacity-40"
            >
              {busy && <Loader2 size={17} className="animate-spin" />}
              {step === 'email' ? 'Next' : 'Continue'}
            </button>

            <button type="button" onClick={() => setHelp((h) => !h)} className="mt-10 flex items-center gap-2 text-[15px] font-bold">
              Need help? <ChevronDown size={17} className={`text-white/60 transition ${help ? 'rotate-180' : ''}`} />
            </button>
            {help ? (
              <div className="mt-3 space-y-2 text-sm text-white/55">
                <p>Forgot your password? Email {brand.support_email ? <a href={`mailto:${brand.support_email}`} className="text-white underline underline-offset-4">{brand.support_email}</a> : 'our support team'} from the address on your account.</p>
                <p>One account works for buying, your wallet, saved meters and every token you have bought.</p>
              </div>
            ) : null}
          </form>
        </div>

        <ul className="border-t border-white/[0.12] lg:border-t-0">
          {links.map(([t, d, go]) => (
            <li key={t}>
              <button type="button" onClick={go} className="group flex w-full items-center justify-between gap-6 border-b border-white/[0.12] px-2 py-6 text-left">
                <span>
                  <span className="block text-lg font-semibold text-white/90">{t}</span>
                  <span className="mt-1 block text-[15px] text-white/50">{d}</span>
                </span>
                <ChevronRight size={22} strokeWidth={1.4} className="shrink-0 text-white/50 transition group-hover:translate-x-1 group-hover:text-white" />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
