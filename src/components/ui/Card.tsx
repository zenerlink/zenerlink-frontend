import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
  accent?: boolean;
};

export function Card({ children, className = '', accent = false }: CardProps) {
  return (
    <section
      className={`rounded-lg border bg-white/[0.035] shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur ${
        accent ? 'border-zener-gold/40 bg-zener-panel/80' : 'border-zener-border'
      } ${className}`}
    >
      {children}
    </section>
  );
}
