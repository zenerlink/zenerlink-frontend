import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, Eye, EyeOff, Landmark, Loader2, Search, X } from 'lucide-react';
import { ApiError, money, nairaToKobo } from '../lib/api';
import type { Bank, BankAccountLookup, BankLimits, Payout, ReportResult } from '../lib/api';
import { askConfirm } from './confirm';
import { ErrorBox, Field, card, inputCls, message, naira, shortDate } from './kit';

// Money back out of the wallet, and "I paid but nothing came".

const PAYOUT_STATUS: Record<string, [string, string]> = {
  review: ['Being checked', 'bg-zener-gold/15 text-zener-gold'],
  queued: ['Sending', 'bg-zener-gold/15 text-zener-gold'],
  sending: ['Sending', 'bg-zener-gold/15 text-zener-gold'],
  pending: ['With the bank', 'bg-zener-gold/15 text-zener-gold'],
  successful: ['Sent', 'bg-zener-success/15 text-zener-success'],
  failed: ['Returned', 'bg-white/[0.08] text-white/60'],
  rejected: ['Not sent', 'bg-white/[0.08] text-white/60'],
  reversed: ['Returned', 'bg-white/[0.08] text-white/60'],
};

export function PayoutPill({ status }: { status: string }) {
  const [label, cls] = PAYOUT_STATUS[status] ?? [status, 'bg-white/[0.08] text-white/60'];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>;
}

// Banks most people use, shown first.
const POPULAR = ['access', 'gtbank', 'guaranty', 'first bank', 'uba', 'united bank', 'zenith', 'opay', 'palmpay', 'moniepoint', 'kuda', 'wema', 'fidelity', 'sterling', 'fcmb', 'union bank', 'stanbic', 'ecobank'];
const rank = (b: Bank) => {
  const n = b.name.toLowerCase();
  const i = POPULAR.findIndex((p) => n.startsWith(p));
  return i === -1 ? 99 : i;
};

export function BankPicker({ banks, value, onChange }: { banks: Bank[]; value: string; onChange: (b: Bank) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = banks.find((b) => b.code === value);
  const query = q.trim().toLowerCase();
  const shown = (query ? banks.filter((b) => b.name.toLowerCase().includes(query)) : [...banks].sort((a, b) => rank(a) - rank(b))).slice(0, 80);

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
        {selected ? <span className="truncate">{selected.name}</span> : <span className="text-white/30">{banks.length ? 'Choose the bank' : 'Loading banks…'}</span>}
        <ChevronDown size={18} className={`shrink-0 text-white/40 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-3">
            <Search size={15} className="text-white/35" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search banks"
              className="h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-auto py-1">
            {shown.map((b) => (
              <li key={b.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={b.code === value}
                  onClick={() => {
                    onChange(b);
                    setOpen(false);
                    setQ('');
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]"
                >
                  <span className="truncate">{b.name}</span>
                  {b.code === value ? <Check size={16} className="shrink-0 text-zener-gold" /> : null}
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

// WithdrawCard sends wallet money to a bank account. It hides itself where
// withdrawals are not available.
export function WithdrawCard({ walletKobo, onDone }: { walletKobo: number | null; onDone: () => void }) {
  const [info, setInfo] = useState<({ banks: Bank[] } & BankLimits) | null | undefined>(undefined);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState('');
  const [acct, setAcct] = useState('');
  const [found, setFound] = useState<BankAccountLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Payout | null>(null);
  const idemKey = useRef(crypto.randomUUID());

  const loadPayouts = () => money.payouts(5).then((r) => setPayouts(r.payouts)).catch(() => undefined);
  useEffect(() => {
    money
      .banks()
      .then(setInfo)
      .catch(() => setInfo(null));
    void loadPayouts();
  }, []);
  // Withdrawals in flight settle in seconds: keep the list fresh meanwhile.
  const inFlight = payouts.some((p) => ['queued', 'sending', 'pending'].includes(p.status));
  useEffect(() => {
    if (!inFlight) return;
    const t = window.setInterval(() => {
      void loadPayouts();
      onDone();
    }, 4000);
    return () => window.clearInterval(t);
  }, [inFlight, onDone]);

  // Look the account up as soon as it is complete.
  useEffect(() => {
    setFound(null);
    setLookupError('');
    if (!bank || acct.length !== 10) return;
    let stop = false;
    setLooking(true);
    money
      .lookup(bank, acct)
      .then((a) => !stop && setFound(a))
      .catch((e) => !stop && setLookupError(message(e)))
      .finally(() => !stop && setLooking(false));
    return () => {
      stop = true;
    };
  }, [bank, acct]);

  if (!info) return null;
  const kobo = nairaToKobo(Number(amount) || 0);
  const fee = found?.fee_kobo ?? info.fee_kobo;
  const tooLow = kobo > 0 && kobo < info.min_kobo;
  const tooHigh = kobo > info.max_kobo;
  const short = walletKobo !== null && kobo + fee > walletKobo;
  const ready = !!found && kobo >= info.min_kobo && !tooHigh && !short && password.length > 0 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !found) return;
    const ok = await askConfirm({
      title: `Send ${naira(kobo)} to ${found.account_name}?`,
      message: `${found.bank_name || 'Bank'} · ${found.account_number}.${fee ? ` The ${naira(fee)} transfer fee comes from your wallet.` : ''} Money sent to the wrong account can't be pulled back, so check the name.`,
      confirmLabel: 'Send money',
      cancelLabel: 'Go back',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const p = await money.withdraw({ bank_code: bank, account_number: acct, amount_kobo: kobo, password }, idemKey.current);
      idemKey.current = crypto.randomUUID();
      setDone(p);
      setAmount('');
      setPassword('');
      onDone();
      void loadPayouts();
    } catch (err) {
      // A new key after a definite refusal, so a corrected retry is a new request.
      if (err instanceof ApiError && err.status < 500) idemKey.current = crypto.randomUUID();
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} space-y-4 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Withdraw to bank</h2>
          <p className="mt-1 text-sm text-white/45">Send your wallet balance to any Nigerian bank account.</p>
        </div>
        {!open ? (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setDone(null);
            }}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 text-xs font-bold hover:border-zener-gold/50 hover:text-zener-gold"
          >
            <ArrowUpRight size={15} /> Withdraw
          </button>
        ) : (
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-white/40 hover:text-white">
            <X size={17} />
          </button>
        )}
      </div>

      {done ? (
        <div className="rounded-xl border border-zener-success/30 bg-zener-success/[0.06] p-4 text-sm">
          <p className="font-semibold text-white">{done.status === 'review' ? 'Withdrawal requested' : 'Money on its way'}</p>
          <p className="mt-1 text-white/60">
            {done.status === 'review'
              ? `${naira(done.amount_kobo)} to ${done.account_name}. Large withdrawals get a quick check by our team first; we'll send it shortly.`
              : `${naira(done.amount_kobo)} to ${done.account_name}, ${done.bank_name}. It usually lands within minutes.`}
          </p>
        </div>
      ) : null}

      {open ? (
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <Field label="Bank">
            <BankPicker
              banks={info.banks}
              value={bank}
              onChange={(b) => {
                setBank(b.code);
              }}
            />
          </Field>
          <Field label="Account number">
            <input
              inputMode="numeric"
              autoComplete="off"
              value={acct}
              onChange={(e) => setAcct(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit account number"
              className={`${inputCls} font-mono tracking-wider`}
            />
          </Field>
          {looking ? (
            <p className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 size={15} className="animate-spin" /> Checking the account…
            </p>
          ) : found ? (
            <p className="flex items-center gap-2 rounded-xl border border-zener-success/30 bg-zener-success/[0.06] px-3.5 py-3 text-sm font-semibold">
              <Check size={16} className="shrink-0 text-zener-success" /> {found.account_name}
            </p>
          ) : lookupError ? (
            <ErrorBox text={lookupError} />
          ) : null}
          <Field label="Amount" hint={fee ? `Transfer fee ${naira(fee)}` : 'No transfer fee'}>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">₦</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0"
                className={`${inputCls} pl-8`}
              />
            </div>
          </Field>
          {tooLow ? <p className="text-xs text-zener-danger">The least you can withdraw is {naira(info.min_kobo)}.</p> : null}
          {tooHigh ? <p className="text-xs text-zener-danger">The most you can withdraw at once is {naira(info.max_kobo)}.</p> : null}
          {short && !tooHigh ? <p className="text-xs text-zener-danger">Your wallet has {naira(walletKobo ?? 0)}; you need {naira(kobo + fee)} with the fee.</p> : null}
          <Field label="Your password" hint="To confirm it's you">
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-white/40 hover:text-white"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          {error ? <ErrorBox text={error} /> : null}
          <button
            type="submit"
            disabled={!ready}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-40"
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Landmark size={17} />}
            {kobo ? `Withdraw ${naira(kobo)}` : 'Withdraw'}
          </button>
          <p className="text-xs text-white/35">
            Up to {naira(info.daily_kobo)} a day. Withdrawals over {naira(info.approval_kobo)} get a quick check by our team first.
          </p>
        </form>
      ) : null}

      {payouts.length ? (
        <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06] pt-1">
          {payouts.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {p.kind === 'refund' ? 'Refund to ' : ''}
                  {p.account_name}
                </span>
                <span className="block truncate text-xs text-white/40">
                  {p.bank_name} · {p.account_number} · {shortDate(p.created_at)}
                </span>
                {p.failure_reason && ['failed', 'rejected', 'reversed'].includes(p.status) ? (
                  <span className="mt-0.5 block text-xs text-white/40">Back in your wallet: {p.failure_reason}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold">{naira(p.amount_kobo)}</span>
                <PayoutPill status={p.status} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

// MissingPaymentDialog: the customer sent money that hasn't shown up.
export function MissingPaymentDialog({
  orderId,
  amountKobo,
  onClose,
  onFound,
}: {
  orderId?: string;
  amountKobo?: number;
  onClose: () => void;
  onFound?: () => void;
}) {
  const [session, setSession] = useState('');
  const [amount, setAmount] = useState(amountKobo ? String(amountKobo / 100) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await money.report({
        order_id: orderId,
        session_id: session.trim() || undefined,
        amount_kobo: nairaToKobo(Number(amount) || 0) || undefined,
        note: note.trim() || undefined,
      });
      setResult(r);
      if (r.outcome === 'credited') onFound?.();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-title"
        className="max-h-[92vh] w-full overflow-auto rounded-t-2xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] p-6 shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="missing-title" className="text-lg font-bold">
              I paid but nothing came
            </h2>
            <p className="mt-1 text-sm text-white/45">We'll check with the bank right away.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <div
              className={`rounded-xl border p-4 text-sm ${
                result.outcome === 'credited' ? 'border-zener-success/30 bg-zener-success/[0.06]' : 'border-zener-gold/30 bg-zener-gold/[0.06]'
              }`}
            >
              <p className="font-semibold text-white">
                {{ credited: 'Payment found', pending: 'Still confirming', elsewhere: 'Paid to another account', reported: "We're on it" }[result.outcome]}
              </p>
              <p className="mt-1 leading-relaxed text-white/65">{result.message}</p>
            </div>
            <button type="button" onClick={onClose} className="h-12 w-full rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-4">
            <Field label="Session ID" hint="On your bank receipt">
              <input
                value={session}
                onChange={(e) => setSession(e.target.value.replace(/\s/g, ''))}
                placeholder="e.g. 000013261119…"
                className={`${inputCls} font-mono text-sm`}
              />
            </Field>
            <p className="-mt-2 text-xs text-white/35">
              Open the transfer in your banking app and look for "Session ID" or "Transaction reference". It's the fastest way for us to find it.
            </p>
            {!orderId ? (
              <Field label="Amount you sent">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">₦</span>
                  <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" className={`${inputCls} pl-8`} />
                </div>
              </Field>
            ) : null}
            <Field label="What happened?" hint="Optional">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder="e.g. I sent it from Opay at 2:15pm"
                className={`${inputCls} h-auto py-3`}
              />
            </Field>
            {error ? <ErrorBox text={error} /> : null}
            <button
              type="submit"
              disabled={busy || (!session.trim() && !note.trim())}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />} Check my payment
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
