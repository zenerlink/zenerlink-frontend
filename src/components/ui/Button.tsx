import type { ButtonHTMLAttributes, ElementType } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ElementType;
};

export function Button({ variant = 'primary', icon: Icon, className = '', children, ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-zener-gold text-black hover:bg-[#d9964f]',
    secondary: 'border border-zener-border bg-white/[0.03] text-white hover:border-zener-gold/50',
    ghost: 'text-white/65 hover:bg-white/[0.04] hover:text-white',
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition ${styles[variant]} ${className}`}
      {...props}
    >
      {Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}
