import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Eye, EyeOff, Loader2, Lock, Menu, QrCode, UserRound, X } from 'lucide-react';
import { ApiError, api, guest } from '../lib/api';
import type { Disco, User } from '../lib/api';
import { useBrand } from '../lib/brand';
import familyPhoto from '../assets/photos/family-buying.jpg';
import pylonsPhoto from '../assets/photos/pylons-sunset.jpg';
import { href } from './links';
import { LegalLinks } from './Legal';
import { brandedQrUrl } from './qr';
import { discoLogo } from '../assets/discos';
import { DISCOS, ELECTRICITY, FAQS, HOME, LOGIN, applyPageSeo, discoPage } from '../seo/site';
import type { DiscoSeo } from '../seo/site';
import type { Nav, Prefill } from './links';

// The public site (zenerlink.com). Quiet and technical: black, white type,
// thin line drawings of the grid, gold only where electricity flows. Photo
// slots (HERO_PHOTO, PANEL_PHOTOS) take real photography when we have it.

const HERO_PHOTO = ''; // e.g. '/images/hero.jpg'

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
      className="text-[16px] font-black tracking-[0.34em] text-white"
    >
      {brand.display_name.toUpperCase()}
    </a>
  );
}

function TopNav({ nav, signedIn }: { nav: Nav; signedIn: boolean }) {
  const brand = useBrand();
  const [open, setOpen] = useState(false);
  const account = () => nav(signedIn ? '/' : '/login');

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto max-w-6xl rounded-xl border border-white/[0.08] bg-[#0d0d0d]/70 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-6 pl-5 pr-2 sm:h-16 sm:pl-6">
          <div className="flex items-center gap-9">
            <Wordmark onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
            <nav className="hidden items-center gap-0.5 lg:flex">
              {SECTIONS.map(([to, label]) => (
                <a key={to} href={to} className="rounded-md px-3 py-2 text-[14px] font-medium text-white/70 transition hover:text-white">
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {brand.support_phone ? (
              <a href={`tel:${brand.support_phone}`} className="mr-2 hidden text-[13px] text-white/55 hover:text-white md:inline">
                Call {brand.support_phone}
              </a>
            ) : null}
            <button
              type="button"
              onClick={account}
              aria-label={signedIn ? 'Your account' : 'Sign in'}
              title={signedIn ? 'Your account' : 'Sign in'}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] text-white/80 transition hover:bg-white/[0.16] hover:text-white"
            >
              <UserRound size={18} strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] text-white/80 lg:hidden"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="border-t border-white/[0.08] px-5 pb-5 lg:hidden">
            {SECTIONS.map(([to, label]) => (
              <a key={to} href={to} onClick={() => setOpen(false)} className="block border-b border-white/[0.06] py-4 text-[16px] font-medium text-white/80">
                {label}
              </a>
            ))}
            <button type="button" onClick={account} className="mt-5 h-12 w-full rounded-md bg-white text-sm font-bold text-black">
              {signedIn ? 'Go to my account' : 'Sign in'}
            </button>
          </nav>
        ) : null}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Line art: a lattice pylon and the cables it carries, drawn like a
// technical sketch. One gold pulse travels the line.
// ---------------------------------------------------------------------------

function lattice(cx: number, base: number, top: number, halfBase: number, halfTop: number, panels: number) {
  const at = (y: number) => halfTop + ((y - top) / (base - top)) * (halfBase - halfTop);
  const lines: string[] = [];
  let prev = base;
  for (let i = 1; i <= panels; i++) {
    // Panels shrink towards the top, like a real tower.
    const y = base - (base - top) * (1 - Math.pow(1 - i / panels, 1.35));
    const a = at(prev);
    const b = at(y);
    lines.push(`M${cx - a} ${prev}L${cx + b} ${y}M${cx + a} ${prev}L${cx - b} ${y}M${cx - b} ${y}L${cx + b} ${y}`);
    prev = y;
  }
  return `M${cx - halfBase} ${base}L${cx - halfTop} ${top}M${cx + halfBase} ${base}L${cx + halfTop} ${top}` + lines.join('');
}

function Pylon({ cx, base, h, w, arms }: { cx: number; base: number; h: number; w: number; arms: [number, number][] }) {
  const top = base - h;
  const body = lattice(cx, base, top + h * 0.2, w, w * 0.16, 9);
  const head = `M${cx - w * 0.16} ${top + h * 0.2}L${cx} ${top}L${cx + w * 0.16} ${top + h * 0.2}`;
  const armPaths = arms
    .map(([dy, span]) => {
      const y = top + h * dy;
      return `M${cx - span} ${y}L${cx + span} ${y}M${cx - span} ${y}L${cx - w * 0.12} ${y + h * 0.035}M${cx + span} ${y}L${cx + w * 0.12} ${y + h * 0.035}M${cx - span} ${y}l0 ${h * 0.05}M${cx + span} ${y}l0 ${h * 0.05}`;
    })
    .join('');
  return <path d={body + head + armPaths} />;
}

// Insulator tips where cables attach: [x, y] for each arm end.
const tips = (cx: number, base: number, h: number, arms: [number, number][]) =>
  arms.flatMap(([dy, span]) => {
    const y = base - h + h * dy + h * 0.05;
    return [
      [cx - span, y],
      [cx + span, y],
    ] as [number, number][];
  });

function GridArt({ className = '' }: { className?: string }) {
  const near = { cx: 1010, base: 900, h: 640, w: 92, arms: [[0.22, 150], [0.36, 185], [0.5, 150]] as [number, number][] };
  const far = { cx: 330, base: 760, h: 260, w: 36, arms: [[0.22, 60], [0.36, 74], [0.5, 60]] as [number, number][] };
  const a = tips(near.cx, near.base, near.h, near.arms);
  const b = tips(far.cx, far.base, far.h, far.arms);
  // Catenary-ish sag between towers, and off the left edge beyond the far tower.
  const cables = a.map(([x1, y1], i) => {
    const [x2, y2] = b[i];
    const sag = 120 + i * 6;
    const out = `M${x2} ${y2}Q${x2 - 260} ${y2 + 60} ${-40} ${y2 + 20}`;
    const off = `M${x1} ${y1}Q${x1 + 160} ${y1 + 70} ${1300} ${y1 + 40}`;
    return { span: `M${x1} ${y1}Q${(x1 + x2) / 2} ${Math.max(y1, y2) + sag} ${x2} ${y2}`, out, off };
  });
  return (
    <svg viewBox="0 0 1200 900" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" className={className}>
      <g fill="none" stroke="white" strokeOpacity="0.16" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <Pylon {...near} />
        <Pylon {...far} />
        {cables.map((c, i) => (
          <g key={i}>
            <path d={c.span} />
            <path d={c.out} />
            <path d={c.off} />
          </g>
        ))}
        <path d="M-20 900L1220 900" strokeOpacity="0.1" />
      </g>
      <path id="zl-live" d={cables[1].span} fill="none" stroke="none" />
      <circle r="2.6" fill="rgb(var(--zener-gold))">
        <animateMotion dur="5.5s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
          <mpath href="#zl-live" />
        </animateMotion>
      </circle>
      <circle r="9" fill="rgb(var(--zener-gold))" opacity="0.18">
        <animateMotion dur="5.5s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
          <mpath href="#zl-live" />
        </animateMotion>
      </circle>
    </svg>
  );
}

// A 50 Hz trace across the facts strip, scrolling slowly like a scope.
function SineTrace() {
  const W = 1200;
  const cycles = 6;
  const pts: string[] = [];
  for (let x = 0; x <= W * 2; x += 6) pts.push(`${x},${60 - 26 * Math.sin((x / W) * cycles * 2 * Math.PI)}`);
  return (
    <svg viewBox={`0 0 ${W} 120`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-28 w-full -translate-y-1/2">
      <g className="zl-scroll">
        <polyline points={pts.join(' ')} fill="none" stroke="rgb(var(--zener-gold))" strokeOpacity="0.35" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </g>
      <line x1="0" y1="60" x2={W} y2="60" stroke="white" strokeOpacity="0.06" vectorEffect="non-scaling-stroke" />
      <style>{`.zl-scroll{animation:zl-scroll 14s linear infinite}@keyframes zl-scroll{to{transform:translateX(-${W}px)}}@media (prefers-reduced-motion:reduce){.zl-scroll{animation:none}}`}</style>
    </svg>
  );
}

function HeroBuyForm({ discos, nav, initial }: { discos: Disco[]; nav: Nav; initial?: string }) {
  const [disco, setDisco] = useState('');
  const [meter, setMeter] = useState('');
  // The built-in DisCo list stands in until (or if) the API answers.
  const list = discos.length ? discos.map((d) => ({ code: d.provider_code, name: d.provider_name })) : DISCOS.map((d) => ({ code: d.code, name: d.name }));
  const chosen =
    disco || list.find((d) => d.code === (initial ?? 'IKEDC'))?.code || list[0]?.code || '';
  const ok = !!chosen && meter.length >= 6;
  return (
    <form
      id="buy"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) nav(`/buy?disco=${chosen}&meter=${meter}&type=prepaid`);
      }}
      className="mt-10 flex w-full max-w-xl scroll-mt-28 flex-col gap-2 sm:flex-row"
    >
      <label className="relative sm:w-52">
        <span className="sr-only">Electricity company</span>
        <select
          value={chosen}
          onChange={(e) => setDisco(e.target.value)}
          className="h-12 w-full appearance-none rounded-md border border-white/20 bg-black/40 pl-4 pr-10 text-[15px] font-medium text-white outline-none backdrop-blur focus:border-white/60"
        >
          {list.map((d) => (
            <option key={d.code} value={d.code} className="bg-[#111]">
              {d.name}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45" />
      </label>
      <label className="flex-1">
        <span className="sr-only">Meter number</span>
        <input
          inputMode="numeric"
          value={meter}
          onChange={(e) => setMeter(e.target.value.replace(/\D/g, '').slice(0, 20))}
          placeholder="Meter number"
          className="h-12 w-full rounded-md border border-white/20 bg-black/40 px-4 text-[15px] text-white outline-none backdrop-blur placeholder:text-white/40 focus:border-white/60"
        />
      </label>
      <button
        type="submit"
        disabled={!ok}
        className="h-12 rounded-md bg-white px-6 text-[14px] font-bold text-black transition hover:bg-white/85 disabled:opacity-60"
      >
        Buy now
      </button>
    </form>
  );
}

const primaryBtn = 'inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-bold text-black transition hover:bg-white/85';
const ghostBtn = 'inline-flex h-11 items-center gap-2 rounded-md border border-white/25 px-5 text-sm font-bold text-white transition hover:border-white/60';

function Panel({ id, title, body, children, cta, reverse = false }: {
  id?: string;
  title: string;
  body: string;
  children: React.ReactNode;
  cta?: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-white/[0.07]">
      <div className={`mx-auto grid max-w-6xl items-center gap-14 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:gap-24 lg:py-32 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <h2 className="max-w-md text-[34px] font-bold leading-[1.1] tracking-tight sm:text-[44px]">{title}</h2>
          <p className="mt-5 max-w-md text-[16px] leading-7 text-white/55">{body}</p>
          {cta ? <div className="mt-8 flex flex-wrap gap-3">{cta}</div> : null}
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

// Product shot, drawn flat: a meter sticker.
function StickerShot() {
  const brand = useBrand();
  const [qr, setQr] = useState('');
  useEffect(() => {
    brandedQrUrl(window.location.origin, 320).then(setQr).catch(() => undefined);
  }, []);
  return (
    <div className="mx-auto w-60 bg-white p-6 text-center text-black sm:w-64">
      <p className="text-[11px] font-black tracking-[0.34em]">{brand.display_name.toUpperCase()}</p>
      <div className="mx-auto mt-5 aspect-square w-full">{qr ? <img src={qr} alt="" className="h-full w-full" /> : null}</div>
      <p className="mt-5 font-mono text-lg font-bold">0101 2345 678</p>
      <p className="mt-1 text-[11px] text-black/50">Scan to buy electricity</p>
    </div>
  );
}


// Sections after the hero fade up once as they scroll into view.
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(root.querySelectorAll(':scope > section:not(:first-of-type), :scope > footer'));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('revealed');
          io.unobserve(e.target);
        }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => {
      el.classList.add('reveal');
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return ref;
}

export function Landing({ nav, signedIn, focus, index = false }: { nav: Nav; signedIn: boolean; focus?: DiscoSeo; index?: boolean }) {
  const brand = useBrand();
  const discos = useDiscos();
  useHashScroll();
  const revealRef = useReveal();
  useEffect(() => {
    applyPageSeo(focus ? discoPage(focus) : index ? ELECTRICITY : HOME);
    if (index) window.setTimeout(() => document.getElementById('discos')?.scrollIntoView(), 50);
  }, [focus, index]);
  const short = focus ? (focus.name.match(/\(([^)]+)\)/)?.[1] ?? focus.name) : '';
  const year = new Date().getFullYear();

  return (
    <div ref={revealRef} className="min-h-screen bg-black text-white">
      <TopNav nav={nav} signedIn={signedIn} />

      {/* Hero */}
      <section className="relative flex min-h-[100svh] items-end overflow-hidden lg:items-center">
        {HERO_PHOTO ? (
          <>
            <img src={HERO_PHOTO} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/10" />
          </>
        ) : (
          <>
            <GridArt className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent lg:via-black/60" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
          </>
        )}
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-20 pt-36 sm:px-8 lg:pb-24">
          {focus ? (
            <h1 className="max-w-3xl text-[42px] font-bold leading-[1.04] tracking-tight sm:text-[60px] lg:text-[72px]">Buy {short} electricity, in&nbsp;seconds.</h1>
          ) : (
            <h1 className="max-w-2xl text-[46px] font-bold leading-[1.02] tracking-tight sm:text-[68px] lg:text-[80px]">Power, on&nbsp;demand.</h1>
          )}
          <p className="mt-6 max-w-md text-[17px] leading-7 text-white/65">
            {focus
              ? `Recharge your ${focus.name} prepaid meter. Pay by card, transfer or USSD and your token arrives in seconds. Serving ${focus.areas}.`
              : 'Recharge any prepaid meter on any DisCo in Nigeria. Pay by card, transfer or USSD. Your token arrives in seconds.'}
          </p>
          <HeroBuyForm discos={discos} nav={nav} initial={focus?.code} />
          <p className="mt-5 text-sm text-white/45">
            {signedIn ? (
              <button type="button" onClick={() => nav('/')} className="text-white/80 underline underline-offset-4 hover:text-white">Go to your account</button>
            ) : (
              <>
                Have an account?{' '}
                <button type="button" onClick={() => nav('/login')} className="text-white/80 underline underline-offset-4 hover:text-white">Sign in</button>
              </>
            )}
          </p>
        </div>
      </section>

      {/* Facts on a 50 Hz trace */}
      <section className="relative overflow-hidden border-y border-white/[0.07]">
        <SineTrace />
        <dl className="relative mx-auto grid max-w-6xl grid-cols-2 gap-y-10 px-5 py-14 sm:px-8 lg:grid-cols-4 lg:py-16">
          {[
            [discos.length ? String(discos.length) : '11', 'DisCos'],
            ['Seconds', 'Payment to token'],
            ['24/7', 'Open all hours'],
            ['3 ways', 'Card, transfer, USSD'],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="text-[34px] font-bold leading-none tracking-tight sm:text-[42px]">{v}</dt>
              <dd className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <h2 className="max-w-lg text-[34px] font-bold leading-[1.1] tracking-tight sm:text-[44px]">Meter number to token, in three steps.</h2>
          <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
            {[
              ['Enter your meter', 'Choose your DisCo and type the meter number. We check the name on the meter with the DisCo before you pay.'],
              ['Pay', 'Card, bank transfer or USSD through a secure checkout, or one tap from your wallet.'],
              ['Load the token', 'The 20-digit token appears on screen and in your account. Type it on your meter keypad.'],
            ].map(([t, d], i) => (
              <li key={t} className="border-t border-white/20 pt-6">
                <span className="font-mono text-[12px] text-white/40">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-lg font-bold">{t}</h3>
                <p className="mt-2 text-[15px] leading-7 text-white/55">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Full-bleed photo: the grid at sunset */}
      <section className="relative isolate overflow-hidden">
        <img src={pylonsPhoto} alt="High-voltage transmission towers at sunset" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/45 to-black/10" />
        <div className="mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-5 py-20 sm:px-8 lg:min-h-[86vh] lg:py-28">
          <h2 className="max-w-xl text-[36px] font-bold leading-[1.06] tracking-tight sm:text-[52px]">The grid is big. Buying from it should be simple.</h2>
          <p className="mt-5 max-w-md text-[16px] leading-7 text-white/75">
            Every DisCo, one place to pay. We talk to your DisCo for you and hand you the token.
          </p>
          <div className="mt-8">
            <a href="#buy" className={primaryBtn}>Buy electricity</a>
          </div>
        </div>
      </section>

      <Panel
        title="One account for every meter you pay for."
        body="Home, the shop, your parents’ flat. Save each meter once, keep a wallet balance, and find any token again in your history."
        cta={
          <button type="button" onClick={() => nav(signedIn ? '/' : '/login')} className={primaryBtn}>
            {signedIn ? 'Go to my account' : 'Create an account'}
          </button>
        }
      >
        <figure className="relative">
          <img src={familyPhoto} alt="A family buying electricity on a laptop with a bank card" className="aspect-[4/3] w-full rounded-xl object-cover" />
          <figcaption className="absolute -bottom-6 left-4 right-4 rounded-lg border border-white/[0.1] bg-black/85 p-4 backdrop-blur sm:left-auto sm:right-[-1.5rem] sm:w-72">
            <span className="flex items-center justify-between text-[11px] text-white/45">
              <span>Ikeja Electric · 0101 2345 678</span>
              <span className="text-zener-gold">≈ 25 kWh</span>
            </span>
            <span className="mt-2 block font-mono text-[15px] tracking-wider text-white">2636 2054 4059 8275 7802</span>
          </figcaption>
        </figure>
      </Panel>

      <Panel
        reverse
        title="Scan the meter. Pay. Done."
        body="Every saved meter gets a QR code. Stick it on the meter or send it on WhatsApp. Whoever scans it only has to enter the amount."
        cta={
          <button type="button" onClick={() => nav(signedIn ? '/meters' : '/login')} className={ghostBtn}>
            <QrCode size={16} /> Get a meter QR
          </button>
        }
      >
        <StickerShot />
      </Panel>

      <Panel
        id="business"
        title="For estates, landlords and property managers."
        body="A QR sticker on every unit so tenants recharge themselves. Every meter and purchase in one place. No more collecting cash for tokens."
        cta={
          brand.support_email ? (
            <a href={`mailto:${brand.support_email}?subject=${encodeURIComponent('Zenerlink for business')}`} className={primaryBtn}>
              Talk to us <ArrowRight size={16} />
            </a>
          ) : null
        }
      >
        <dl className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {[
            ['Stickers', 'A QR code for every meter you manage'],
            ['Meters', 'Every flat, office and shop in one list'],
            ['White label', 'Run it under your own name and colours'],
          ].map(([t, d]) => (
            <div key={t} className="grid grid-cols-[120px_1fr] gap-4 py-5 sm:grid-cols-[160px_1fr]">
              <dt className="font-mono text-[12px] uppercase tracking-[0.16em] text-white/40">{t}</dt>
              <dd className="text-[15px] text-white/80">{d}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {/* DisCos */}
      <section id="discos" className="scroll-mt-24 border-t border-white/[0.07]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="text-xl font-bold tracking-tight">Buy electricity for your DisCo</h2>
          <ul className="mt-6 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {DISCOS.map((s) => {
              const live = discos.find((d) => d.provider_code === s.code);
              return (
                <li key={s.code}>
                  <a
                    href={href(`/electricity/${s.slug}`)}
                    onClick={(e) => {
                      e.preventDefault();
                      nav(`/electricity/${s.slug}`);
                    }}
                    className={`group flex items-center gap-3 border-b border-white/[0.07] py-4 ${focus?.code === s.code ? 'text-zener-gold' : ''}`}
                  >
                    <DiscoMark code={s.code} logoUrl={live?.logo_url} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-white/80 group-hover:text-white">{s.name}</span>
                      <span className="block truncate text-[12px] text-white/35">{s.areas}</span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 border-t border-white/[0.07]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.5fr] lg:py-32">
          <div>
            <h2 className="text-[34px] font-bold leading-[1.1] tracking-tight sm:text-[44px]">Questions</h2>
            {brand.support_email ? (
              <p className="mt-5 text-[15px] leading-7 text-white/55">
                Something else? <a href={`mailto:${brand.support_email}`} className="text-white underline underline-offset-4">{brand.support_email}</a>
                {brand.support_phone ? <> · <a href={`tel:${brand.support_phone}`} className="text-white underline underline-offset-4">{brand.support_phone}</a></> : null}
              </p>
            ) : null}
          </div>
          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[16px] font-medium">
                  {q}
                  <ChevronDown size={17} className="shrink-0 text-white/40 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-white/55">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 text-[13px] text-white/40 sm:px-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[14px] font-black tracking-[0.34em] text-white/80">{brand.display_name.toUpperCase()}</p>
            <p className="mt-3">&copy; {year} {brand.display_name}. A product of Zieon Energies Ltd, RC 9519634.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {SECTIONS.map(([to, label]) => (
              <a key={to} href={to} className="hover:text-white">{label}</a>
            ))}
            {brand.support_email ? <a href={`mailto:${brand.support_email}`} className="hover:text-white">{brand.support_email}</a> : null}
            <LegalLinks nav={nav} />
            <span className="flex items-center gap-1.5"><Lock size={12} /> Secured payments</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function DiscoMark({ code, logoUrl }: { code: string; logoUrl?: string }) {
  const [broken, setBroken] = useState(false);
  const src = discoLogo(code, logoUrl);
  if (src && !broken) {
    return <img src={src} alt="" onError={() => setBroken(true)} className="h-9 w-9 shrink-0 rounded bg-white object-contain" />;
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-white/[0.08] text-[9px] font-bold text-white/70">{code.slice(0, 5)}</span>
  );
}

// ---------------------------------------------------------------------------
// Sign in: email first, then password. A new email creates the account.
// ---------------------------------------------------------------------------

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Network error. Check your connection and try again.');

export function LoginPage({ onDone, prefill, nav }: { onDone: (u: User) => void; prefill: Prefill; nav: Nav }) {
  useEffect(() => applyPageSeo(LOGIN), []);
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

  const field =
    'h-12 w-full rounded-md border border-white/15 bg-white/[0.03] px-4 text-[15px] text-white outline-none transition placeholder:text-white/30 focus:border-zener-gold/70';
  const steps: ['email' | 'password', string][] = [
    ['email', 'Email'],
    ['password', 'Password'],
  ];

  return (
    <div className="min-h-screen bg-black text-white lg:grid lg:grid-cols-[1fr_minmax(480px,0.9fr)]">
      {/* Photo side: the grid at sunset, our own image and colour. */}
      <aside className="relative h-48 overflow-hidden sm:h-64 lg:sticky lg:top-0 lg:h-screen">
        <img src={pylonsPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
        <div className="absolute inset-x-0 bottom-0 hidden p-12 lg:block">
          <p className="max-w-sm text-[30px] font-bold leading-[1.12] tracking-tight">Every DisCo. One account. Tokens in seconds.</p>
        </div>
      </aside>

      <div className="relative flex min-h-[calc(100vh-12rem)] flex-col sm:min-h-[calc(100vh-16rem)] lg:min-h-screen">
      <header className="flex h-[72px] w-full items-center justify-between px-5 sm:px-10">
        <Wordmark onClick={() => nav('/')} />
        <button type="button" onClick={() => nav('/')} className="text-[13px] text-white/50 hover:text-white">
          Back to site
        </button>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <form onSubmit={(e) => void submit(e)} noValidate className="w-full max-w-[380px]">
          <ol className="flex gap-6 font-mono text-[11px] uppercase tracking-[0.18em]">
            {steps.map(([k, label], i) => (
              <li key={k} className={step === k ? 'text-zener-gold' : 'text-white/30'}>
                {String(i + 1).padStart(2, '0')} {label}
              </li>
            ))}
          </ol>
          <h1 className="mt-5 text-[32px] font-bold leading-tight tracking-tight">
            {step === 'email' ? 'Your electricity account' : 'Enter your password'}
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-white/50">
            {step === 'email' ? 'Sign in or create one with the same step.' : (
              <>
                {email.trim()}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setPassword('');
                    setError('');
                  }}
                  className="text-white/80 underline underline-offset-4 hover:text-white"
                >
                  change
                </button>
              </>
            )}
          </p>
          {prefill ? (
            <p className="mt-5 flex items-center gap-2.5 border-l-2 border-zener-gold pl-3 text-[13px] text-white/70">
              <QrCode size={15} className="shrink-0 text-zener-gold" /> Meter {prefill.meter} ({prefill.disco}) is ready to pay for.
            </p>
          ) : null}

          {step === 'email' ? (
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              aria-label="Email"
              className={`${field} mt-8`}
            />
          ) : (
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
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          )}
          <p className="mt-2.5 text-[12px] text-white/35">
            {step === 'email' ? `New to ${brand.display_name}? We’ll set up your account.` : 'New here? Choose a password of 8 or more characters.'}
          </p>

          {error ? <p className="mt-4 text-[13px] text-zener-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || (step === 'email' ? !emailOk : password.length < 8)}
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-zener-gold text-[14px] font-bold text-black transition hover:brightness-110 disabled:opacity-35"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {step === 'email' ? 'Continue' : 'Sign in'}
          </button>

          <button type="button" onClick={() => setHelp((h) => !h)} className="mt-8 flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white">
            Trouble signing in? <ChevronDown size={14} className={`transition ${help ? 'rotate-180' : ''}`} />
          </button>
          {help ? (
            <p className="mt-2 text-[13px] leading-6 text-white/45">
              Forgot your password? Email {brand.support_email ? <a href={`mailto:${brand.support_email}`} className="text-white/80 underline underline-offset-4">{brand.support_email}</a> : 'our support team'} from the address on your account.
            </p>
          ) : null}
        </form>
      </main>

      <footer className="flex w-full flex-wrap items-center justify-between gap-3 px-5 pb-6 text-[12px] text-white/35 sm:px-10">
        <span>&copy; {new Date().getFullYear()} {brand.display_name}</span>
        <span className="flex gap-5">
          <button type="button" onClick={() => nav('/#how')} className="hover:text-white">How it works</button>
          <button type="button" onClick={() => nav('/#business')} className="hover:text-white">Business</button>
          <button type="button" onClick={() => nav('/#faq')} className="hover:text-white">Help</button>
          <LegalLinks nav={nav} className="!text-[12px]" />
        </span>
      </footer>
      </div>
    </div>
  );
}
