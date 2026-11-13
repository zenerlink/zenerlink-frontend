import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calculator,
  CheckCircle2,
  Copy,
  CreditCard,
  Gauge,
  Landmark,
  MessageCircle,
  Plus,
  Repeat,
  Send,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import { AppShell, type ZenerPage } from './components/layout/AppShell';
import { AppLogo, Wordmark } from './components/ui/AppLogo';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { ApiError, EMBEDDED, api, koboToNaira, nairaToKobo, setSignedOutHandler } from './lib/api';
import type { ApiMeter, Branding, Consumption, Notification, PendingToken as ApiPendingToken, User } from './lib/api';
import { BrandContext, fallbackBranding, useBrand } from './lib/brand';
import { applyBranding } from './lib/theme';
import { formatCurrency } from './lib/format';
import type { HistoryItem, MeterRecord, NotificationItem, PaymentMethod, PendingToken, RecentRecipient } from './types';

type ModalName = 'fund' | 'buy' | 'share' | 'addMeter' | 'calculator' | 'notifications' | null;
type Result<T> = { ok: true; value: T } | { ok: false; message: string };

const DEFAULT_RATE = 200;

const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Network error. Check your connection and try again.');

const toMeterRecord = (m: ApiMeter): MeterRecord => ({
  id: m.id,
  label: m.label,
  providerCode: m.provider_code,
  providerName: m.provider_name,
  meterNumber: m.meter_number,
  customerName: m.customer_name,
  address: m.address,
  meterType: m.meter_type,
  kwhReserve: m.kwh_reserve,
});

const placeholderMeter: MeterRecord = {
  id: '',
  label: 'No meter',
  providerCode: '',
  providerName: 'Add a meter to get started',
  meterNumber: '',
  customerName: '',
  address: '',
  meterType: 'prepaid',
  kwhReserve: 0,
};

const relativeTime = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const gold = 'rgb(var(--zener-gold))';
const success = 'rgb(var(--zener-success))';

export default function App() {
  const [branding, setBranding] = useState<Branding>(fallbackBranding);
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    const boot = async () => {
      try {
        const b = await api.branding();
        setBranding(b);
        applyBranding(b);
      } catch {
        /* keep default branding if the API is unreachable */
      }
      try {
        const code = new URLSearchParams(window.location.hash.slice(1)).get('code');
        if (EMBEDDED && code) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          setUser((await api.exchangeEmbedCode(code)).user);
        } else {
          const me = await api.resume();
          if (me) setUser(me.user);
        }
      } catch {
        /* not signed in */
      } finally {
        setBooting(false);
      }
    };
    void boot();
  }, []);

  return (
    <BrandContext.Provider value={branding}>
      {booting ? (
        <main className="grid min-h-screen place-items-center"><AppLogo size={44} /></main>
      ) : user ? (
        <Workspace user={user} onLogout={() => void api.logout().then(() => setUser(null))} />
      ) : EMBEDDED ? (
        <main className="grid min-h-screen place-items-center px-6 text-center text-sm text-white/55">
          Your session has ended. Return to {branding.display_name} and open electricity again.
        </main>
      ) : (
        <AuthScreen onAuthenticated={setUser} />
      )}
    </BrandContext.Provider>
  );
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [activePage, setActivePage] = useState<ZenerPage>('home');
  const [modal, setModal] = useState<ModalName>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [apiMeters, setApiMeters] = useState<ApiMeter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [apiTokens, setApiTokens] = useState<ApiPendingToken[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [suggestedToken, setSuggestedToken] = useState<string | null>(null);
  const [quickShareRecipient, setQuickShareRecipient] = useState<RecentRecipient | null>(null);
  const [loadError, setLoadError] = useState('');

  const meters = useMemo(() => apiMeters.map(toMeterRecord), [apiMeters]);
  const selectedMeter = useMemo(
    () => meters.find((meter) => meter.id === selectedMeterId) ?? meters[0] ?? placeholderMeter,
    [meters, selectedMeterId],
  );
  const ratePerKwh = rates[selectedMeter.providerCode] ?? DEFAULT_RATE;

  // DIU page expects tokens keyed by token string with the meter number.
  const pendingTokens = useMemo(() => {
    const byId = new Map(apiMeters.map((m) => [m.id, m.meter_number]));
    return Object.fromEntries(
      apiTokens.map((t): [string, PendingToken] => [
        t.token,
        { meterNumber: byId.get(t.meter_id) ?? '', kwhAmount: t.energy_kwh, source: t.source, note: t.note || undefined },
      ]),
    );
  }, [apiTokens, apiMeters]);

  const refresh = useCallback(async () => {
    try {
      const [w, m, a, r, n, t, tr] = await Promise.all([
        api.wallet(),
        api.meters(),
        api.activity(),
        api.recipients(),
        api.notifications(),
        api.pendingTokens(),
        api.tariffs(),
      ]);
      setWalletBalance(koboToNaira(w.balance_kobo));
      setApiMeters(m.meters);
      setHistory(
        a.activity.map((item) => ({
          title: item.title,
          subtitle: item.subtitle,
          amount:
            item.amount_kobo !== undefined && item.amount_kobo !== null
              ? `${item.amount_kobo >= 0 ? '+' : '-'}${formatCurrency(Math.abs(koboToNaira(item.amount_kobo)))}`
              : item.kwh !== undefined && item.kwh !== null
                ? `${item.kwh >= 0 ? '+' : ''}${item.kwh.toFixed(1)} kWh`
                : '',
          accent: (item.amount_kobo ?? item.kwh ?? 0) >= 0 ? success : gold,
        })),
      );
      setRecentRecipients(
        r.recipients.map((x) => ({
          name: x.name,
          meterNumber: x.meter_number,
          lastNote: x.last_note,
          lastAmount: x.last_kwh,
          lastShared: x.last_shared_at ? relativeTime(x.last_shared_at) : 'Saved',
        })),
      );
      setNotifications(
        n.notifications.map((x: Notification) => ({ title: x.title, message: x.message, critical: x.critical, time: relativeTime(x.created_at) })),
      );
      setApiTokens(t.tokens);
      setRates(Object.fromEntries(tr.tariffs.map((x) => [x.provider_code, x.rate_per_kwh])));
      setLoadError('');
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fundWallet = async (amount: number): Promise<Result<string>> => {
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Enter a valid funding amount.' };
    try {
      const res = await api.fundWallet(nairaToKobo(amount), 'bank_transfer');
      if (res.payment?.checkout_url) {
        window.location.assign(res.payment.checkout_url);
        return { ok: true, value: 'Redirecting to payment…' };
      }
      await refresh();
      setModal(null);
      return { ok: true, value: res.sandbox ? 'Sandbox funding applied (no real money moved).' : 'Wallet funded.' };
    } catch (e) {
      return { ok: false, message: errorMessage(e) };
    }
  };

  const buyElectricity = async (amount: number, paymentMethod: PaymentMethod): Promise<Result<string>> => {
    if (!selectedMeter.id) return { ok: false, message: 'Add a meter first.' };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Enter a valid purchase amount.' };
    const method = paymentMethod === 'bankTransfer' ? 'bank_transfer' : paymentMethod;
    try {
      const p = await api.purchase(selectedMeter.id, nairaToKobo(amount), method);
      if (p.status === 'payment_pending' && p.payment?.checkout_url) {
        window.location.assign(p.payment.checkout_url);
        return { ok: true, value: 'Redirecting to payment…' };
      }
      await refresh();
      if (p.token) {
        setSuggestedToken(p.token);
        setActivePage('diu');
        setModal(null);
        return { ok: true, value: p.token };
      }
      if (p.status === 'refunded') return { ok: false, message: `Purchase failed and was refunded: ${p.failure_reason ?? ''}` };
      return { ok: false, message: 'Purchase is being confirmed. Your token will appear under DIU shortly.' };
    } catch (e) {
      return { ok: false, message: errorMessage(e) };
    }
  };

  const redeemToken = async (token: string): Promise<Result<string>> => {
    if (!selectedMeter.id) return { ok: false, message: 'Add a meter first.' };
    try {
      const res = await api.redeem(selectedMeter.id, token);
      if (suggestedToken === token) setSuggestedToken(null);
      await refresh();
      return { ok: true, value: res.message || 'Token delivered successfully.' };
    } catch (e) {
      return { ok: false, message: errorMessage(e) };
    }
  };

  const share = async (meterNumber: string, amount: number, note: string, recipientName: string, mode: 'direct' | 'token'): Promise<Result<string>> => {
    if (!meterNumber.trim() || !Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Check recipient meter and amount.' };
    try {
      const res = await api.share({ from_meter_id: selectedMeter.id, to_meter_number: meterNumber, kwh: amount, note, recipient_name: recipientName, mode });
      await refresh();
      if (mode === 'token' && res.token) {
        setSuggestedToken(res.token);
        return { ok: true, value: res.token };
      }
      setModal(null);
      setQuickShareRecipient(null);
      return { ok: true, value: 'Units shared.' };
    } catch (e) {
      return { ok: false, message: errorMessage(e) };
    }
  };

  const addMeter = async (input: { label: string; providerCode: string; meterNumber: string }): Promise<Result<string>> => {
    if (!input.meterNumber.trim() || !input.label.trim() || !input.providerCode.trim()) {
      return { ok: false, message: 'Enter a label, provider code, and meter number.' };
    }
    try {
      const m = await api.linkMeter({ label: input.label, provider_code: input.providerCode, meter_number: input.meterNumber });
      await refresh();
      setSelectedMeterId(m.id);
      setModal(null);
      return { ok: true, value: 'Meter added.' };
    } catch (e) {
      return { ok: false, message: errorMessage(e) };
    }
  };

  const openShareModal = (recipient?: RecentRecipient) => {
    setQuickShareRecipient(recipient ?? null);
    setModal('share');
  };

  const clientName = user.name || user.email.split('@')[0];

  return (
    <AppShell
      activePage={activePage}
      onPageChange={setActivePage}
      onLogout={onLogout}
      clientEmail={user.email}
      clientName={clientName}
      walletBalance={walletBalance}
      selectedMeter={selectedMeter}
      metersCount={meters.length}
    >
      {loadError ? (
        <p className="mb-4 rounded-md border border-zener-danger/40 bg-zener-danger/10 px-3 py-2 text-sm font-bold text-zener-danger">{loadError}</p>
      ) : null}
      {activePage === 'home' ? (
        <HomePage
          meters={meters}
          selectedMeter={selectedMeter}
          walletBalance={walletBalance}
          recentRecipients={recentRecipients}
          notifications={notifications}
          ratePerKwh={ratePerKwh}
          onSelectMeter={setSelectedMeterId}
          onOpenModal={setModal}
          onQuickShare={openShareModal}
          onRemoveRecipient={(recipient) => void api.removeRecipient(recipient.meterNumber).then(refresh)}
        />
      ) : null}
      {activePage === 'consumption' ? <ConsumptionPage selectedMeter={selectedMeter} /> : null}
      {activePage === 'diu' ? (
        <DiuPage
          selectedMeter={selectedMeter}
          suggestedToken={suggestedToken}
          pendingTokens={pendingTokens}
          onRedeem={redeemToken}
        />
      ) : null}
      {activePage === 'exchange' ? <ExchangePage /> : null}
      {activePage === 'profile' ? (
        <ProfilePage name={clientName} email={user.email} phone={user.phone} meters={meters} history={history} />
      ) : null}

      <ActionModals
        modal={modal}
        selectedMeter={selectedMeter}
        ownMeters={meters.filter((meter) => meter.id !== selectedMeter.id)}
        quickRecipient={quickShareRecipient}
        walletBalance={walletBalance}
        notifications={notifications}
        ratePerKwh={ratePerKwh}
        onClose={() => {
          setModal(null);
          setQuickShareRecipient(null);
        }}
        onFundWallet={fundWallet}
        onBuyElectricity={buyElectricity}
        onShare={share}
        onAddMeter={addMeter}
      />
    </AppShell>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const brand = useBrandName();

  const submit = async () => {
    setError('');
    if (!isLogin && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!isLogin && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const session = isLogin ? await api.login(email, password) : await api.register(email, phone, name, password);
      onAuthenticated(session.user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md border-transparent bg-transparent p-6 shadow-none sm:p-8">
        <h1 className="mt-2">
          <Wordmark fontSize={30} />
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/55">Fast electricity management for every meter you own.</p>
        <div className="mt-8 grid grid-cols-2 gap-2">
          {['Login', 'Sign Up'].map((label) => {
            const selected = isLogin === (label === 'Login');
            return (
              <button
                key={label}
                onClick={() => {
                  setIsLogin(label === 'Login');
                  setError('');
                }}
                className={`rounded-md py-3 text-sm font-bold ${selected ? 'bg-zener-gold text-black' : 'bg-white/10 text-white'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-5 space-y-3">
          {!isLogin ? <FormInput label="Full name" value={name} onChange={setName} placeholder="Ada Obi" /> : null}
          {!isLogin ? <FormInput label="Phone" value={phone} onChange={setPhone} placeholder="+234 801 234 5678" /> : null}
          <FormInput label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
          <FormInput label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" />
          {!isLogin ? <FormInput label="Confirm password" value={confirm} onChange={setConfirm} placeholder="••••••••" type="password" /> : null}
        </div>
        {error ? <p className="mt-4 text-sm font-bold text-zener-danger">{error}</p> : null}
        <Button className="mt-6 w-full" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Please wait…' : isLogin ? 'Login' : 'Sign Up'}
        </Button>
      </Card>
    </main>
  );
}

function useBrandName() {
  return useBrand().display_name;
}

function HomePage({
  meters,
  selectedMeter,
  walletBalance,
  recentRecipients,
  notifications,
  ratePerKwh,
  onSelectMeter,
  onOpenModal,
  onQuickShare,
  onRemoveRecipient,
}: {
  meters: MeterRecord[];
  selectedMeter: MeterRecord;
  walletBalance: number;
  recentRecipients: RecentRecipient[];
  notifications: NotificationItem[];
  ratePerKwh: number;
  onSelectMeter: (id: string) => void;
  onOpenModal: (modal: ModalName) => void;
  onQuickShare: (recipient: RecentRecipient) => void;
  onRemoveRecipient: (recipient: RecentRecipient) => void;
}) {
  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="p-5" accent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zener-gold">Active meters</p>
              <h2 className="mt-1 text-2xl font-black">Electricity cockpit</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" icon={Calculator} onClick={() => onOpenModal('calculator')}>Calculator</Button>
              <Button icon={Zap} onClick={() => onOpenModal('buy')}>Buy</Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {meters.map((meter) => (
              <button
                key={meter.id}
                onClick={() => onSelectMeter(meter.id)}
                className={`rounded-lg border p-4 text-left transition hover:border-zener-gold/50 ${
                  meter.id === selectedMeter.id ? 'border-zener-gold bg-black/35 shadow-gold' : 'border-zener-border bg-black/20'
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">{meter.label}</p>
                <h3 className="mt-2 truncate text-lg font-black">{meter.providerName}</h3>
                <p className="mt-1 text-xs text-white/45">{meter.meterNumber}</p>
                <p className="mt-6 text-3xl font-black">{meter.kwhReserve.toFixed(1)} kWh</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/45">{meter.address}</p>
              </button>
            ))}
            <button
              onClick={() => onOpenModal('addMeter')}
              className="grid min-h-52 place-items-center rounded-lg border border-dashed border-zener-border bg-white/[0.025] p-4 text-white/45 transition hover:border-zener-gold hover:text-zener-gold"
            >
              <span className="flex flex-col items-center gap-3 text-sm font-bold">
                <Plus size={32} />
                Add Meter
              </span>
            </button>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-zener-border p-2"><Wallet size={17} /></span>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">Naira wallet</p>
            </div>
            <p className="mt-4 text-3xl font-black">{formatCurrency(walletBalance)}</p>
            <Button className="mt-5 w-full" icon={Landmark} onClick={() => onOpenModal('fund')}>Fund wallet</Button>
          </Card>
          <Card className="p-5" accent>
            <div className="flex items-start gap-3">
              <Bell className="mt-1 text-zener-gold" size={18} />
              <div>
                <p className="font-bold">{notifications[0]?.title ?? 'All caught up'}</p>
                <p className="mt-1 text-sm leading-6 text-white/55">{notifications[0]?.message ?? 'No new notifications.'}</p>
                <Button variant="ghost" className="mt-3 px-0" onClick={() => onOpenModal('notifications')}>View notifications</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-black">Spark Share</h3>
            <Button variant="secondary" icon={Send} onClick={() => onOpenModal('share')}>Share units</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentRecipients.map((recipient) => (
              <div key={recipient.meterNumber} className="rounded-lg border border-zener-border bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{recipient.name}</p>
                    <p className="mt-1 text-xs text-white/45">{recipient.meterNumber}</p>
                  </div>
                  <button className="text-xs font-bold text-white/35 transition hover:text-red-300" onClick={() => onRemoveRecipient(recipient)}>
                    Remove
                  </button>
                </div>
                <p className="mt-3 text-sm text-white/60">{recipient.lastAmount.toFixed(1)} kWh • {recipient.lastNote}</p>
                <Button className="mt-4 w-full" variant="secondary" icon={Send} onClick={() => onQuickShare(recipient)}>
                  Quick share
                </Button>
              </div>
            ))}
          </div>
        </Card>
        <MiniHistory selectedMeter={selectedMeter} ratePerKwh={ratePerKwh} />
      </div>
    </div>
  );
}

function MiniHistory({ selectedMeter, ratePerKwh }: { selectedMeter: MeterRecord; ratePerKwh: number }) {
  return (
    <Card className="p-5">
      <h3 className="font-black">Today’s power view</h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ['Reserve', `${selectedMeter.kwhReserve.toFixed(1)} kWh`, Gauge],
          ['Rate', `${formatCurrency(ratePerKwh)}/kWh`, CreditCard],
          ['Protection', 'Ohm Shield active', ShieldCheck],
        ].map(([label, value, Icon]) => (
          <div key={label as string} className="rounded-lg border border-zener-border bg-white/[0.025] p-4">
            <Icon size={18} className="text-zener-gold" />
            <p className="mt-5 text-xs uppercase tracking-[0.16em] text-white/35">{label as string}</p>
            <p className="mt-1 font-black">{value as string}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ConsumptionPage({ selectedMeter }: { selectedMeter: MeterRecord }) {
  const [data, setData] = useState<Consumption | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedMeter.id) return;
    setData(null);
    api.consumption(selectedMeter.id).then(setData).catch((e) => setError(errorMessage(e)));
  }, [selectedMeter.id]);

  const days = data?.days ?? [];
  const peak = Math.max(1, ...days.map((d) => d.kwh));
  const breakdown = Object.entries(data?.time_breakdown ?? {});
  return (
    <div className="grid gap-5 pb-20 lg:grid-cols-[1fr_360px] lg:pb-0">
      <Card className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-zener-gold">Consumption</p>
        <h2 className="mt-1 text-2xl font-black">{selectedMeter.label} energy trend</h2>
        {days.length ? (
          <div className="mt-8 flex h-72 items-end gap-3 rounded-lg border border-zener-border bg-black/25 p-4">
            {days.map((day) => (
              <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-3">
                <div className="w-full rounded-t-md bg-gradient-to-t from-zener-gold to-zener-gold/60" style={{ height: `${(day.kwh / peak) * 100}%` }} />
                <span className="text-xs text-white/40">{new Date(day.date).toLocaleDateString('en-NG', { weekday: 'short' })}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-lg border border-zener-border bg-black/25 p-6 text-sm text-white/55">
            {error || (data ? data.message ?? 'No consumption data yet.' : selectedMeter.id ? 'Loading…' : 'Add a meter to see consumption.')}
          </p>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="font-black">Time breakdown</h3>
        <div className="mt-5 space-y-4">
          {breakdown.length ? (
            breakdown.map(([label, share]) => (
              <div key={label}>
                <div className="mb-2 flex justify-between text-sm capitalize"><span>{label}</span><span>{Math.round(share * 100)}%</span></div>
                <div className="h-2 rounded-md bg-white/10"><div className="h-2 rounded-md bg-zener-gold" style={{ width: `${share * 100}%` }} /></div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/45">Available once the meter reports readings.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function DiuPage({
  selectedMeter,
  suggestedToken,
  pendingTokens,
  onRedeem,
}: {
  selectedMeter: MeterRecord;
  suggestedToken: string | null;
  pendingTokens: Record<string, PendingToken>;
  onRedeem: (token: string) => Promise<Result<string>>;
}) {
  const [token, setToken] = useState(suggestedToken ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const matchingTokens = Object.entries(pendingTokens).filter(
    ([, credit]) => credit.meterNumber === selectedMeter.meterNumber,
  );

  useEffect(() => {
    if (suggestedToken) setToken(suggestedToken);
  }, [suggestedToken]);

  const handleRedeem = async (value: string) => {
    setBusy(true);
    const res = await onRedeem(value.trim());
    setBusy(false);
    setMessage(res.ok ? res.value : res.message);
    if (res.ok) setToken('');
  };

  return (
    <Card className="mx-auto max-w-3xl p-5" accent>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-zener-gold">DIU transfer</p>
      <h2 className="mt-1 text-2xl font-black">{selectedMeter.label} credit unit</h2>
      <p className="mt-2 text-sm text-white/55">Paste or use the generated token to deliver purchased energy into this meter.</p>
      {suggestedToken ? (
        <button onClick={() => setToken(suggestedToken)} className="mt-6 w-full rounded-lg border border-zener-gold/40 bg-zener-panel p-4 text-left">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Suggested token</p>
          <p className="mt-2 text-2xl font-black tracking-[0.12em] text-zener-gold">{suggestedToken}</p>
        </button>
      ) : null}
      <div className="mt-5">
        <FormInput label="Token" value={token} onChange={setToken} placeholder="20-digit token" />
      </div>
      <Button
        className="mt-5 w-full"
        icon={Zap}
        disabled={busy}
        onClick={() => void handleRedeem(token)}
      >
        {busy ? 'Sending…' : 'Send to DIU'}
      </Button>
      {message ? <p className="mt-4 text-sm font-bold text-zener-success">{message}</p> : null}
      <div className="mt-6 rounded-lg border border-zener-border bg-black/20 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">Pending tokens for this meter</p>
        <div className="mt-3 space-y-2">
          {matchingTokens.length ? (
            matchingTokens.map(([pendingToken, credit]) => (
              <button
                key={pendingToken}
                onClick={() => setToken(pendingToken)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-zener-border bg-white/[0.03] px-3 py-3 text-left transition hover:border-zener-gold/60"
              >
                <span>
                  <span className="block font-black tracking-[0.12em] text-zener-gold">{pendingToken}</span>
                  <span className="text-xs text-white/45">{credit.kwhAmount.toFixed(1)} kWh • {credit.source}</span>
                </span>
                <span className="text-xs font-bold text-white/45">Use</span>
              </button>
            ))
          ) : (
            <p className="text-sm text-white/45">No pending token is linked to this meter.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ExchangePage() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {[
        ['P2P Energy Exchange', 'Trade surplus kWh across trusted meters.', Repeat],
        ['Ohm Shield', 'Outage cover, surge protection, and meter watch.', ShieldCheck],
        ['Support Chat', 'Reach a Zenerlink specialist for billing or supply issues.', MessageCircle],
      ].map(([title, body, Icon]) => (
        <Card key={title as string} className="p-5">
          <Icon className="text-zener-gold" size={22} />
          <h2 className="mt-6 text-xl font-black">{title as string}</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">{body as string}</p>
          <Button className="mt-6" variant="secondary">Open</Button>
        </Card>
      ))}
    </div>
  );
}

function ProfilePage({ name, email, phone, meters, history }: { name: string; email: string; phone: string; meters: MeterRecord[]; history: HistoryItem[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Card className="p-5" accent>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-zener-gold/40 bg-zener-gold/10 text-2xl font-black">{name.charAt(0).toUpperCase()}</div>
          <div>
            <h2 className="text-2xl font-black">{name}</h2>
            <p className="text-sm text-white/55">{email}</p>
            <p className="text-sm text-white/40">{phone}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <ProfileMetric label="Meters" value={meters.length.toString()} />
          <ProfileMetric label="Wallet tier" value="Verified" />
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-black">History</h3>
        <div className="mt-4 divide-y divide-zener-border">
          {history.length === 0 ? <p className="py-4 text-sm text-white/45">No activity yet.</p> : null}
          {history.map((item, index) => (
            <div key={`${item.title}-${index}`} className="flex items-center justify-between py-4">
              <div>
                <p className="font-bold">{item.title}</p>
                <p className="mt-1 text-sm text-white/45">{item.subtitle}</p>
              </div>
              <p className="font-black" style={{ color: item.accent }}>{item.amount}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ActionModals({
  modal,
  selectedMeter,
  ownMeters,
  quickRecipient,
  walletBalance,
  notifications,
  ratePerKwh,
  onClose,
  onFundWallet,
  onBuyElectricity,
  onShare,
  onAddMeter,
}: {
  modal: ModalName;
  selectedMeter: MeterRecord;
  ownMeters: MeterRecord[];
  quickRecipient: RecentRecipient | null;
  walletBalance: number;
  notifications: NotificationItem[];
  ratePerKwh: number;
  onClose: () => void;
  onFundWallet: (amount: number) => Promise<Result<string>>;
  onBuyElectricity: (amount: number, paymentMethod: PaymentMethod) => Promise<Result<string>>;
  onShare: (meterNumber: string, amount: number, note: string, recipientName: string, mode: 'direct' | 'token') => Promise<Result<string>>;
  onAddMeter: (input: { label: string; providerCode: string; meterNumber: string }) => Promise<Result<string>>;
}) {
  const [amount, setAmount] = useState('5000');
  const [method, setMethod] = useState<PaymentMethod>('wallet');
  const [meterNumber, setMeterNumber] = useState('');
  const [note, setNote] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [shareMode, setShareMode] = useState<'direct' | 'token'>('direct');
  const [generatedToken, setGeneratedToken] = useState('');
  const [message, setMessage] = useState('');
  const [providerCode, setProviderCode] = useState('AEDC');
  const [label, setLabel] = useState('New meter');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<Result<string>>, onOk?: (value: string) => void) => {
    setBusy(true);
    setMessage('');
    const res = await fn();
    setBusy(false);
    if (!res.ok) setMessage(res.message);
    else onOk?.(res.value);
  };

  useEffect(() => {
    setMessage('');
    setGeneratedToken('');
    if (modal === 'share') {
      setAmount(quickRecipient ? String(quickRecipient.lastAmount) : '20');
      setMeterNumber(quickRecipient?.meterNumber ?? '');
      setNote(quickRecipient?.lastNote ?? '');
      setRecipientName(quickRecipient?.name ?? '');
    } else if (modal === 'buy' || modal === 'fund' || modal === 'calculator') {
      setAmount('5000');
    }
  }, [modal, quickRecipient]);

  if (!modal) return null;

  const parsedAmount = Number(amount);
  const copyToken = () => {
    if (!generatedToken) return;
    void navigator.clipboard?.writeText(generatedToken);
    setMessage('Token copied.');
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-4 py-6 backdrop-blur">
      <Card className="max-h-[92vh] w-full max-w-xl overflow-auto p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black">
            {modal === 'fund' && 'Fund wallet'}
            {modal === 'buy' && 'Buy electricity'}
            {modal === 'share' && 'Share units'}
            {modal === 'addMeter' && 'Add meter'}
            {modal === 'calculator' && 'Electricity calculator'}
            {modal === 'notifications' && 'Notifications'}
          </h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        {modal === 'fund' ? (
          <AmountForm
            amount={amount}
            setAmount={setAmount}
            submitLabel="Confirm transfer"
            busy={busy}
            onSubmit={() => void run(() => onFundWallet(parsedAmount), setMessage)}
          />
        ) : null}

        {modal === 'buy' ? (
          <div className="space-y-4">
            <p className="text-sm text-white/55">Buying for {selectedMeter.providerName}. Wallet balance: {formatCurrency(walletBalance)}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['wallet', 'bankTransfer', 'card'] as PaymentMethod[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setMethod(item)}
                  className={`rounded-md border px-3 py-3 text-left text-sm font-bold ${method === item ? 'border-zener-gold text-zener-gold' : 'border-zener-border text-white/55'}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <AmountForm
              amount={amount}
              setAmount={setAmount}
              submitLabel="Generate token"
              busy={busy}
              onSubmit={() => void run(() => onBuyElectricity(parsedAmount, method))}
            />
          </div>
        ) : null}

        {modal === 'share' ? (
          <div className="space-y-4">
            <p className="text-sm text-white/55">Available: {selectedMeter.kwhReserve.toFixed(1)} kWh</p>
            <div className="grid grid-cols-2 gap-2">
              {(['direct', 'token'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setShareMode(mode);
                    setMessage('');
                    setGeneratedToken('');
                  }}
                  className={`rounded-md border px-3 py-3 text-sm font-bold capitalize ${
                    shareMode === mode ? 'border-zener-gold bg-zener-gold text-black' : 'border-zener-border bg-white/[0.03] text-white/55'
                  }`}
                >
                  {mode === 'direct' ? 'Direct transfer' : 'Token transfer'}
                </button>
              ))}
            </div>
            {ownMeters.length ? (
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-white/35">Own meter shortcut</span>
                <select
                  value={meterNumber}
                  onChange={(event) => {
                    const meter = ownMeters.find((item) => item.meterNumber === event.target.value);
                    setMeterNumber(event.target.value);
                    if (meter) setRecipientName(meter.label);
                  }}
                  className="w-full rounded-md border border-zener-border bg-zener-surface px-3 py-3 text-sm text-white outline-none transition focus:border-zener-gold"
                >
                  <option value="">Enter meter manually</option>
                  {ownMeters.map((meter) => (
                    <option key={meter.id} value={meter.meterNumber}>
                      {meter.label} • {meter.meterNumber}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <FormInput label="Recipient name" value={recipientName} onChange={setRecipientName} placeholder="Mom" />
            <FormInput label="Recipient meter" value={meterNumber} onChange={setMeterNumber} placeholder="22222222222" />
            <FormInput label="Amount in kWh" value={amount} onChange={setAmount} placeholder="20" type="number" />
            <FormInput label="Note" value={note} onChange={setNote} placeholder="Monthly support" />
            <Button
              className="w-full"
              icon={shareMode === 'direct' ? Send : Copy}
              disabled={busy}
              onClick={() =>
                void run(
                  () => onShare(meterNumber.trim(), parsedAmount, note.trim(), recipientName.trim(), shareMode),
                  (value) => {
                    if (shareMode === 'token') {
                      setGeneratedToken(value);
                      setMessage('Spark Share token generated. Send it to the recipient for DIU redemption.');
                    }
                  },
                )
              }
            >
              {shareMode === 'direct' ? 'Share units' : 'Generate share token'}
            </Button>
            {generatedToken ? (
              <div className="rounded-lg border border-zener-gold/40 bg-zener-panel p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Generated token</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xl font-black tracking-[0.12em] text-zener-gold">{generatedToken}</p>
                  <Button variant="secondary" icon={Copy} onClick={copyToken}>Copy</Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {modal === 'addMeter' ? (
          <div className="space-y-4">
            <FormInput label="Label" value={label} onChange={setLabel} placeholder="Apartment" />
            <FormInput label="Provider code" value={providerCode} onChange={setProviderCode} placeholder="AEDC" />
            <FormInput label="Meter number" value={meterNumber} onChange={setMeterNumber} placeholder="77777777777" />
            <Button
              className="w-full"
              icon={Plus}
              disabled={busy}
              onClick={() => void run(() => onAddMeter({ label, providerCode: providerCode.toUpperCase(), meterNumber: meterNumber.trim() }))}
            >
              Add meter
            </Button>
          </div>
        ) : null}

        {modal === 'calculator' ? (
          <ElectricityCalculator ratePerKwh={ratePerKwh} />
        ) : null}

        {modal === 'notifications' ? (
          <div className="space-y-3">
            {notifications.map((item) => (
              <div key={item.title} className="rounded-lg border border-zener-border bg-black/20 p-4">
                <p className="font-bold">{item.title}</p>
                <p className="mt-1 text-sm text-white/55">{item.message}</p>
                <p className="mt-2 text-xs text-zener-gold">{item.time}</p>
              </div>
            ))}
          </div>
        ) : null}
        {message ? <p className="mt-4 rounded-md border border-zener-gold/30 bg-zener-panel px-3 py-2 text-sm font-bold text-zener-gold">{message}</p> : null}
      </Card>
    </div>
  );
}

function ElectricityCalculator({ ratePerKwh }: { ratePerKwh: number }) {
  const [input, setInput] = useState('0');
  const [editingKwh, setEditingKwh] = useState(true);

  const baseValue = Number(input) || 0;
  const kwhValue = editingKwh ? baseValue : baseValue / ratePerKwh;
  const nairaValue = editingKwh ? baseValue * ratePerKwh : baseValue;
  const daysAtAverageUse = kwhValue > 0 ? kwhValue / 8 : 0;

  const onKeyTap = (value: string) => {
    setInput((current) => {
      if (value === 'C') return '0';
      if (value === 'DEL') return current.length <= 1 ? '0' : current.slice(0, -1);
      if (value === '.' && current.includes('.')) return current;
      if (current === '0' && value !== '.') return value;
      return `${current}${value}`;
    });
  };

  const keypadRows = [
    ['C', 'DEL', '.'],
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', ''],
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-zener-border bg-black/30 p-4 text-right">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/35">
          Enter {editingKwh ? 'kWh' : 'Naira'}
        </p>
        <p className="mt-2 break-all text-5xl font-light">{input}</p>
      </div>

      <div className="grid gap-3">
        <CalculatorResultTile
          label="kWh"
          value={kwhValue.toFixed(2)}
          active={editingKwh}
          onClick={() => setEditingKwh(true)}
        />
        <CalculatorResultTile
          label="Naira"
          value={formatCurrency(nairaValue)}
          active={!editingKwh}
          onClick={() => setEditingKwh(false)}
        />
      </div>

      <div className="grid gap-3 rounded-lg border border-zener-border bg-black/20 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/45">Rate</span>
          <span className="font-bold">1 kWh = {formatCurrency(ratePerKwh)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/45">Estimated household runtime</span>
          <span className="font-bold">{daysAtAverageUse.toFixed(1)} days at 8 kWh/day</span>
        </div>
      </div>

      <div className="space-y-2">
        {keypadRows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-3 gap-3">
            {row.map((key, keyIndex) =>
              key ? (
                <button
                  key={key}
                  onClick={() => onKeyTap(key)}
                  className={`aspect-square rounded-full text-xl font-bold transition ${
                    key === 'C'
                      ? 'bg-zener-gold text-black hover:brightness-110'
                      : 'bg-white/[0.06] text-white hover:bg-white/[0.1]'
                  }`}
                >
                  {key}
                </button>
              ) : (
                <span key={`empty-${keyIndex}`} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalculatorResultTile({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
        active ? 'border-zener-gold bg-white/[0.06]' : 'border-zener-border bg-white/[0.03]'
      }`}
    >
      <span className="text-sm font-bold text-white/60">{label}</span>
      <span className="text-2xl font-medium">{value}</span>
    </button>
  );
}

function AmountForm({ amount, setAmount, submitLabel, onSubmit, busy = false }: { amount: string; setAmount: (value: string) => void; submitLabel: string; onSubmit: () => void; busy?: boolean }) {
  return (
    <div className="space-y-4">
      <FormInput label="Amount (₦)" value={amount} onChange={setAmount} placeholder="5000" type="number" />
      <Button className="w-full" icon={CheckCircle2} disabled={busy} onClick={onSubmit}>{busy ? 'Processing…' : submitLabel}</Button>
    </div>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zener-border bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-white/35">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-zener-border bg-white/[0.03] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-zener-gold"
      />
    </label>
  );
}
