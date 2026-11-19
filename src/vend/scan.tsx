import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { ImageUp, Loader2, X } from "lucide-react";
import type { Prefill } from "./links";
import { giftCode, readPrefill, requestCode } from "./links";

export type ScanResult =
  | NonNullable<Prefill>
  | { meter: string }
  | { request: string }
  | { gift: string };

// A scanned QR: a payment request (…/pay/CODE), our buy link (…/buy?disco=AEDC&meter=…), or a bare meter number.
export function parseMeterQr(text: string): ScanResult | null {
  const t = text.trim();
  try {
    const u = new URL(t);
    const code = requestCode(u.pathname);
    if (code) return { request: code };
    const gift = giftCode(u.pathname);
    if (gift) return { gift };
    return readPrefill(u.searchParams);
  } catch {
    const digits = t.replace(/\D/g, "");
    return digits.length >= 10 &&
      digits.length <= 13 &&
      digits.length === t.replace(/\s/g, "").length
      ? { meter: digits }
      : null;
  }
}

// decodeImage reads a QR code from a picture (a screenshot or a photo of a sticker).
// Photos are tried at a few sizes: jsQR misses small codes in huge images.
export async function decodeImage(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    const g = canvas.getContext("2d", { willReadFrequently: true })!;
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    for (const target of [1200, 800, 1800, 500]) {
      const scale = Math.min(1, target / longest);
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      g.fillStyle = "#fff";
      g.fillRect(0, 0, canvas.width, canvas.height); // transparent PNGs scan as white, not black
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      const code = jsQR(
        g.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
        { inversionAttempts: "attemptBoth" },
      );
      if (code?.data) return code.data;
      if (scale === 1) break;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ScanDialog opens the back camera and reads a meter QR code, or reads one
// from an uploaded picture.
export function ScanDialog({
  onResult,
  onClose,
}: {
  onResult: (r: ScanResult) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(
    "Point the camera at a meter QR or a payment request.",
  );
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  const upload = async (file?: File) => {
    if (!file) return;
    setReading(true);
    const text = await decodeImage(file);
    setReading(false);
    const r = text ? parseMeterQr(text) : null;
    if (r) {
      doneRef.current = true;
      onResult(r);
      return;
    }
    setHint(
      text
        ? "That QR code is not a Zenerlink meter or payment request."
        : "No QR code found in that picture. Try a clearer or closer one.",
    );
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement("canvas");
    const g = canvas.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      const v = video.current;
      if (done || doneRef.current || !v || !g) return;
      if (v.readyState >= 2 && v.videoWidth) {
        // Scan a downscaled frame: fast enough on older phones.
        const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        g.drawImage(v, 0, 0, canvas.width, canvas.height);
        const code = jsQR(
          g.getImageData(0, 0, canvas.width, canvas.height).data,
          canvas.width,
          canvas.height,
          { inversionAttempts: "dontInvert" },
        );
        if (code?.data) {
          const r = parseMeterQr(code.data);
          if (r) {
            done = true;
            if (navigator.vibrate) navigator.vibrate(60);
            onResult(r);
            return;
          }
          setHint("That QR code is not a Zenerlink meter or payment request.");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot use the camera.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (done) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        raf = requestAnimationFrame(tick);
      } catch {
        setError(
          "Camera access is blocked or there is no camera. Allow it in your browser settings to scan.",
        );
      }
    })();
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-zener-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-bold">Scan or upload QR</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/50 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        {error ? (
          <p className="rounded-lg bg-zener-danger/10 px-3.5 py-3 text-sm text-zener-danger">
            {error}
          </p>
        ) : (
          <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
            <video
              ref={video}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-zener-gold/80" />
          </div>
        )}
        <p className="mt-3 text-center text-sm text-white/55">
          {error ? "You can still upload a picture of the QR code." : hint}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={reading}
          onClick={() => fileRef.current?.click()}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold transition hover:bg-white/[0.12] disabled:opacity-50"
        >
          {reading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ImageUp size={16} />
          )}{" "}
          {reading ? "Reading picture…" : "Upload QR image"}
        </button>
      </div>
    </div>
  );
}
