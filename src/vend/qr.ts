import QRCode from 'qrcode';
import logo from '../assets/logo-icon-white.svg';

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// A QR code with the Z mark in the middle. High error correction (30%)
// leaves room for the badge, which covers well under that.
export async function brandedQr(text: string, size = 480, markUrl: string = logo): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  await QRCode.toCanvas(c, text, { errorCorrectionLevel: 'H', margin: 1, width: size, color: { dark: '#0b0b0b', light: '#ffffff' } });
  const g = c.getContext('2d')!;
  const badge = Math.round(c.width * 0.22);
  const x = (c.width - badge) / 2;
  const r = badge * 0.18;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(x, x, badge, badge, r);
  g.fill();
  try {
    const mark = await loadImage(markUrl);
    // Tint the (white) mark dark so it reads on the white badge.
    const inner = Math.round(badge * 0.66);
    const t = document.createElement('canvas');
    t.width = inner;
    t.height = inner;
    const tg = t.getContext('2d')!;
    const ratio = mark.width && mark.height ? mark.width / mark.height : 1;
    const w = ratio >= 1 ? inner : inner * ratio;
    const h = ratio >= 1 ? inner / ratio : inner;
    tg.drawImage(mark, (inner - w) / 2, (inner - h) / 2, w, h);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = '#0b0b0b';
    tg.fillRect(0, 0, inner, inner);
    g.drawImage(t, x + (badge - inner) / 2, x + (badge - inner) / 2);
  } catch {
    /* plain badge if the mark cannot load */
  }
  return c;
}

export const brandedQrUrl = async (text: string, size?: number, markUrl?: string) => (await brandedQr(text, size, markUrl)).toDataURL('image/png');
