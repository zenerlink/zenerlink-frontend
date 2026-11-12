import logo from '../../assets/logo-icon-white.svg';
import { useBrand } from '../../lib/brand';

export function AppLogo({ size = 38 }: { size?: number }) {
  const brand = useBrand();
  return (
    <div
      className="grid place-items-center rounded-lg border border-zener-gold/25 bg-zener-gold/10"
      style={{ width: size + 14, height: size + 14 }}
    >
      <img src={brand.logo_url || logo} alt={brand.display_name} style={{ width: size, height: size }} />
    </div>
  );
}
