import logo from '../../assets/logo-icon-white.svg';
import { useBrand } from '../../lib/brand';

export function AppLogo({ size = 38 }: { size?: number }) {
  const brand = useBrand();
  return <img src={brand.logo_url || logo} alt={brand.display_name} style={{ width: size, height: size }} className="shrink-0" />;
}
