'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ShopToastEventDetail, ShopToastTone } from '@/lib/shopToasts';

type VisibleToast = ShopToastEventDetail;
const EVENT_NAME = 'shopsphere:toast';

const toneStyles: Record<ShopToastTone, { icon: typeof CheckCircle2; iconClass: string; accent: string }> = {
  success: { icon: CheckCircle2, iconClass: 'text-emerald-700', accent: 'border-emerald-200' },
  error: { icon: XCircle, iconClass: 'text-rose-700', accent: 'border-rose-200' },
  info: { icon: Info, iconClass: 'text-sky-700', accent: 'border-sky-200' },
};

export default function ToastViewport() {
  const [toasts, setToasts] = useState<VisibleToast[]>([]);
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    const activeTimers = timers.current;
    function removeToast(id: string) {
      const timer = timers.current.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      timers.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }

    function handleToast(event: Event) {
      const detail = (event as CustomEvent<VisibleToast>).detail;
      if (!detail || typeof detail.id !== 'string' || !detail.title) return;
      setToasts((current) => [...current.filter((toast) => toast.id !== detail.id), detail].slice(-3));
      const timer = window.setTimeout(() => removeToast(detail.id), Math.max(1800, Math.min(detail.duration ?? 4200, 10000)));
      timers.current.set(detail.id, timer);
    }

    window.addEventListener(EVENT_NAME, handleToast);
    return () => {
      window.removeEventListener(EVENT_NAME, handleToast);
      activeTimers.forEach((timer) => window.clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[120] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-5" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => {
        const tone = toneStyles[toast.tone ?? 'success'];
        const Icon = tone.icon;
        return (
          <article key={toast.id} role="status" className={`pointer-events-auto animate-rise-in overflow-hidden rounded-2xl border ${tone.accent} bg-white shadow-[0_16px_48px_rgba(24,35,29,.18)]`}>
            <div className="flex items-start gap-3 p-4">
              <Icon size={22} className={`mt-0.5 shrink-0 ${tone.iconClass}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{toast.title}</p>
                {toast.message && <p className="mt-1 text-xs leading-5 text-ink/60">{toast.message}</p>}
                {toast.actionLabel && toast.actionHref && (
                  <Link href={toast.actionHref} className="mt-2 inline-flex text-xs font-bold text-moss underline decoration-moss/40 underline-offset-4">
                    {toast.actionLabel}
                  </Link>
                )}
              </div>
              <button type="button" onClick={() => {
                const timer = timers.current.get(toast.id);
                if (timer !== undefined) window.clearTimeout(timer);
                timers.current.delete(toast.id);
                setToasts((current) => current.filter((item) => item.id !== toast.id));
              }} aria-label="Dismiss notification" className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/40 transition hover:bg-ink/5 hover:text-ink">
                <X size={16}/>
              </button>
            </div>
            <div className="h-1 bg-cream"><div className="h-full w-full origin-left animate-[toast-progress_linear_forwards] bg-lime" style={{ animationDuration: `${toast.duration ?? 4200}ms` }}/></div>
          </article>
        );
      })}
    </div>
  );
}
