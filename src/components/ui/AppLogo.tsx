import logo from '../../assets/logo-icon-white.svg';
import { useBrand } from '../../lib/brand';

export function AppLogo({ size = 38 }: { size?: number }) {
  const brand = useBrand();
  return <img src={brand.logo_url || logo} alt={brand.display_name} style={{ width: size, height: size }} className="shrink-0" />;
}

// The Zenerlink wordmark is "ZNRLINK" with the logo as its Z. A white-label
// brand with its own logo or another name shows logo + name.
export const wordmarkRest = (displayName: string) => {
  const name = displayName.toUpperCase();
  if (!name.startsWith('Z')) return null;
  return name === 'ZENERLINK' ? 'NRLINK' : name.slice(1);
};

export function Wordmark({ fontSize = 14, className = '' }: { fontSize?: number; className?: string }) {
  const brand = useBrand();
  const rest = brand.logo_url ? null : wordmarkRest(brand.display_name);
  const mark = Math.round(fontSize * (rest ? 0.78 : 1.6));
  return (
    <span className={`inline-flex items-center font-black tracking-[0.3em] ${className}`} style={{ fontSize }} aria-label={brand.display_name}>
      <img src={brand.logo_url || logo} alt="" style={{ width: mark, height: mark, marginRight: rest ? '0.3em' : '0.75em' }} className="shrink-0" />
      <span aria-hidden="true">{rest ?? brand.display_name.toUpperCase()}</span>
    </span>
  );
}
