import logo from '../../assets/logo-icon-white.svg';

export function AppLogo({ size = 38 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-lg border border-zener-gold/25 bg-zener-gold/10"
      style={{ width: size + 14, height: size + 14 }}
    >
      <img src={logo} alt="Zenerlink" style={{ width: size, height: size }} />
    </div>
  );
}
