import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';
import type { Disco } from '../lib/api';
import { discoLogo } from '../assets/discos';
import { ApiError, koboToNaira } from '../lib/api';
import { formatCurrency } from '../lib/format';

// Shared building blocks of the account pages.

export const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Network error. Check your connection and try again.');

export const naira = (kobo: number) => formatCurrency(koboToNaira(kobo));

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export const card = 'rounded-2xl border border-white/[0.07] bg-white/[0.02]';

export const actionBtn =
  'flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm font-bold hover:border-white/20 disabled:opacity-50';

export const inputCls =
  'h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-zener-gold/70 focus:bg-white/[0.05] focus:ring-4 focus:ring-zener-gold/10';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

export function Spinner() {
  return <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-zener-gold" /></div>;
}

export function ErrorBox({ text }: { text: string }) {
  return <p className="rounded-lg bg-zener-danger/10 px-3.5 py-2.5 text-sm text-zener-danger">{text}</p>;
}


export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
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

export function DiscoPicker({ discos, value, onChange }: { discos: Disco[]; value: string; onChange: (v: string) => void }) {
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
export function DiscoLogo({ disco }: { disco: Disco }) {
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

export function estimateKwh(d: Disco, naira: number): number {
  if (!d.rate_kobo_per_kwh || !Number.isFinite(naira) || naira <= 0) return 0;
  const net = Math.round(naira * 100) - d.service_fee_kobo;
  if (net <= 0) return 0;
  const bps = d.vat_bps ?? 0;
  const energyKobo = net - Math.floor((net * bps) / (10000 + bps));
  return energyKobo / d.rate_kobo_per_kwh;
}

export function formatKwh(kwh: number): string {
  return `${kwh.toLocaleString('en-NG', { maximumFractionDigits: kwh < 10 ? 1 : 0 })} kWh`;
}
