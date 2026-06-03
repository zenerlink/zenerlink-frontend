import type { ElementType, ReactNode } from 'react';
import { Activity, Home, LayoutGrid, LogOut, Repeat, UserRound } from 'lucide-react';
import { AppLogo } from '../ui/AppLogo';
import { Button } from '../ui/Button';
import { StatusDot } from '../ui/StatusDot';

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
  children: ReactNode;
};

export function AppShell({ activePage, onPageChange, onLogout, children }: AppShellProps) {
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
            <h1 className="text-xl font-black">Hello Myke</h1>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status="lightOn" />
            <Button variant="ghost" icon={LogOut} onClick={onLogout} className="hidden sm:inline-flex">
              Logout
            </Button>
          </div>
        </header>

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
