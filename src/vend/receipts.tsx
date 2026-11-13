import { useEffect, useState } from 'react';
import { ArrowDownToLine, Check, Copy, FileText, Loader2, Share2, X } from 'lucide-react';
import { ApiError, account, guest, koboToNaira } from '../lib/api';
import type { GuestOrder, SharedToken, Statement } from '../lib/api';
import { useBrand } from '../lib/brand';
import { formatCurrency } from '../lib/format';
import logo from '../assets/logo-icon-white.svg';
import { brandedQrUrl } from './qr';
import { href } from './links';

// Receipts, one-time token QR links and account statements.

const naira = (kobo: number) => formatCurrency(koboToNaira(kobo));
const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Network error. Check your connection and try again.');
const grouped = (t: string) => t.replace(/(\d{4})(?=\d)/g, '$1 ');
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const STATUS: Record<string, string> = {
  vended: 'Successful', delivered: 'Successful', refunded: 'Refunded', payment_failed: 'Payment failed',
  vend_failed: 'Failed', needs_review: 'Under review', payment_pending: 'Awaiting payment', vending: 'Processing', paid: 'Processing',
};
export const statusLabel = (s: string) => STATUS[s] ?? s;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// ---------------------------------------------------------------------------
// Receipt image (PNG): easy to save or send on WhatsApp
// ---------------------------------------------------------------------------

async function drawReceipt(o: GuestOrder, brand: string): Promise<string> {
  const W = 900;
  const rows: [string, string][] = [
    ['Electricity company', o.provider_name],
    ['Meter number', `${o.meter_number} (${o.meter_type})`],
    ['Account name', o.customer_name || '—'],
    ...(o.energy_kwh ? ([['Units', `${o.energy_kwh.toFixed(1)} kWh`]] as [string, string][]) : []),
    ...(o.fee_kobo > 0
      ? ([
          ['Electricity', naira(o.amount_kobo - o.fee_kobo)],
          ['Fee', naira(o.fee_kobo)],
        ] as [string, string][])
      : []),
    ['Date', when(o.created_at)],
    ['Reference', o.id.slice(0, 8).toUpperCase()],
    ['Status', statusLabel(o.status)],
  ];
  const H = 520 + rows.length * 64 + (o.token ? 190 : 0);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#0b0b0b';
  g.fillRect(0, 0, W, 150);
  try {
    const mark = await loadImage(logo);
    g.drawImage(mark, 60, 47, 56, 56);
  } catch {
    /* text only */
  }
  g.fillStyle = '#ffffff';
  g.font = '800 34px Satoshi, Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(brand.toUpperCase().split('').join(String.fromCharCode(8202)), 140, 76);
  g.fillStyle = '#c98a3e';
  g.font = '600 24px Satoshi, Arial, sans-serif';
  g.textAlign = 'right';
  g.fillText('Payment receipt', W - 60, 76);
  g.textAlign = 'left';

  g.fillStyle = '#6b6b6b';
  g.font = '500 26px Satoshi, Arial, sans-serif';
  g.fillText('Amount paid', 60, 220);
  g.fillStyle = '#0b0b0b';
  g.font = '800 64px Satoshi, Arial, sans-serif';
  g.fillText(naira(o.amount_kobo), 60, 290);

  let y = 360;
  if (o.token) {
    g.fillStyle = '#f6f1e8';
    g.beginPath();
    g.roundRect(60, y, W - 120, 150, 18);
    g.fill();
    g.fillStyle = '#6b6b6b';
    g.font = '500 22px Satoshi, Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('Electricity token', W / 2, y + 42);
    g.fillStyle = '#0b0b0b';
    g.font = '700 44px "JetBrains Mono", Menlo, monospace';
    g.fillText(grouped(o.token), W / 2, y + 100);
    g.textAlign = 'left';
    y += 190;
  }
  for (const [k, v] of rows) {
    g.fillStyle = '#6b6b6b';
    g.font = '500 26px Satoshi, Arial, sans-serif';
    g.fillText(k, 60, y + 24);
    g.fillStyle = '#0b0b0b';
    g.font = '600 26px Satoshi, Arial, sans-serif';
    g.textAlign = 'right';
    g.fillText(v.length > 34 ? `${v.slice(0, 33)}…` : v, W - 60, y + 24);
    g.textAlign = 'left';
    g.strokeStyle = '#ececec';
    g.beginPath();
    g.moveTo(60, y + 56);
    g.lineTo(W - 60, y + 56);
    g.stroke();
    y += 64;
  }
  g.fillStyle = '#8a8a8a';
  g.font = '500 22px Satoshi, Arial, sans-serif';
  g.textAlign = 'center';
  if (o.token) g.fillText('Type the 20 digits on your meter keypad and press Enter.', W / 2, y + 50);
  g.fillText(`${brand} · A product of Zieon Energies Ltd`, W / 2, y + 92);
  if (o.sandbox) {
    g.fillStyle = '#b45309';
    g.fillText('Test mode: not valid on a real meter', W / 2, y + 132);
  }
  return c.toDataURL('image/png');
}

export function ReceiptButton({ order, className = '', compact = false }: { order: GuestOrder; className?: string; compact?: boolean }) {
  const brand = useBrand();
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const url = await drawReceipt(order, brand.display_name);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${brand.display_name.toLowerCase()}-receipt-${order.id.slice(0, 8)}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={() => void save()} disabled={busy} className={className} title="Download receipt" aria-label="Download receipt">
      {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowDownToLine size={15} />}
      {compact ? null : ' Receipt'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// One-time token QR
// ---------------------------------------------------------------------------

function Dialog({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            {sub ? <p className="truncate text-sm text-white/45">{sub}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/45 hover:bg-white/[0.06] hover:text-white">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ShareTokenDialog({ order, onClose }: { order: GuestOrder; onClose: () => void }) {
  const brand = useBrand();
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    account
      .share(order.id)
      .then(async (s) => {
        const url = window.location.origin + href(`/t/${s.code}`);
        setLink(url);
        setQr(await brandedQrUrl(url, 480, brand.logo_url || logo));
      })
      .catch((e) => setError(errText(e)));
  }, [order.id, brand.logo_url]);

  const share = async () => {
    const text = `Your ${order.provider_name} token for meter ${order.meter_number}. Open once to see it:`;
    try {
      if (qr) {
        const file = new File([await (await fetch(qr)).blob()], 'token-qr.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text: `${text} ${link}` });
      }
      if (navigator.share) return await navigator.share({ title: 'Electricity token', text, url: link });
      void navigator.clipboard?.writeText(link);
      setCopied(true);
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <Dialog title="Share token" sub={`${order.meter_number} · ${order.provider_name}`} onClose={onClose}>
      {error ? (
        <p className="mt-5 rounded-lg bg-zener-danger/10 px-3.5 py-2.5 text-sm text-zener-danger">{error}</p>
      ) : (
        <>
          <div className="mx-auto mt-5 grid aspect-square w-full max-w-[240px] place-items-center rounded-xl bg-white p-3">
            {qr ? <img src={qr} alt="One-time QR code for this token" className="h-full w-full" /> : <Loader2 className="animate-spin text-black/40" />}
          </div>
          <p className="mt-4 text-center text-sm text-white/55">
            Whoever scans this sees the token <span className="font-semibold text-white">once</span>. The code stops working after that, or in 24 hours.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void share()} disabled={!link} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110 disabled:opacity-40">
              <Share2 size={16} /> Share
            </button>
            <a
              href={qr || undefined}
              download={`token-qr-${order.id.slice(0, 8)}.png`}
              aria-disabled={!qr}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold hover:bg-white/[0.12] aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ArrowDownToLine size={16} /> Save QR
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(link);
                setCopied(true);
              }}
              disabled={!link}
              className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold hover:bg-white/[0.12] disabled:opacity-40"
            >
              {copied ? <Check size={16} className="text-zener-success" /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

// The page a scanned token QR opens. Viewing it does not use the token up
// (link previews open it too); the person taps Reveal.
export function TokenSharePage({ code }: { code: string }) {
  const brand = useBrand();
  const [info, setInfo] = useState<SharedToken | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    guest.tokenShare(code).then(setInfo).catch((e) => setError(errText(e)));
  }, [code]);

  const reveal = async () => {
    setBusy(true);
    try {
      setInfo(await guest.revealTokenShare(code));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#0b0b0b] px-5 py-10 text-white">
      <div className="w-full max-w-sm">
        <a href={href('/')} className="text-[14px] font-black tracking-[0.34em]">{brand.display_name.toUpperCase()}</a>
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          {error ? (
            <p className="text-sm text-white/70">{error}</p>
          ) : !info ? (
            <Loader2 className="mx-auto animate-spin text-zener-gold" />
          ) : (
            <>
              <h1 className="text-xl font-bold">
                {info.status === 'revealed' ? 'Your electricity token' : info.status === 'ready' ? 'Electricity token for you' : 'This token link has been used'}
              </h1>
              <dl className="mt-4 space-y-2 text-sm">
                <Row k="DisCo" v={info.provider_name} />
                <Row k="Meter" v={info.meter_number} />
                {info.energy_kwh ? <Row k="Units" v={`${info.energy_kwh.toFixed(1)} kWh`} /> : null}
                <Row k="Amount" v={naira(info.amount_kobo)} />
              </dl>
              {info.status === 'revealed' && info.token ? (
                <div className="mt-6 rounded-xl border border-zener-gold/30 bg-zener-gold/[0.06] p-5 text-center">
                  <p className="font-mono text-[22px] font-bold tracking-wide text-zener-gold">{grouped(info.token)}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(info.token ?? '');
                      setCopied(true);
                    }}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold hover:border-white/25"
                  >
                    {copied ? <Check size={15} className="text-zener-success" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy token'}
                  </button>
                  <p className="mt-4 text-xs text-white/50">Write it down or load it now: this link will not show it again.</p>
                </div>
              ) : info.status === 'ready' ? (
                <>
                  <p className="mt-5 text-sm text-white/55">The token can be shown <span className="font-semibold text-white">only once</span>. Reveal it when you are ready to load it on the meter.</p>
                  <button
                    type="button"
                    onClick={() => void reveal()}
                    disabled={busy}
                    className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null} Reveal token
                  </button>
                </>
              ) : (
                <p className="mt-5 text-sm text-white/55">
                  {info.status === 'expired' ? 'It expired before it was opened.' : 'Someone already opened it.'} Ask the person who sent it to share the token again.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/45">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account statement (PDF via the print dialog, or CSV)
// ---------------------------------------------------------------------------

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presets(): [string, string, string][] {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return [
    ['This month', ymd(first), ymd(now)],
    ['Last month', ymd(lastStart), ymd(lastEnd)],
    ['Last 3 months', ymd(new Date(now.getFullYear(), now.getMonth() - 2, 1)), ymd(now)],
    ['This year', `${now.getFullYear()}-01-01`, ymd(now)],
  ];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function statementHtml(st: Statement, brand: string) {
  const day = (iso: string) => new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const purchases = st.purchases
    .map(
      (p) =>
        `<tr><td>${day(p.date)}</td><td>${esc(p.provider_name)}</td><td>${esc(p.meter_number)}</td><td>${p.energy_kwh ? p.energy_kwh.toFixed(1) + ' kWh' : '—'}</td>` +
        `<td>${p.token_last4 ? '…' + esc(p.token_last4) : '—'}</td><td>${esc(statusLabel(p.status))}</td><td class="n">${esc(naira(p.amount_kobo))}</td></tr>`,
    )
    .join('');
  const label: Record<string, string> = { wallet_fund: 'Wallet top-up', purchase: 'Electricity purchase', refund: 'Refund' };
  const wallet = st.wallet
    .map(
      (w) =>
        `<tr><td>${day(w.created_at)}</td><td>${esc(label[w.kind] ?? w.memo)}</td><td class="n">${w.amount_kobo > 0 ? esc(naira(w.amount_kobo)) : ''}</td>` +
        `<td class="n">${w.amount_kobo < 0 ? esc(naira(-w.amount_kobo)) : ''}</td><td class="n">${esc(naira(w.balance_after_kobo))}</td></tr>`,
    )
    .join('');
  const period = `${new Date(st.from).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })} to ${new Date(st.to).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(brand)} statement ${st.from} to ${st.to}</title><style>
@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#111;font-size:12px;margin:0}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:10px}
.brand{font-weight:800;letter-spacing:4px;font-size:16px}.muted{color:#666}h2{font-size:13px;margin:22px 0 6px}
.sum{display:flex;gap:10px;margin-top:16px}.sum div{flex:1;border:1px solid #ddd;border-radius:6px;padding:8px 10px}.sum b{display:block;font-size:15px;margin-top:2px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #eee}th{font-size:11px;color:#666;border-bottom:1px solid #bbb}.n{text-align:right;white-space:nowrap}
footer{margin-top:24px;color:#888;font-size:10px}</style></head><body>
<header><div><div class="brand">${esc(brand.toUpperCase())}</div><div class="muted">Account statement</div></div>
<div style="text-align:right"><b>${esc(st.name || st.email)}</b><div class="muted">${esc(st.email)}</div><div class="muted">${esc(period)}</div></div></header>
<div class="sum"><div><span class="muted">Spent on electricity</span><b>${esc(naira(st.spent_kobo))}</b></div><div><span class="muted">Successful purchases</span><b>${st.successful_purchases}</b></div>
<div><span class="muted">Energy bought</span><b>${st.energy_kwh.toFixed(1)} kWh</b></div><div><span class="muted">Wallet balance</span><b>${esc(naira(st.wallet_closing_kobo))}</b></div></div>
<h2>Electricity purchases</h2>${purchases ? `<table><tr><th>Date</th><th>DisCo</th><th>Meter</th><th>Units</th><th>Token</th><th>Status</th><th class="n">Amount</th></tr>${purchases}</table>` : '<p class="muted">No purchases in this period.</p>'}
<h2>Wallet</h2><p class="muted">Opening balance ${esc(naira(st.wallet_opening_kobo))} · Closing balance ${esc(naira(st.wallet_closing_kobo))}</p>
${wallet ? `<table><tr><th>Date</th><th>Description</th><th class="n">Money in</th><th class="n">Money out</th><th class="n">Balance</th></tr>${wallet}</table>` : '<p class="muted">No wallet activity in this period.</p>'}
<footer>${esc(brand)} is a product of Zieon Energies Ltd (RC 9519634). Generated ${new Date().toLocaleString('en-NG')}. Fees, where charged, are included in amounts.</footer>
<script>window.onload=()=>setTimeout(()=>print(),150)</script></body></html>`;
}

function statementCsv(st: Statement) {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['Date', 'DisCo', 'Meter', 'Meter type', 'Units (kWh)', 'Token (last 4)', 'Status', 'Paid with', 'Fee (NGN)', 'Amount (NGN)'].map(q).join(',')];
  for (const p of st.purchases) {
    lines.push(
      [p.date, p.provider_name, p.meter_number, p.meter_type, p.energy_kwh.toFixed(1), p.token_last4, statusLabel(p.status), p.paid_with, koboToNaira(p.fee_kobo), koboToNaira(p.amount_kobo)]
        .map(q)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function StatementDialog({ onClose }: { onClose: () => void }) {
  const brand = useBrand();
  const opts = presets();
  const [from, setFrom] = useState(opts[0][1]);
  const [to, setTo] = useState(opts[0][2]);
  const [busy, setBusy] = useState<'' | 'pdf' | 'csv'>('');
  const [error, setError] = useState('');

  const get = async (kind: 'pdf' | 'csv') => {
    setError('');
    // Open the window first: browsers block pop-ups opened after a network wait.
    const w = kind === 'pdf' ? window.open('', '_blank') : null;
    setBusy(kind);
    try {
      const st = await account.statement(from, to);
      if (kind === 'pdf') {
        if (!w) return setError('Allow pop-ups for this site to download the PDF.');
        w.document.write(statementHtml(st, brand.display_name));
        w.document.close();
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([statementCsv(st)], { type: 'text/csv' }));
        a.download = `${brand.display_name.toLowerCase()}-statement-${from}-to-${to}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      w?.close();
      setError(errText(e));
    } finally {
      setBusy('');
    }
  };

  const input = 'h-11 w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-zener-gold/60 [color-scheme:dark]';
  return (
    <Dialog title="Account statement" sub="Purchases and wallet activity" onClose={onClose}>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {opts.map(([label, f, t]) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setFrom(f);
              setTo(t);
            }}
            className={`rounded-lg border py-2 text-xs font-semibold transition ${
              from === f && to === t ? 'border-zener-gold/60 bg-zener-gold/10 text-zener-gold' : 'border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-white/50">
          From
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${input} mt-1.5`} />
        </label>
        <label className="text-xs font-semibold text-white/50">
          To
          <input type="date" value={to} min={from} max={ymd(new Date())} onChange={(e) => setTo(e.target.value)} className={`${input} mt-1.5`} />
        </label>
      </div>
      {error ? <p className="mt-4 rounded-lg bg-zener-danger/10 px-3.5 py-2.5 text-sm text-zener-danger">{error}</p> : null}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void get('pdf')} disabled={!!busy} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110 disabled:opacity-50">
          {busy === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} PDF
        </button>
        <button type="button" onClick={() => void get('csv')} disabled={!!busy} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold hover:bg-white/[0.12] disabled:opacity-50">
          {busy === 'csv' ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />} CSV (Excel)
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-white/35">PDF opens your print dialog: choose “Save as PDF”.</p>
    </Dialog>
  );
}
