import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// askConfirm opens the in-app confirmation dialog (instead of the browser's
// window.confirm) and resolves true when the person confirms.
export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
let open: ((p: Pending) => void) | null = null;

export function askConfirm(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (open) open({ ...o, resolve });
    else resolve(window.confirm([o.title, o.message].filter(Boolean).join('\n\n')));
  });
}

// ConfirmHost renders the dialog; mount it once in the signed-in layout.
export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    open = (next) => setP((cur) => (cur ? (next.resolve(false), cur) : next));
    return () => {
      open = null;
    };
  }, []);

  useEffect(() => {
    if (!p) return;
    keep.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && done(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  const done = (ok: boolean) => {
    p?.resolve(ok);
    setP(null);
  };

  if (!p) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && done(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full rounded-t-2xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] p-6 shadow-2xl sm:max-w-sm sm:rounded-2xl"
      >
        <div className="flex gap-3.5">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${p.danger ? 'bg-zener-danger/15 text-zener-danger' : 'bg-zener-gold/15 text-zener-gold'}`}>
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-bold">
              {p.title}
            </h2>
            {p.message ? <p className="mt-1.5 text-sm leading-relaxed text-white/55">{p.message}</p> : null}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            ref={keep}
            type="button"
            onClick={() => done(false)}
            className="h-11 rounded-xl bg-white/[0.07] text-sm font-bold text-white/85 transition hover:bg-white/[0.12]"
          >
            {p.cancelLabel || 'Go back'}
          </button>
          <button
            type="button"
            onClick={() => done(true)}
            className={`h-11 rounded-xl text-sm font-bold transition hover:brightness-110 ${p.danger ? 'bg-zener-danger text-white' : 'bg-zener-gold text-black'}`}
          >
            {p.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
