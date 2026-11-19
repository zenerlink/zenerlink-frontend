import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, RotateCcw, Search } from 'lucide-react';
import { OPS_URL, money, nairaToKobo, staff } from '../lib/api';
import type { Bank, Dispute, PaymentForRefund, Payout, ReconItem, ReconRun } from '../lib/api';
import { askConfirm } from './confirm';
import { ErrorBox, Field, PageTitle, Spinner, card, inputCls, message, naira, shortDate } from './kit';
import { BankPicker, PayoutPill } from './money';

// Staff page: money leaving the pool, refunds, the nightly check against the
// bank, and customers' "I paid but nothing came" reports.

export const isStaff = (role: string) => ['tenant_admin', 'tenant_staff', 'platform_admin'].includes(role);

type Tab = 'payouts' | 'refund' | 'recon' | 'disputes';
const TABS: [Tab, string][] = [
  ['payouts', 'Withdrawals'],
  ['refund', 'Refund'],
  ['recon', 'Reconciliation'],
  ['disputes', 'Reports'],
];

const smallBtn = 'h-9 rounded-lg px-3 text-xs font-bold transition disabled:opacity-40';
const goldBtn = `${smallBtn} bg-zener-gold text-black hover:brightness-110`;
const plainBtn = `${smallBtn} border border-white/[0.1] text-white/75 hover:border-white/25 hover:text-white`;

export function StaffPage({ role }: { role: string }) {
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(window.location.search).get('tab') as Tab) || 'payouts');
  const pick = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, '', `/staff?tab=${t}`);
  };
  return (
    <>
      <PageTitle
        title="Staff"
        sub="Withdrawals, refunds, the daily bank check and payment reports."
        action={
          role === 'platform_admin' ? (
            <a
              href={OPS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm font-bold text-white/80 hover:border-zener-gold/50 hover:text-zener-gold"
            >
              Revenue, compliance and feedback <ExternalLink size={14} />
            </a>
          ) : null
        }
      />
      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-xl border border-white/[0.09] bg-white/[0.03] p-1">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => pick(t)}
              className={`h-10 rounded-lg px-4 text-sm font-semibold transition ${tab === t ? 'bg-white/[0.1] text-white shadow-sm' : 'text-white/45 hover:text-white/75'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'payouts' ? <PayoutsTab /> : tab === 'refund' ? <RefundTab /> : tab === 'recon' ? <ReconTab /> : <DisputesTab />}
    </>
  );
}

// NoteAction is a button that asks for a short note before acting.
function NoteAction({
  label,
  placeholder,
  danger,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  danger?: boolean;
  onSubmit: (note: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={danger ? `${plainBtn} hover:!border-zener-danger/50 hover:!text-zener-danger` : plainBtn}>
        {label}
      </button>
    );
  }
  return (
    <form
      className="flex w-full flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) return;
        setBusy(true);
        void onSubmit(note.trim()).finally(() => setBusy(false));
      }}
    >
      <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} className={`${inputCls} h-10 text-sm`} />
      <div className="flex shrink-0 gap-2">
        <button type="submit" disabled={busy || !note.trim()} className={danger ? `${smallBtn} bg-zener-danger text-white hover:brightness-110` : goldBtn}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : label}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={plainBtn}>
          Back
        </button>
      </div>
    </form>
  );
}

function PayoutsTab() {
  const [filter, setFilter] = useState<'review' | ''>('review');
  const [list, setList] = useState<Payout[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    staff
      .payouts(filter)
      .then((r) => setList(r.payouts))
      .catch((e) => setError(message(e)));
  }, [filter]);
  useEffect(() => {
    setList(null);
    load();
  }, [load]);

  const act = async (p: Payout, action: 'approve' | 'reject' | 'mark_paid' | 'mark_failed', note = '') => {
    setError('');
    try {
      await staff.decide(p.id, action, note);
      load();
    } catch (e) {
      setError(message(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['review', 'Needs a decision'],
            ['', 'All'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setFilter(v)} className={filter === v ? goldBtn : plainBtn}>
            {label}
          </button>
        ))}
      </div>
      {error ? <ErrorBox text={error} /> : null}
      {list === null ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className={`${card} px-6 py-10 text-center text-sm text-white/45`}>{filter ? 'Nothing waiting for a decision.' : 'No withdrawals yet.'}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((p) => (
            <li key={p.id} className={`${card} space-y-3 p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-black">{naira(p.amount_kobo)}</p>
                  <p className="truncate text-sm text-white/70">
                    {p.kind === 'refund' ? 'Refund' : 'Withdrawal'} by {p.customer_name || p.customer_email}
                    <span className="text-white/35"> · {p.customer_email}</span>
                  </p>
                </div>
                <PayoutPill status={p.status} />
              </div>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <Row label="To" value={p.account_name} />
                <Row label="Account" value={`${p.bank_name || p.bank_code} · ${p.account_number}`} />
                <Row label="Requested" value={shortDate(p.created_at)} />
                <Row label="Reference" value={p.reference} mono />
                {p.payment_reference ? <Row label="Payment refunded" value={p.payment_reference} mono /> : null}
                {p.note ? <Row label="Note" value={p.note} /> : null}
              </dl>
              {p.review_reason && p.status === 'review' ? <p className="rounded-lg bg-zener-gold/[0.08] px-3 py-2 text-xs text-zener-gold">{p.review_reason}</p> : null}
              {p.failure_reason ? <p className="text-xs text-white/45">Reason: {p.failure_reason}</p> : null}
              {p.status === 'review' ? (
                <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
                  {p.attempts === 0 ? (
                    <>
                      <button
                        type="button"
                        className={goldBtn}
                        onClick={async () => {
                          if (await askConfirm({ title: `Send ${naira(p.amount_kobo)} to ${p.account_name}?`, message: `${p.bank_name} · ${p.account_number}`, confirmLabel: 'Approve and send' }))
                            await act(p, 'approve');
                        }}
                      >
                        Approve and send
                      </button>
                      <NoteAction label="Reject" danger placeholder="Why? The customer sees this" onSubmit={(n) => act(p, 'reject', n)} />
                    </>
                  ) : (
                    <>
                      <NoteAction label="Mark as paid" placeholder="What the Payrep dashboard shows" onSubmit={(n) => act(p, 'mark_paid', n)} />
                      <NoteAction label="Mark failed and refund wallet" danger placeholder="What the Payrep dashboard shows" onSubmit={(n) => act(p, 'mark_failed', n)} />
                    </>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 sm:justify-start">
      <dt className="shrink-0 text-white/40">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-white/85 sm:text-left ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</dd>
    </div>
  );
}

function RefundTab() {
  const [ref, setRef] = useState('');
  const [pay, setPay] = useState<PaymentForRefund | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [other, setOther] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bank, setBank] = useState('');
  const [acct, setAcct] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Payout | null>(null);
  const idemKey = useRef(crypto.randomUUID());

  const find = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ref.trim()) return;
    setLoading(true);
    setError('');
    setPay(null);
    setSent(null);
    try {
      const p = await staff.payment(ref.trim());
      setPay(p);
      setAmount(p.refundable_kobo ? String(p.refundable_kobo / 100) : '');
      setOther(!p.sender_account);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (other && !banks.length) money.banks().then((r) => setBanks(r.banks)).catch(() => undefined);
  }, [other, banks.length]);

  const kobo = nairaToKobo(Number(amount) || 0);
  const refund = async () => {
    if (!pay) return;
    const to = other ? `account ${acct}` : `${pay.sender_name || 'the sender'} (${pay.sender_bank} · ${pay.sender_account})`;
    if (!(await askConfirm({ title: `Refund ${naira(kobo)}?`, message: `It goes to ${to} and comes out of ${pay.customer_name || pay.customer_email}'s wallet.`, confirmLabel: 'Send refund' })))
      return;
    setBusy(true);
    setError('');
    try {
      const p = await staff.refund(
        pay.reference,
        { amount_kobo: kobo, note: note.trim(), ...(other ? { bank_code: bank, account_number: acct } : {}) },
        idemKey.current,
      );
      idemKey.current = crypto.randomUUID();
      setSent(p);
      void find();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={(e) => void find(e)} className={`${card} space-y-3 p-5`}>
        <Field label="Payment" hint="Payment reference, order ID or the bank session ID">
          <div className="flex gap-2">
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="prc_… or order ID" className={`${inputCls} font-mono text-sm`} />
            <button type="submit" disabled={loading || !ref.trim()} className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-zener-gold px-4 text-sm font-bold text-black disabled:opacity-40">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Find
            </button>
          </div>
        </Field>
      </form>
      {error ? <ErrorBox text={error} /> : null}
      {sent ? (
        <p className="flex items-center gap-2 rounded-xl border border-zener-success/30 bg-zener-success/[0.06] px-4 py-3 text-sm">
          <Check size={16} className="text-zener-success" /> Refund of {naira(sent.amount_kobo)} to {sent.account_name} is on its way. Track it under Withdrawals.
        </p>
      ) : null}
      {pay ? (
        <section className={`${card} space-y-4 p-5`}>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Row label="Customer" value={`${pay.customer_name} · ${pay.customer_email}`} />
            <Row label="Paid" value={`${naira(pay.amount_kobo)} · ${shortDate(pay.created_at)}`} />
            <Row label="For" value={pay.purpose === 'wallet_fund' ? 'Wallet funding' : `Order (${pay.order_status?.replace(/_/g, ' ') || 'unknown'})`} />
            <Row label="Status" value={pay.status} />
            <Row label="Sender" value={pay.sender_name ? `${pay.sender_name} · ${pay.sender_bank} ${pay.sender_account}` : 'Not recorded'} />
            <Row label="Wallet now" value={naira(pay.wallet_kobo)} />
          </dl>
          {pay.refundable_note ? <p className="rounded-lg bg-zener-gold/[0.08] px-3 py-2 text-xs text-zener-gold">{pay.refundable_note}</p> : null}
          {pay.refundable_kobo > 0 ? (
            <div className="space-y-4 border-t border-white/[0.06] pt-4">
              <Field label="Amount to refund" hint={`Up to ${naira(pay.refundable_kobo)}`}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">₦</span>
                  <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} className={`${inputCls} pl-8`} />
                </div>
              </Field>
              {pay.sender_account ? (
                <label className="flex items-center gap-2 text-sm text-white/60">
                  <input type="checkbox" checked={other} onChange={(e) => setOther(e.target.checked)} className="accent-[rgb(var(--zener-gold))]" />
                  Send to a different account
                </label>
              ) : null}
              {other ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <BankPicker banks={banks} value={bank} onChange={(b) => setBank(b.code)} />
                  <input
                    inputMode="numeric"
                    value={acct}
                    onChange={(e) => setAcct(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit account number"
                    className={`${inputCls} font-mono`}
                  />
                </div>
              ) : null}
              <Field label="Why">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid twice by mistake" className={inputCls} />
              </Field>
              <button
                type="button"
                onClick={() => void refund()}
                disabled={busy || kobo <= 0 || kobo > pay.refundable_kobo || !note.trim() || (other && (!bank || acct.length !== 10))}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Refund {kobo ? naira(kobo) : ''}
              </button>
            </div>
          ) : null}
          {pay.refunds.length ? (
            <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
              {pay.refunds.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    {naira(r.amount_kobo)} to {r.account_name} <span className="text-white/35">· {shortDate(r.created_at)}</span>
                  </span>
                  <PayoutPill status={r.status} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

const RECON_KIND: Record<string, string> = {
  credit_recovered: 'Missed deposit, now credited',
  credit_unmatched: 'Deposit we couldn’t match',
  credit_amount_mismatch: 'Deposit amount differs',
  credit_missing_at_bank: 'Credit the bank doesn’t show',
  debit_unknown: 'Payout under our reference we don’t know',
  debit_but_refunded: 'Paid out but refunded to customer',
  debit_unsettled: 'Paid out but still open here',
  debit_amount_mismatch: 'Payout amount differs',
  debit_missing_at_bank: 'Payout the bank doesn’t show',
};

const yesterday = () => {
  const d = new Date(Date.now() - 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
};

function ReconTab() {
  const [data, setData] = useState<{ runs: ReconRun[]; items: ReconItem[] } | null>(null);
  const [filter, setFilter] = useState<'open' | ''>('open');
  const [day, setDay] = useState(yesterday);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    staff
      .recon(filter)
      .then(setData)
      .catch((e) => setError(message(e)));
  }, [filter]);
  useEffect(() => load(), [load]);

  const run = async () => {
    setRunning(true);
    setError('');
    try {
      await staff.runRecon(day);
      load();
    } catch (e) {
      setError(message(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className={`${card} space-y-4 p-5`}>
        <div>
          <h2 className="text-base font-bold">Daily bank check</h2>
          <p className="mt-1 text-sm text-white/45">Every night we compare the bank's transactions with ours. Missed deposits are credited automatically; anything else lands below.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input type="date" value={day} max={new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })} onChange={(e) => setDay(e.target.value)} className={`${inputCls} sm:w-56`} />
          <button type="button" onClick={() => void run()} disabled={running || !day} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-zener-gold px-5 text-sm font-bold text-black disabled:opacity-40">
            {running ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Check this day now
          </button>
        </div>
        {data?.runs.length ? (
          <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06] text-sm">
            {data.runs.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-semibold">{r.day}</span>
                <span className="text-white/50">
                  {r.status === 'failed'
                    ? `Failed: ${r.error}`
                    : r.status === 'running'
                      ? 'Running…'
                      : `${r.bank_count} at the bank · ${r.matched} matched · ${r.recovered} recovered · ${r.issues} to check`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <div className="flex gap-2">
        {(
          [
            ['open', 'To check'],
            ['', 'All'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setFilter(v)} className={filter === v ? goldBtn : plainBtn}>
            {label}
          </button>
        ))}
      </div>
      {error ? <ErrorBox text={error} /> : null}
      {data === null ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <p className={`${card} px-6 py-10 text-center text-sm text-white/45`}>{filter ? 'Everything matches. Nothing to check.' : 'No differences found yet.'}</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((it) => (
            <li key={it.id} className={`${card} space-y-2 p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-bold">{RECON_KIND[it.kind] ?? it.kind.replace(/_/g, ' ')}</p>
                <span className="text-sm font-bold">{naira(it.amount_kobo)}</span>
              </div>
              <p className="text-sm text-white/60">{it.detail}</p>
              <p className="truncate font-mono text-xs text-white/35">
                {it.day} · {it.reference}
              </p>
              {it.status === 'open' ? (
                <div className="pt-1">
                  <NoteAction
                    label="Mark resolved"
                    placeholder="What you found and did"
                    onSubmit={async (n) => {
                      try {
                        await staff.resolveRecon(it.id, n);
                        load();
                      } catch (e) {
                        setError(message(e));
                      }
                    }}
                  />
                </div>
              ) : (
                <p className="text-xs text-white/45">
                  {it.status === 'recovered' ? 'Credited automatically.' : `Resolved: ${it.note}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DisputesTab() {
  const [filter, setFilter] = useState<'open' | ''>('open');
  const [list, setList] = useState<Dispute[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    staff
      .disputes(filter)
      .then((r) => setList(r.disputes))
      .catch((e) => setError(message(e)));
  }, [filter]);
  useEffect(() => load(), [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ['open', 'Open'],
            ['', 'All'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setFilter(v)} className={filter === v ? goldBtn : plainBtn}>
            {label}
          </button>
        ))}
      </div>
      {error ? <ErrorBox text={error} /> : null}
      {list === null ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className={`${card} px-6 py-10 text-center text-sm text-white/45`}>No payment reports{filter ? ' open' : ''}.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((d) => (
            <li key={d.id} className={`${card} space-y-3 p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-black">{naira(d.amount_kobo)}</p>
                  <p className="truncate text-sm text-white/70">
                    {d.customer_name} <span className="text-white/35">· {d.customer_email}</span>
                  </p>
                </div>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${d.status === 'open' ? 'bg-zener-gold/15 text-zener-gold' : 'bg-zener-success/15 text-zener-success'}`}
                >
                  {d.status === 'open' ? 'Open' : 'Resolved'}
                </span>
              </div>
              <p className="text-sm text-white/60">{d.description}</p>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <Row label="Session ID" value={d.session_id} mono />
                <Row label="Reported" value={shortDate(d.created_at)} />
                <Row label="Bank case" value={d.provider_reference ? `${d.provider_reference}${d.provider_status ? ` · ${d.provider_status}` : ''}` : d.provider_message || 'Not opened'} />
                {d.order_id ? <Row label="Order" value={d.order_id} mono /> : null}
              </dl>
              {d.status === 'open' ? (
                <NoteAction
                  label="Resolve"
                  placeholder="What was done; the customer sees this"
                  onSubmit={async (n) => {
                    try {
                      await staff.resolveDispute(d.id, n);
                      load();
                    } catch (e) {
                      setError(message(e));
                    }
                  }}
                />
              ) : (
                <p className="text-xs text-white/45">Resolved: {d.resolution}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
