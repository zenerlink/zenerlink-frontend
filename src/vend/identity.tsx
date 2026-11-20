import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, ShieldCheck } from 'lucide-react';
import { kyc } from '../lib/api';
import type { KYCStatus } from '../lib/api';
import { ErrorBox, Field, card, inputCls, message, naira } from './kit';

// Identity check: a BVN or NIN with the date of birth. Raises the account
// to "Verified", which allows bank withdrawals and higher limits. Shown only
// once identity checks are switched on.

const limitText = (kobo: number) => (kobo ? `${naira(kobo)} a day` : 'Not allowed');

export function IdentityCard() {
  const [st, setSt] = useState<KYCStatus | null>(null);
  const [kind, setKind] = useState<'bvn' | 'nin'>('bvn');
  const [number, setNumber] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    kyc
      .status()
      .then(setSt)
      .catch(() => undefined);
  }, []);
  if (!st || !st.available) return null;

  const digits = number.replace(/\D/g, '');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setSt(await kyc.verify(kind, digits, dob));
      setDone(true);
      setNumber('');
    } catch (err) {
      setError(message(err));
      kyc
        .status()
        .then(setSt)
        .catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  if (st.tier >= 2) {
    return (
      <section id="identity" className={`${card} space-y-3 p-6`}>
        <div className="flex items-center gap-2">
          <BadgeCheck size={18} className="text-zener-success" />
          <h2 className="text-base font-bold">Identity verified</h2>
        </div>
        {done ? <p className="text-sm text-zener-success">Thanks, you're verified. Your limits are higher now.</p> : null}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-white/45">Withdraw to bank</dt>
            <dd className="font-semibold">{limitText(st.limits.withdraw_daily_kobo)}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-white/45">Send electricity</dt>
            <dd className="font-semibold">{limitText(st.limits.gift_daily_kobo)}</dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section id="identity" className={`${card} space-y-4 p-6`}>
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-zener-gold" />
          <h2 className="text-base font-bold">Verify your identity</h2>
        </div>
        <p className="mt-1 text-sm text-white/45">
          Needed to withdraw to a bank and to send more electricity. We check your BVN or NIN with your bank's records once, and don't store the number.
        </p>
      </div>
      {st.next ? (
        <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-white/65">
          After verifying: withdraw up to <span className="font-semibold text-white">{naira(st.next.withdraw_daily_kobo)}</span> a day, send up to{' '}
          <span className="font-semibold text-white">{naira(st.next.gift_daily_kobo)}</span> of electricity a day.
        </p>
      ) : null}
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.09] bg-white/[0.03] p-1">
          {(
            [
              ['bvn', 'BVN'],
              ['nin', 'NIN'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`h-10 rounded-lg text-sm font-semibold transition ${kind === k ? 'bg-white/[0.1] text-white shadow-sm' : 'text-white/45 hover:text-white/75'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label={kind === 'bvn' ? 'BVN' : 'NIN'} hint={kind === 'bvn' ? 'Dial *565*0# to get it' : 'Dial *346# to get it'}>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^\d ]/g, '').slice(0, 14))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="11 digits"
            className={`${inputCls} font-mono tracking-wider`}
          />
        </Field>
        <Field label="Date of birth">
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className={inputCls} />
        </Field>
        {error ? <ErrorBox text={error} /> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || digits.length !== 11 || !dob || st.attempts_left === 0}
            className="flex h-11 items-center gap-2 rounded-xl bg-zener-gold px-5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Verify
          </button>
          <span className="text-xs text-white/40">
            {st.attempts_left === 0 ? 'No tries left today. Try again tomorrow.' : `${st.attempts_left} ${st.attempts_left === 1 ? 'try' : 'tries'} left today`}
          </span>
        </div>
        <p className="text-xs text-white/35">The name on your profile must match the name on your {kind === 'bvn' ? 'BVN' : 'NIN'}.</p>
      </form>
    </section>
  );
}
