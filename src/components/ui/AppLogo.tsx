import logo from '../../assets/logo-icon-white.svg';
import { useBrand } from '../../lib/brand';

export function AppLogo({ size = 38 }: { size?: number }) {
  const brand = useBrand();
  return <img src={brand.logo_url || logo} alt={brand.display_name} style={{ width: size, height: size }} className="shrink-0" />;
}

// The Zenerlink mark is the "Z" of the name: logo + "ENERLINK". A white-label
// brand with its own logo or another name gets logo + full name instead.
export function Wordmark({ fontSize = 14, className = '' }: { fontSize?: number; className?: string }) {
  const brand = useBrand();
  const name = brand.display_name.toUpperCase();
  const merged = !brand.logo_url && name.startsWith('Z');
  const mark = Math.round(fontSize * (merged ? 0.78 : 1.6));
  return (
    <span className={`inline-flex items-center font-black tracking-[0.3em] ${className}`} style={{ fontSize }} aria-label={brand.display_name}>
      <img src={brand.logo_url || logo} alt="" style={{ width: mark, height: mark, marginRight: merged ? '0.3em' : '0.75em' }} className="shrink-0" />
      <span aria-hidden="true">{merged ? name.slice(1) : name}</span>
    </span>
  );
}
