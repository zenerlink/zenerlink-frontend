import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Gift, Loader2, Mail, Plus, Share2, X, Zap } from 'lucide-react';
import { ApiError, api, guest, koboToNaira, nairaToKobo, units } from '../lib/api';
import type { ApiMeter, Disco, UnitGift, UnitsSummary } from '../lib/api';
import { useBrand } from '../lib/brand';
import logo from '../assets/logo-icon-white.svg';
import { askConfirm } from './confirm';
import { DiscoLogo, DiscoPicker, ErrorBox, Field, PageTitle, Spinner, card, estimateKwh, formatKwh, inputCls, message, naira, shortDate } from './kit';
import { giftLink } from './links';
import type { Nav } from './links';
import { brandedQrUrl } from './qr';

// Saved units: electricity kept in the app. Load some to a meter when you
// need it (a fresh token), or send some to anyone with a link or QR code.

type Props = { nav: Nav; walletKobo: number | null; refreshWallet: () => void };
type Action = 'load' | 'send' | 'add';

const primaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-40';

function AmountInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">₦</span>
      <input
        autoFocus={autoFocus}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        placeholder="0"
        className={`${inputCls} pl-8`}
      />
    </div>
  );
}

export function UnitsPage({ nav, walletKobo, refreshWallet }: Props) {
  const q = new URLSearchParams(window.location.search);
  const [data, setData] = useState<UnitsSummary | null>(null);
  const [discos, setDiscos] = useState<Disco[]>([]);
  const [meters, setMeters] = useState<ApiMeter[]>([]);
  const [error, setError] = useState('');
  const [action, setAction] = useState<Action>(q.get('send') ? 'send' : q.get('load') ? 'load' : 'load');
  const [showing, setShowing] = useState<UnitGift | null>(null);

  const load = useCallback(() => {
    units
      .get()
      .then(setData)
      .catch((e) => setError(message(e)));
  }, []);
  useEffect(() => {
    load();
    guest
      .discos()
      .then((r) => setDiscos(r.discos))
      .catch(() => undefined);
    api
      .meters()
      .then((r) => setMeters(r.meters.filter((m) => m.provider_code !== 'ZIEON' && m.status === 'active')))
      .catch(() => undefined);
  }, [load]);

  // kWh are shown at the rate of the customer's own DisCo (their first saved meter).
  const home = discos.find((d) => d.provider_code === (q.get('disco') || meters[0]?.provider_code)) ?? discos[0];
  const kwhOf = (kobo: number) => (home ? estimateKwh(home, koboToNaira(kobo)) : 0);
  const refresh = () => {
    load();
    refreshWallet();
  };

  if (error && !data) return <ErrorBox text={error} />;
  if (!data) return <Spinner />;
  const balance = data.balance_kobo;

  return (
    <>
      <PageTitle title="Saved units" sub="Keep electricity in the app. Load it to a meter when you need it, or send some to anyone." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className={`${card} p-6`}>
            <p className="text-sm font-semibold text-white/50">Saved units</p>
            <p className="mt-2 text-4xl font-black tracking-tight text-zener-gold sm:text-5xl">{home && balance ? formatKwh(kwhOf(balance)) : naira(balance)}</p>
            <p className="mt-1 text-sm text-white/45">
              {home && balance ? `${naira(balance)} · about, at ${home.provider_name} rates` : 'Add units from your wallet to get started.'}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-1 rounded-xl border border-white/[0.09] bg-white/[0.03] p-1">
              {(
                [
                  ['load', 'Load to meter'],
                  ['send', 'Send'],
                  ['add', 'Add units'],
                ] as [Action, string][]
              ).map(([a, label]) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAction(a)}
                  className={`h-10 rounded-lg text-sm font-semibold transition ${action === a ? 'bg-white/[0.1] text-white shadow-sm' : 'text-white/45 hover:text-white/75'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-6">
              {action === 'add' ? (
                <AddUnits data={data} walletKobo={walletKobo} kwhOf={kwhOf} onDone={refresh} nav={nav} />
              ) : action === 'load' ? (
                <LoadUnits data={data} meters={meters} discos={discos} nav={nav} onAdd={() => setAction('add')} />
              ) : (
                <SendUnits
                  data={data}
                  walletKobo={walletKobo}
                  home={home}
                  kwhOf={kwhOf}
                  initialKobo={Number(q.get('send')) || 0}
                  onSent={(g) => {
                    refresh();
                    setShowing(g);
                  }}
                />
              )}
            </div>
          </section>

          {data.entries.length ? (
            <section className={`${card} overflow-hidden`}>
              <h2 className="px-6 pt-6 text-base font-bold">History</h2>
              <ul className="mt-2 divide-y divide-white/[0.06]">
                {data.entries.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-6 py-3.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{e.title}</span>
                      <span className="block text-xs text-white/40">{shortDate(e.created_at)}</span>
                    </span>
                    <span className={`shrink-0 text-sm font-bold ${e.amount_kobo > 0 ? 'text-zener-success' : 'text-white/80'}`}>
                      {e.amount_kobo > 0 ? '+' : '−'}
                      {naira(Math.abs(e.amount_kobo))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <section className={`${card} p-5`}>
            <h2 className="text-base font-bold">How it works</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-white/55">
              <li className="flex gap-2.5"><Plus size={16} className="mt-0.5 shrink-0 text-zener-gold" /> Add units from your wallet. They don't expire.</li>
              <li className="flex gap-2.5"><Zap size={16} className="mt-0.5 shrink-0 text-zener-gold" /> Load any amount to a meter: you get a fresh token straight away.</li>
              <li className="flex gap-2.5"><Gift size={16} className="mt-0.5 shrink-0 text-zener-gold" /> Send units by link or QR. They load them to their own meter. Unclaimed gifts come back after 30 days.</li>
            </ul>
          </section>

          {data.gifts.length ? (
            <section className={`${card} p-5`}>
              <h2 className="text-base font-bold">Sent</h2>
              <ul className="mt-2 divide-y divide-white/[0.06]">
                {data.gifts.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{naira(g.amount_kobo)}</span>
                      <span className="block truncate text-xs text-white/40">
                        {g.status === 'claimed'
                          ? `Claimed${g.claimed_by_name ? ` by ${g.claimed_by_name}` : ''}`
                          : g.status === 'open'
                            ? `Waiting · ${g.recipient_email || shortDate(g.created_at)}`
                            : g.status === 'expired'
                              ? 'Expired, returned to you'
                              : 'Cancelled, returned to you'}
                      </span>
                    </span>
                    {g.status === 'open' ? (
                      <span className="flex shrink-0 gap-1.5">
                        <button type="button" onClick={() => setShowing(g)} className="h-8 rounded-lg border border-white/[0.1] px-3 text-xs font-bold hover:border-zener-gold/50 hover:text-zener-gold">
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              await askConfirm({
                                title: 'Cancel this gift?',
                                message: `${naira(g.amount_kobo + g.fee_kobo)} goes back to your saved units, and the link stops working.`,
                                confirmLabel: 'Cancel gift',
                                cancelLabel: 'Keep it',
                                danger: true,
                              })
                            )
                              units
                                .cancel(g.code)
                                .then(refresh)
                                .catch((e) => setError(message(e)));
                          }}
                          className="h-8 rounded-lg px-2 text-xs font-bold text-white/45 hover:text-zener-danger"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {error ? <ErrorBox text={error} /> : null}
        </div>
      </div>
      {showing ? <GiftDialog gift={showing} onClose={() => setShowing(null)} /> : null}
    </>
  );
}

function AddUnits({ data, walletKobo, kwhOf, onDone, nav }: { data: UnitsSummary; walletKobo: number | null; kwhOf: (k: number) => number; onDone: () => void; nav: Nav }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const idemKey = useRef(crypto.randomUUID());
  const kobo = nairaToKobo(Number(amount) || 0);
  const short = walletKobo !== null && kobo > walletKobo;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await units.save(kobo, idemKey.current);
      idemKey.current = crypto.randomUUID();
      setDone(`${naira(kobo)} added to your saved units.`);
      setAmount('');
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) idemKey.current = crypto.randomUUID();
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <Field label="Amount from your wallet" hint={walletKobo === null ? undefined : `Wallet: ${naira(walletKobo)}`}>
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      {kobo && kwhOf(kobo) ? <p className="-mt-2 text-sm text-white/50">About {formatKwh(kwhOf(kobo))}</p> : null}
      {short ? (
        <p className="text-sm text-zener-danger">
          Your wallet has {naira(walletKobo ?? 0)}.{' '}
          <button type="button" onClick={() => nav('/wallet')} className="font-semibold underline">
            Fund wallet
          </button>
        </p>
      ) : null}
      {error ? <ErrorBox text={error} /> : null}
      {done ? <p className="flex items-center gap-2 text-sm text-zener-success"><Check size={16} /> {done}</p> : null}
      <button type="submit" disabled={busy || kobo < data.min_kobo || kobo > data.max_kobo || short} className={primaryBtn}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Add {kobo ? naira(kobo) : 'units'}
      </button>
      <p className="text-xs text-white/35">Between {naira(data.min_kobo)} and {naira(data.max_kobo)} at a time.</p>
    </form>
  );
}

function LoadUnits({ data, meters, discos, nav, onAdd }: { data: UnitsSummary; meters: ApiMeter[]; discos: Disco[]; nav: Nav; onAdd: () => void }) {
  const [meterId, setMeterId] = useState('');
  const [other, setOther] = useState(false);
  const [disco, setDisco] = useState('');
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const idemKey = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!meterId && meters.length) setMeterId(meters[0].id);
    if (!meters.length) setOther(true);
  }, [meters, meterId]);
  const m = other ? undefined : meters.find((x) => x.id === meterId);
  const code = m?.provider_code ?? disco;
  const d = discos.find((x) => x.provider_code === code);
  const kobo = nairaToKobo(Number(amount) || 0);
  const kwh = d ? estimateKwh(d, Number(amount) || 0) : 0;
  const ready = !!code && (m || number.length >= 6) && kobo > 0 && kobo <= data.balance_kobo && !busy;

  if (data.balance_kobo <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.12] p-6 text-center">
        <p className="text-sm text-white/50">You have no saved units yet.</p>
        <button type="button" onClick={onAdd} className="mt-4 h-10 rounded-lg bg-zener-gold px-5 text-sm font-bold text-black hover:brightness-110">
          Add units
        </button>
      </div>
    );
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      const o = await units.load(
        { provider_code: code, meter_number: m?.meter_number ?? number, meter_type: m?.meter_type ?? 'prepaid', amount_kobo: kobo },
        idemKey.current,
      );
      nav(`/order/${o.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) idemKey.current = crypto.randomUUID();
      setError(message(err));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <Field label="Meter">
        {meters.length && !other ? (
          <div className="space-y-2">
            {meters.slice(0, 5).map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setMeterId(x.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                  meterId === x.id ? 'border-zener-gold/60 bg-zener-gold/[0.06]' : 'border-white/[0.09] hover:border-white/20'
                }`}
              >
                <DiscoLogo disco={{ provider_code: x.provider_code, logo_url: '' } as Disco} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{x.label || x.customer_name || x.meter_number}</span>
                  <span className="block truncate font-mono text-xs text-white/40">{x.meter_number}</span>
                </span>
                {meterId === x.id ? <Check size={16} className="shrink-0 text-zener-gold" /> : null}
              </button>
            ))}
            <button type="button" onClick={() => setOther(true)} className="text-xs font-semibold text-white/45 hover:text-white">
              Load to another meter
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <DiscoPicker discos={discos} value={disco} onChange={setDisco} />
            <input
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 13))}
              placeholder="Meter number"
              className={`${inputCls} font-mono tracking-wider`}
            />
            {meters.length ? (
              <button type="button" onClick={() => setOther(false)} className="text-xs font-semibold text-white/45 hover:text-white">
                Use a saved meter
              </button>
            ) : null}
          </div>
        )}
      </Field>
      <Field label="Amount" hint={`Saved: ${naira(data.balance_kobo)}`}>
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <div className="-mt-2 flex items-center justify-between text-sm">
        <span className="text-white/50">{kwh ? `About ${formatKwh(kwh)}` : ''}</span>
        <button type="button" onClick={() => setAmount(String(koboToNaira(data.balance_kobo)))} className="text-xs font-semibold text-zener-gold hover:underline">
          Use all
        </button>
      </div>
      {kobo > data.balance_kobo ? <p className="text-sm text-zener-danger">You have {naira(data.balance_kobo)} saved.</p> : null}
      {error ? <ErrorBox text={error} /> : null}
      <button type="submit" disabled={!ready} className={primaryBtn}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Zap size={17} />} Get a token{kobo ? ` for ${naira(kobo)}` : ''}
      </button>
    </form>
  );
}

function SendUnits({
  data,
  walletKobo,
  home,
  kwhOf,
  initialKobo,
  onSent,
}: {
  data: UnitsSummary;
  walletKobo: number | null;
  home?: Disco;
  kwhOf: (k: number) => number;
  initialKobo: number;
  onSent: (g: UnitGift) => void;
}) {
  const [amount, setAmount] = useState(initialKobo ? String(koboToNaira(initialKobo)) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const idemKey = useRef(crypto.randomUUID());
  const kobo = nairaToKobo(Number(amount) || 0);
  const fee = data.gift_fee_kobo;
  const total = kobo + fee;
  // Saved units pay when they can; otherwise the wallet.
  const from: 'units' | 'wallet' | null = data.balance_kobo >= total ? 'units' : (walletKobo ?? 0) >= total ? 'wallet' : null;
  const ready = kobo >= data.min_kobo && kobo <= data.max_kobo && !!from && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !from) return;
    const ok = await askConfirm({
      title: `Send ${naira(kobo)} of electricity?`,
      message: `${naira(total)} comes from your ${from === 'units' ? 'saved units' : 'wallet'}${fee ? `, including the ${naira(fee)} sending fee` : ''}. You'll get a link and QR code to share. If nobody claims it in 30 days, it all comes back.`,
      confirmLabel: 'Send',
      cancelLabel: 'Go back',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const g = await units.send({ amount_kobo: kobo, note: note.trim() || undefined, provider_code: home?.provider_code, from }, idemKey.current);
      idemKey.current = crypto.randomUUID();
      setAmount('');
      setNote('');
      onSent(g);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) idemKey.current = crypto.randomUUID();
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <Field label="Amount to send">
        <AmountInput value={amount} onChange={setAmount} autoFocus={!!initialKobo} />
      </Field>
      {kobo && kwhOf(kobo) ? (
        <p className="-mt-2 text-sm text-white/50">
          About {formatKwh(kwhOf(kobo))} at {home?.provider_name} rates. They get the naira value, so kWh can differ a little on their DisCo.
        </p>
      ) : null}
      <Field label="Note" hint="Optional">
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} placeholder="e.g. Light for this week" className={inputCls} />
      </Field>
      {kobo ? (
        <dl className="space-y-1.5 rounded-xl bg-white/[0.03] p-4 text-sm">
          <div className="flex justify-between"><dt className="text-white/45">Electricity</dt><dd>{naira(kobo)}</dd></div>
          {fee ? <div className="flex justify-between"><dt className="text-white/45">Sending fee</dt><dd>{naira(fee)}</dd></div> : null}
          <div className="flex justify-between border-t border-white/[0.08] pt-1.5 font-bold"><dt>Total</dt><dd>{naira(total)}</dd></div>
          <p className="pt-1 text-xs text-white/40">
            {from === 'units' ? 'From your saved units' : from === 'wallet' ? 'From your wallet' : 'Not enough in your saved units or wallet'}
          </p>
        </dl>
      ) : null}
      {error ? <ErrorBox text={error} /> : null}
      <button type="submit" disabled={!ready} className={primaryBtn}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Gift size={17} />} Send electricity
      </button>
    </form>
  );
}

function GiftDialog({ gift, onClose }: { gift: UnitGift; onClose: () => void }) {
  const brand = useBrand();
  const link = giftLink(gift.code);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState(gift.recipient_email ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);
  const text = `I've sent you ${naira(gift.amount_kobo)} of electricity on ${brand.display_name}. Claim it and load it to your meter:`;

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
        const file = new File([await (await fetch(qr)).blob()], `electricity-${gift.code}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text: `${text}\n${link}` });
      }
      if (navigator.share) return await navigator.share({ title: 'Electricity for you', text, url: link });
      copy();
    } catch {
      /* share sheet closed */
    }
  };
  const email = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSent(null);
    try {
      const r = await units.email(gift.code, to);
      setSent({ ok: true, text: `Sent to ${r.sent_to}` });
    } catch (err) {
      setSent({ ok: false, text: message(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Electricity gift" className="max-h-[94vh] w-full max-w-sm overflow-auto rounded-2xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Electricity to share</h2>
            <p className="truncate text-sm text-white/45">
              {naira(gift.amount_kobo)}
              {gift.energy_kwh ? ` · about ${formatKwh(gift.energy_kwh)}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/45 hover:bg-white/[0.06] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="mx-auto mt-5 grid aspect-square w-full max-w-[260px] place-items-center rounded-xl bg-white p-3">
          {qr ? <img src={qr} alt="QR code to claim this electricity" className="h-full w-full" /> : <Loader2 className="animate-spin text-black/40" />}
        </div>
        <p className="mt-4 text-center text-sm text-white/55">
          They scan this in {brand.display_name} or with their phone camera, claim it, and load it to their own meter. It works once; unclaimed, it comes back to
          you on {shortDate(gift.expires_at).split(',')[0]}.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void share()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110">
            <Share2 size={16} /> Share
          </button>
          <button type="button" onClick={copy} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold hover:bg-white/[0.12]">
            {copied ? <Check size={16} className="text-zener-success" /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <form className="mt-4 border-t border-white/[0.08] pt-4" onSubmit={(e) => void email(e)}>
          <label className="mb-2 block text-sm font-medium text-white/70">Or send it by email</label>
          <div className="flex gap-2">
            <input type="email" inputMode="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="their@email.com" className={`${inputCls} min-w-0 flex-1`} />
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
      </div>
    </div>
  );
}

// GiftPage is where a gift link lands: the recipient claims it here.
export function GiftPage({ code, nav }: { code: string; nav: Nav }) {
  const brand = useBrand();
  const [gift, setGift] = useState<UnitGift | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    units
      .gift(code)
      .then(setGift)
      .catch((e) => setError(message(e)));
  }, [code]);

  if (error && !gift) return <ErrorBox text={error} />;
  if (!gift) return <Spinner />;
  const claim = async () => {
    setBusy(true);
    setError('');
    try {
      setGift(await units.claim(code));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const sender = gift.sender_name || 'Someone';

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className={`${card} p-6 text-center`}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-zener-gold/15 text-zener-gold">
          <Gift size={26} />
        </span>
        <p className="mt-4 text-sm text-white/50">{gift.mine ? 'You sent' : `${sender} sent you`}</p>
        <p className="mt-1 text-4xl font-black tracking-tight text-zener-gold">{naira(gift.amount_kobo)}</p>
        <p className="mt-1 text-sm text-white/45">of electricity{gift.energy_kwh ? `, about ${formatKwh(gift.energy_kwh)}` : ''}</p>
        {gift.note ? <p className="mt-4 rounded-xl bg-white/[0.04] px-4 py-3 text-sm italic text-white/70">“{gift.note}”</p> : null}
      </div>

      {gift.mine ? (
        gift.status === 'open' ? (
          <button type="button" onClick={() => setShowing(true)} className={primaryBtn}>
            <Share2 size={17} /> Share it
          </button>
        ) : (
          <p className="text-center text-sm text-white/50">
            {gift.status === 'claimed' ? `Claimed${gift.claimed_by_name ? ` by ${gift.claimed_by_name}` : ''}.` : 'This gift was returned to your saved units.'}
          </p>
        )
      ) : gift.claimed_by_me ? (
        <div className="space-y-3">
          <p className="flex items-center justify-center gap-2 text-sm text-zener-success">
            <Check size={16} /> It's in your saved units.
          </p>
          <button type="button" onClick={() => nav('/units?load=1')} className={primaryBtn}>
            <Zap size={17} /> Load it to my meter
          </button>
        </div>
      ) : gift.status === 'open' ? (
        <div className="space-y-3">
          <button type="button" onClick={() => void claim()} disabled={busy} className={primaryBtn}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Gift size={17} />} Claim electricity
          </button>
          <p className="text-center text-xs text-white/40">
            It goes into your {brand.display_name} saved units. Load it to your own meter whenever you like.
          </p>
        </div>
      ) : (
        <p className="text-center text-sm text-white/50">{gift.status === 'claimed' ? 'This gift has already been claimed.' : 'This gift is no longer available.'}</p>
      )}
      {error ? <ErrorBox text={error} /> : null}
      {showing ? <GiftDialog gift={gift} onClose={() => setShowing(false)} /> : null}
    </div>
  );
}
