import type { PowerStatus } from '../../types';

const statusMap = {
  lightOn: ['bg-zener-success', 'Light on'],
  lowCurrent: ['bg-amber-400', 'Low current'],
  noLight: ['bg-red-400', 'No light'],
} satisfies Record<PowerStatus, [string, string]>;

export function StatusDot({ status }: { status: PowerStatus }) {
  const [color, label] = statusMap[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-zener-border bg-black/30 px-3 py-2 text-xs font-bold text-white/70">
      <span className={`h-2.5 w-2.5 rounded-full ${color} shadow-[0_0_18px_currentColor]`} />
      {label}
    </span>
  );
}
