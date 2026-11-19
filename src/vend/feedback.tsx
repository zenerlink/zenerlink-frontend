import { useEffect, useState } from 'react';
import { Check, Loader2, Star, X } from 'lucide-react';
import { feedback } from '../lib/api';
import { card, inputCls } from './kit';

// Customer feedback: stars after a purchase, and now and then "would you
// recommend us". The server decides when to ask, so nobody is nagged.

const STAR_WORDS = ['', 'Bad', 'Not great', 'Okay', 'Good', 'Excellent'];

export function PurchaseFeedback({ orderId }: { orderId: string }) {
  const [ask, setAsk] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    feedback
      .prompt(orderId)
      .then((r) => setAsk(r.ask === 'purchase'))
      .catch(() => undefined);
  }, [orderId]);
  if (!ask) return null;

  const send = async (r: number | null) => {
    setBusy(true);
    try {
      await feedback.send({ kind: 'purchase', order_id: orderId, rating: r, comment: r ? comment.trim() : '' });
    } catch {
      /* feedback is best effort */
    }
    setBusy(false);
    if (r) setDone(true);
    else setAsk(false);
  };

  if (done) {
    return (
      <p className={`${card} flex items-center justify-center gap-2 p-4 text-sm text-white/70`}>
        <Check size={16} className="text-zener-success" /> Thanks for telling us.
      </p>
    );
  }
  return (
    <section className={`${card} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold">How was this purchase?</p>
        <button type="button" onClick={() => void send(null)} disabled={busy} className="text-xs font-semibold text-white/40 hover:text-white">
          Not now
        </button>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} type="button" aria-label={`${s} star${s > 1 ? 's' : ''}`} onClick={() => setRating(s)} className="p-1">
            <Star size={30} className={s <= rating ? 'fill-zener-gold text-zener-gold' : 'text-white/20 hover:text-white/40'} />
          </button>
        ))}
        {rating ? <span className="ml-2 text-sm text-white/55">{STAR_WORDS[rating]}</span> : null}
      </div>
      {rating ? (
        <div className="mt-3 space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 2000))}
            rows={2}
            placeholder={rating <= 3 ? 'What went wrong? It helps us fix it.' : 'Anything we could do better? (optional)'}
            className={`${inputCls} h-auto py-3 text-sm`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(rating)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Send feedback
          </button>
        </div>
      ) : null}
    </section>
  );
}

const SEEN_KEY = 'zenerlink.feedback.checked';

// PeriodicFeedback asks "would you recommend us" in a bottom sheet, at most
// once a session and only when the server says it's time.
export function PeriodicFeedback() {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* no storage: ask at most once per page load */
    }
    const t = window.setTimeout(() => {
      feedback
        .prompt()
        .then((r) => setOpen(r.ask === 'periodic'))
        .catch(() => undefined);
    }, 20000);
    return () => window.clearTimeout(t);
  }, []);
  if (!open) return null;

  const send = async (s: number | null) => {
    setBusy(true);
    try {
      await feedback.send({ kind: 'periodic', rating: s, comment: s === null ? '' : comment.trim() });
    } catch {
      /* best effort */
    }
    setBusy(false);
    if (s === null) setOpen(false);
    else {
      setDone(true);
      window.setTimeout(() => setOpen(false), 1800);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-6 sm:left-auto sm:right-6 sm:w-[400px] sm:p-0">
      <div role="dialog" aria-label="Feedback" className="rounded-2xl border border-white/[0.1] bg-[rgb(var(--zener-surface))] p-5 shadow-2xl">
        {done ? (
          <p className="flex items-center gap-2 text-sm text-white/75">
            <Check size={16} className="text-zener-success" /> Thank you, that helps a lot.
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold">How likely are you to recommend Zenerlink to a friend?</p>
              <button type="button" onClick={() => void send(null)} aria-label="Not now" className="-mr-1 -mt-1 rounded-lg p-1 text-white/40 hover:text-white">
                <X size={17} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScore(i)}
                  className={`h-9 rounded-md text-xs font-bold transition ${score === i ? 'bg-zener-gold text-black' : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.12]'}`}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-white/35">
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
            {score !== null ? (
              <div className="mt-4 space-y-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 2000))}
                  rows={2}
                  placeholder={score <= 6 ? 'What would make it better?' : 'What do you like most? (optional)'}
                  className={`${inputCls} h-auto py-3 text-sm`}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send(score)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zener-gold text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null} Send
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
