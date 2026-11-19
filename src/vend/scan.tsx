import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X } from 'lucide-react';
import type { Prefill } from './links';
import { readPrefill } from './links';

// A scanned meter QR: our buy link (…/buy?disco=AEDC&meter=…), or a bare meter number.
export function parseMeterQr(text: string): Prefill | { meter: string } | null {
  const t = text.trim();
  try {
    const u = new URL(t);
    return readPrefill(u.searchParams);
  } catch {
    const digits = t.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13 && digits.length === t.replace(/\s/g, '').length ? { meter: digits } : null;
  }
}

// ScanDialog opens the back camera and reads a meter QR code.
export function ScanDialog({ onResult, onClose }: { onResult: (r: Prefill | { meter: string }) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('Point the camera at the meter QR code.');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const tick = () => {
      const v = video.current;
      if (done || !v || !g) return;
      if (v.readyState >= 2 && v.videoWidth) {
        // Scan a downscaled frame: fast enough on older phones.
        const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        g.drawImage(v, 0, 0, canvas.width, canvas.height);
        const code = jsQR(g.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const r = parseMeterQr(code.data);
          if (r) {
            done = true;
            if (navigator.vibrate) navigator.vibrate(60);
            onResult(r);
            return;
          }
          setHint('That QR code is not a meter code.');
        }
      }
      raf = requestAnimationFrame(tick);
    };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use the camera. Scan the code with your phone camera instead, or type the meter number.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (done) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        raf = requestAnimationFrame(tick);
      } catch {
        setError('Camera access was blocked. Allow the camera for this site in your browser settings, or type the meter number.');
      }
    })();
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-zener-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-bold">Scan meter QR</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>
        {error ? (
          <p className="rounded-lg bg-zener-danger/10 px-3.5 py-3 text-sm text-zener-danger">{error}</p>
        ) : (
          <>
            <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
              <video ref={video} playsInline muted className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-zener-gold/80" />
            </div>
            <p className="mt-3 text-center text-sm text-white/55">{hint}</p>
          </>
        )}
      </div>
    </div>
  );
}
