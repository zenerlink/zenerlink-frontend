import type { ElementType, ReactNode } from 'react';
import { Activity, Building2, ChevronDown, Home, LayoutGrid, LogOut, Repeat, UserRound, Wallet } from 'lucide-react';
import { AppLogo } from '../ui/AppLogo';
import { Button } from '../ui/Button';
import { StatusDot } from '../ui/StatusDot';
import { formatCurrency } from '../../lib/format';
import type { MeterRecord } from '../../types';

export type ZenerPage = 'home' | 'consumption' | 'diu' | 'exchange' | 'profile';

const nav: Array<{ id: ZenerPage; label: string; icon: ElementType }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'consumption', label: 'Consumption', icon: Activity },
  { id: 'diu', label: 'DIU', icon: LayoutGrid },
  { id: 'exchange', label: 'Exchange', icon: Repeat },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

type AppShellProps = {
  activePage: ZenerPage;
  onPageChange: (page: ZenerPage) => void;
  onLogout: () => void;
  clientEmail: string;
  clientName: string;
  walletBalance: number;
  selectedMeter: MeterRecord;
  metersCount: number;
  children: ReactNode;
};

export function AppShell({
  activePage,
  onPageChange,
  onLogout,
  clientEmail,
  clientName,
  walletBalance,
  selectedMeter,
  metersCount,
  children,
}: AppShellProps) {
  const initials = clientName
    .split(' ')
    .map((name) => name[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-zener-border bg-black/55 px-4 py-5 backdrop-blur lg:block">
        <div className="mb-8 flex items-center gap-3 px-2">
          <AppLogo size={28} />
          <div>
            <p className="text-sm font-black tracking-[0.28em]">ZENERLINK</p>
            <p className="text-xs text-white/42">Electricity OS</p>
          </div>
        </div>
        <div className="mb-5 rounded-lg border border-zener-border bg-white/[0.025] p-4 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-zener-gold/25 bg-zener-gold/12 text-lg font-black text-zener-gold">
            {initials}
          </div>
          <p className="mt-3 font-black">Hello, {clientName.split(' ')[0]}</p>
          <p className="mt-1 truncate text-xs text-white/45">{clientEmail}</p>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const selected = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-bold transition ${
                  selected
                    ? 'border border-zener-gold/40 bg-zener-gold/12 text-zener-gold'
                    : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zener-border bg-black/70 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <AppLogo size={24} />
            <span className="text-xs font-black tracking-[0.24em]">ZENERLINK</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">Client workspace</p>
            <h1 className="text-xl font-black">Hello {clientName.split(' ')[0]}</h1>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status="lightOn" />
            <Button variant="ghost" icon={LogOut} onClick={onLogout} className="hidden sm:inline-flex">
              Logout
            </Button>
          </div>
        </header>

        <div className="border-b border-zener-border bg-black/35 px-4 py-4 lg:px-8">
          <section className="rounded-lg border border-zener-border bg-zener-panel/55 px-4 py-3">
            <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_auto] xl:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-zener-gold/14 text-zener-gold">
                  <Building2 size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-black">{selectedMeter.providerName}</h2>
                    <span className="rounded-full border border-zener-gold/30 bg-zener-gold/10 px-2 py-0.5 text-xs font-bold text-zener-gold">
                      {selectedMeter.meterType}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-white/45">{selectedMeter.address}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                <div className="grid gap-3 sm:grid-cols-3">
                  <HeaderMetric icon={Wallet} label="Available" value={formatCurrency(walletBalance)} />
                  <HeaderMetric icon={Activity} label="Reserve" value={`${selectedMeter.kwhReserve.toFixed(1)} kWh`} />
                  <HeaderMetric icon={LayoutGrid} label="Meters" value={`${metersCount} active`} />
                </div>
                <button className="hidden h-10 w-10 shrink-0 place-items-center rounded-md border border-zener-border text-white/55 transition hover:border-zener-gold/50 hover:text-zener-gold xl:grid" aria-label="Account menu">
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="px-4 py-5 lg:px-8">{children}</div>

        <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-zener-border bg-black/88 backdrop-blur lg:hidden">
          {nav.map((item) => {
            const Icon = item.icon;
            const selected = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-bold ${
                  selected ? 'text-zener-gold' : 'text-white/35'
                }`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </main>
    </div>
  );
}

function HeaderMetric({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="min-w-[150px] rounded-md border border-zener-border bg-black/20 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/35">
        <Icon size={14} className="text-zener-gold" />
        {label}
      </div>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
