import { Loader2 } from 'lucide-react';
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
