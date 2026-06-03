import { useEffect, useMemo, useState } from 'react';
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
import { AppLogo } from './components/ui/AppLogo';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { historySeed, metersSeed, notificationsSeed, recipientsSeed } from './data/mockData';
import { formatCurrency, generateToken } from './lib/format';
import type { HistoryItem, MeterRecord, PaymentMethod, PendingToken, RecentRecipient } from './types';

type Session = { email: string; phone: string };
type ModalName = 'fund' | 'buy' | 'share' | 'addMeter' | 'calculator' | 'notifications' | null;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activePage, setActivePage] = useState<ZenerPage>('home');
  const [modal, setModal] = useState<ModalName>(null);
  const [walletBalance, setWalletBalance] = useState(25_000);
  const [meters, setMeters] = useState<MeterRecord[]>(metersSeed);
  const [selectedMeterId, setSelectedMeterId] = useState(metersSeed[0].id);
  const [history, setHistory] = useState<HistoryItem[]>(historySeed);
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>(recipientsSeed);
  const [pendingTokens, setPendingTokens] = useState<Record<string, PendingToken>>({});
  const [suggestedToken, setSuggestedToken] = useState<string | null>(null);
  const [quickShareRecipient, setQuickShareRecipient] = useState<RecentRecipient | null>(null);

  const selectedMeter = useMemo(
    () => meters.find((meter) => meter.id === selectedMeterId) ?? meters[0],
    [meters, selectedMeterId],
  );

  const addHistory = (item: HistoryItem) => setHistory((items) => [item, ...items]);

  const updateMeter = (meterId: string, updater: (meter: MeterRecord) => MeterRecord) => {
    setMeters((items) => items.map((meter) => (meter.id === meterId ? updater(meter) : meter)));
  };

  const fundWallet = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    setWalletBalance((value) => value + amount);
    addHistory({
      title: 'Wallet funded',
      subtitle: 'Zenerlink MFB transfer',
      amount: `+${formatCurrency(amount)}`,
      accent: '#0DF020',
    });
    setModal(null);
    return true;
  };

  const buyElectricity = (amount: number, paymentMethod: PaymentMethod) => {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (paymentMethod === 'wallet' && amount > walletBalance) return null;
    if (paymentMethod === 'wallet') setWalletBalance((value) => value - amount);
    const token = generateToken();
    const kwhAmount = amount / 200;
    setPendingTokens((tokens) => ({
      ...tokens,
      [token]: { meterNumber: selectedMeter.meterNumber, kwhAmount, source: 'purchase' },
    }));
    setSuggestedToken(token);
    addHistory({
      title: 'Electricity purchase',
      subtitle: `${selectedMeter.providerCode} ${selectedMeter.meterType} meter`,
      amount: `-${formatCurrency(amount)}`,
      accent: '#C8823A',
    });
    setActivePage('diu');
    setModal(null);
    return token;
  };

  const redeemToken = (token: string) => {
    const credit = pendingTokens[token];
    if (!credit || credit.meterNumber !== selectedMeter.meterNumber) return false;
    updateMeter(selectedMeter.id, (meter) => ({ ...meter, kwhReserve: meter.kwhReserve + credit.kwhAmount }));
    setPendingTokens(({ [token]: _removed, ...rest }) => rest);
    if (suggestedToken === token) setSuggestedToken(null);
    addHistory({
      title: credit.source === 'share' ? 'Spark Share token redeemed' : 'DIU credit delivered',
      subtitle: credit.note ? `${selectedMeter.label} meter • ${credit.note}` : `${selectedMeter.label} meter`,
      amount: `+${credit.kwhAmount.toFixed(1)} kWh`,
      accent: '#0DF020',
    });
    return true;
  };

  const shareUnits = (meterNumber: string, amount: number, note: string) => {
    if (!meterNumber.trim() || !Number.isFinite(amount) || amount <= 0 || amount > selectedMeter.kwhReserve) return false;
    updateMeter(selectedMeter.id, (meter) => ({ ...meter, kwhReserve: meter.kwhReserve - amount }));
    setMeters((items) =>
      items.map((meter) =>
        meter.meterNumber === meterNumber ? { ...meter, kwhReserve: meter.kwhReserve + amount } : meter,
      ),
    );
    addHistory({
      title: 'Units shared',
      subtitle: `${meterNumber} • ${note || 'No note'}`,
      amount: `-${amount.toFixed(1)} kWh`,
      accent: '#ffffff',
    });
    const name = meters.find((meter) => meter.meterNumber === meterNumber)?.label ?? (note || 'Recipient');
    setRecentRecipients((items) => [
      { name, meterNumber, lastNote: note || 'Direct transfer', lastAmount: amount, lastShared: 'Now' },
      ...items.filter((item) => item.meterNumber !== meterNumber),
    ].slice(0, 5));
    setModal(null);
    setQuickShareRecipient(null);
    return true;
  };

  const generateShareToken = (meterNumber: string, amount: number, note: string, recipientName: string) => {
    if (!meterNumber.trim() || !Number.isFinite(amount) || amount <= 0 || amount > selectedMeter.kwhReserve) return null;
    const token = generateToken();
    updateMeter(selectedMeter.id, (meter) => ({ ...meter, kwhReserve: meter.kwhReserve - amount }));
    setPendingTokens((tokens) => ({
      ...tokens,
      [token]: { meterNumber, kwhAmount: amount, source: 'share', note },
    }));
    addHistory({
      title: 'Spark Share token generated',
      subtitle: `${meterNumber} • ${note || recipientName || 'Recipient'}`,
      amount: `-${amount.toFixed(1)} kWh`,
      accent: '#C8823A',
    });
    setRecentRecipients((items) => [
      {
        name: recipientName || note || 'Recipient',
        meterNumber,
        lastNote: note || 'Token transfer',
        lastAmount: amount,
        lastShared: 'Now',
      },
      ...items.filter((item) => item.meterNumber !== meterNumber),
    ].slice(0, 5));
    setSuggestedToken(token);
    return token;
  };

  const addMeter = (meter: MeterRecord) => {
    if (!meter.meterNumber.trim() || !meter.label.trim() || !meter.providerCode.trim()) return false;
    setMeters((items) => [...items, meter]);
    setSelectedMeterId(meter.id);
    addHistory({
      title: 'Meter added',
      subtitle: `${meter.label} • ${meter.meterNumber}`,
      amount: meter.providerCode,
      accent: '#0DF020',
    });
    setModal(null);
    return true;
  };

  const openShareModal = (recipient?: RecentRecipient) => {
    setQuickShareRecipient(recipient ?? null);
    setModal('share');
  };

  if (!session) {
    return <AuthScreen onAuthenticated={setSession} />;
  }

  return (
    <AppShell activePage={activePage} onPageChange={setActivePage} onLogout={() => setSession(null)}>
      {activePage === 'home' ? (
        <HomePage
          meters={meters}
          selectedMeter={selectedMeter}
          walletBalance={walletBalance}
          recentRecipients={recentRecipients}
          onSelectMeter={setSelectedMeterId}
          onOpenModal={setModal}
          onQuickShare={openShareModal}
          onRemoveRecipient={(recipient) =>
            setRecentRecipients((items) => items.filter((item) => item.meterNumber !== recipient.meterNumber))
          }
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
        <ProfilePage email={session.email} phone={session.phone} meters={meters} history={history} />
      ) : null}

      <ActionModals
        modal={modal}
        selectedMeter={selectedMeter}
        ownMeters={meters.filter((meter) => meter.id !== selectedMeter.id)}
        quickRecipient={quickShareRecipient}
        walletBalance={walletBalance}
        notifications={notificationsSeed}
        onClose={() => {
          setModal(null);
          setQuickShareRecipient(null);
        }}
        onFundWallet={fundWallet}
        onBuyElectricity={buyElectricity}
        onShareUnits={shareUnits}
        onGenerateShareToken={generateShareToken}
        onAddMeter={addMeter}
      />
    </AppShell>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md border-transparent bg-transparent p-6 shadow-none sm:p-8">
        <AppLogo size={44} />
        <h1 className="mt-6 text-3xl font-black tracking-[0.24em]">ZENERLINK</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">Fast electricity management for every meter you own.</p>
        <div className="mt-8 grid grid-cols-2 gap-2">
          {['Login', 'Sign Up'].map((label) => {
            const selected = isLogin === (label === 'Login');
            return (
              <button
                key={label}
                onClick={() => setIsLogin(label === 'Login')}
                className={`rounded-md py-3 text-sm font-bold ${selected ? 'bg-zener-gold text-black' : 'bg-white/10 text-white'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-5 space-y-3">
          {!isLogin ? <FormInput label="Phone" value={phone} onChange={setPhone} placeholder="+234 801 234 5678" /> : null}
          <FormInput label="Email" value={email} onChange={setEmail} placeholder="myke@zenerlink.app" />
          <FormInput label="Password" value="" onChange={() => undefined} placeholder="••••••••" type="password" />
          {!isLogin ? <FormInput label="Confirm password" value="" onChange={() => undefined} placeholder="••••••••" type="password" /> : null}
        </div>
        <Button
          className="mt-6 w-full"
          onClick={() => onAuthenticated({ email: email || 'myke@zenerlink.app', phone: phone || '+234 801 234 5678' })}
        >
          {isLogin ? 'Login' : 'Sign Up'}
        </Button>
      </Card>
    </main>
  );
}

function HomePage({
  meters,
  selectedMeter,
  walletBalance,
  recentRecipients,
  onSelectMeter,
  onOpenModal,
  onQuickShare,
  onRemoveRecipient,
}: {
  meters: MeterRecord[];
  selectedMeter: MeterRecord;
  walletBalance: number;
  recentRecipients: RecentRecipient[];
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
                <p className="font-bold">{notificationsSeed[0].title}</p>
                <p className="mt-1 text-sm leading-6 text-white/55">{notificationsSeed[0].message}</p>
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
        <MiniHistory selectedMeter={selectedMeter} />
      </div>
    </div>
  );
}

function MiniHistory({ selectedMeter }: { selectedMeter: MeterRecord }) {
  return (
    <Card className="p-5">
      <h3 className="font-black">Today’s power view</h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ['Reserve', `${selectedMeter.kwhReserve.toFixed(1)} kWh`, Gauge],
          ['Rate', 'NGN 200/kWh', CreditCard],
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
  const daily = [38, 46, 42, 58, 63, 51, 67];
  return (
    <div className="grid gap-5 pb-20 lg:grid-cols-[1fr_360px] lg:pb-0">
      <Card className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-zener-gold">Consumption</p>
        <h2 className="mt-1 text-2xl font-black">{selectedMeter.label} energy trend</h2>
        <div className="mt-8 flex h-72 items-end gap-3 rounded-lg border border-zener-border bg-black/25 p-4">
          {daily.map((value, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-3">
              <div className="w-full rounded-t-md bg-gradient-to-t from-zener-gold to-[#f2b56e]" style={{ height: `${value}%` }} />
              <span className="text-xs text-white/40">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-black">Time breakdown</h3>
        <div className="mt-5 space-y-4">
          {[
            ['Peak hours', 42],
            ['Day usage', 33],
            ['Night usage', 25],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="mb-2 flex justify-between text-sm"><span>{label as string}</span><span>{value as number}%</span></div>
              <div className="h-2 rounded-md bg-white/10"><div className="h-2 rounded-md bg-zener-gold" style={{ width: `${value}%` }} /></div>
            </div>
          ))}
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
  onRedeem: (token: string) => boolean;
}) {
  const [token, setToken] = useState(suggestedToken ?? '');
  const [message, setMessage] = useState('');
  const matchingTokens = Object.entries(pendingTokens).filter(
    ([, credit]) => credit.meterNumber === selectedMeter.meterNumber,
  );

  useEffect(() => {
    if (suggestedToken) setToken(suggestedToken);
  }, [suggestedToken]);

  const handleRedeem = (value: string) => {
    const ok = onRedeem(value.trim());
    setMessage(ok ? 'Token delivered successfully.' : 'Token is invalid for this meter.');
    if (ok) setToken('');
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
        <FormInput label="Token" value={token} onChange={setToken} placeholder="1234-5678-9012-3456" />
      </div>
      <Button
        className="mt-5 w-full"
        icon={Zap}
        onClick={() => handleRedeem(token)}
      >
        Send to DIU
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

function ProfilePage({ email, phone, meters, history }: { email: string; phone: string; meters: MeterRecord[]; history: HistoryItem[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Card className="p-5" accent>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-zener-gold/40 bg-zener-gold/10 text-2xl font-black">M</div>
          <div>
            <h2 className="text-2xl font-black">Myke Daniels</h2>
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
  onClose,
  onFundWallet,
  onBuyElectricity,
  onShareUnits,
  onGenerateShareToken,
  onAddMeter,
}: {
  modal: ModalName;
  selectedMeter: MeterRecord;
  ownMeters: MeterRecord[];
  quickRecipient: RecentRecipient | null;
  walletBalance: number;
  notifications: typeof notificationsSeed;
  onClose: () => void;
  onFundWallet: (amount: number) => boolean;
  onBuyElectricity: (amount: number, paymentMethod: PaymentMethod) => string | null;
  onShareUnits: (meterNumber: string, amount: number, note: string) => boolean;
  onGenerateShareToken: (meterNumber: string, amount: number, note: string, recipientName: string) => string | null;
  onAddMeter: (meter: MeterRecord) => boolean;
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
            onSubmit={() => {
              const ok = onFundWallet(parsedAmount);
              if (!ok) setMessage('Enter a valid funding amount.');
            }}
          />
        ) : null}

        {modal === 'buy' ? (
          <div className="space-y-4">
            <p className="text-sm text-white/55">Buying for {selectedMeter.providerName}. Wallet balance: {formatCurrency(walletBalance)}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['wallet', 'bankTransfer', 'card', 'crypto'] as PaymentMethod[]).map((item) => (
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
              onSubmit={() => {
                const token = onBuyElectricity(parsedAmount, method);
                if (!token) {
                  setMessage(method === 'wallet' ? 'Wallet balance is too low or amount is invalid.' : 'Enter a valid purchase amount.');
                }
              }}
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
              onClick={() => {
                if (shareMode === 'direct') {
                  const ok = onShareUnits(meterNumber.trim(), parsedAmount, note.trim());
                  if (!ok) setMessage('Check recipient meter, amount, and available reserve.');
                  return;
                }
                const token = onGenerateShareToken(meterNumber.trim(), parsedAmount, note.trim(), recipientName.trim());
                if (!token) {
                  setMessage('Check recipient meter, amount, and available reserve.');
                  return;
                }
                setGeneratedToken(token);
                setMessage('Spark Share token generated. Send it to the recipient for DIU redemption.');
              }}
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
              onClick={() => {
                const ok = onAddMeter({
                  id: crypto.randomUUID(),
                  label,
                  providerCode,
                  providerName: `${providerCode} Electricity`,
                  meterNumber,
                  customerName: 'Myke Daniels',
                  address: 'New service address',
                  meterType: 'prepaid',
                  kwhReserve: 0,
                });
                if (!ok) setMessage('Enter a label, provider code, and meter number.');
              }}
            >
              Add meter
            </Button>
          </div>
        ) : null}

        {modal === 'calculator' ? (
          <div className="space-y-4">
            <AmountForm amount={amount} setAmount={setAmount} submitLabel="Calculate" onSubmit={() => undefined} />
            <div className="rounded-lg border border-zener-border bg-black/25 p-4">
              <p className="text-sm text-white/45">Estimated units</p>
              <p className="mt-1 text-3xl font-black text-zener-gold">{(Number(amount) / 200 || 0).toFixed(1)} kWh</p>
            </div>
          </div>
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

function AmountForm({ amount, setAmount, submitLabel, onSubmit }: { amount: string; setAmount: (value: string) => void; submitLabel: string; onSubmit: () => void }) {
  return (
    <div className="space-y-4">
      <FormInput label="Amount" value={amount} onChange={setAmount} placeholder="5000" type="number" />
      <Button className="w-full" icon={CheckCircle2} onClick={onSubmit}>{submitLabel}</Button>
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
