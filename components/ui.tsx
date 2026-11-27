'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from './Providers';
import { fmtCountdown } from '@/lib/client/util';

export function Logo({ size = 32, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="rgb(var(--primary))" />
        <path d="M10 10.5l6 5.5-6 5.5" fill="none" stroke="rgb(var(--on-primary))" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="18" y="20" width="5" height="2.4" rx="0.6" fill="rgb(var(--on-primary))" />
      </svg>
      {withText && <span className="text-base font-medium">Baochat</span>}
    </span>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={16} />;
}

export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} className="rounded-md object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-md bg-surface2 font-medium text-ink"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Đồng hồ đếm ngược dựa trên giờ của server (không phụ thuộc đồng hồ máy người dùng). */
export function useCountdown(resetAt: string | null | undefined, serverNow: string | undefined, onDone?: () => void) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!resetAt || !serverNow) {
      setMs(null);
      return;
    }
    const offset = Date.parse(serverNow) - Date.now();
    const target = Date.parse(resetAt);
    let fired = false;
    const tick = () => {
      const left = target - (Date.now() + offset);
      setMs(left);
      if (left <= 0 && !fired) {
        fired = true;
        setTimeout(() => onDone?.(), 1500);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetAt, serverNow]);
  return ms;
}

export function Countdown({ resetAt, serverNow, className = '' }: { resetAt: string | null; serverNow: string; className?: string }) {
  const { refresh } = useApp();
  const ms = useCountdown(resetAt, serverNow, refresh);
  return <span className={`tabular-nums ${className}`}>{ms === null ? '—' : fmtCountdown(ms)}</span>;
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{children}</div>;
}

export function OkNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{children}</div>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${checked ? 'bg-primary' : 'bg-surface2 border border-line'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[rgb(var(--on-primary))] transition-transform duration-150 ${checked ? 'translate-x-4' : 'translate-x-0 !bg-muted'}`} />
    </button>
  );
}

/** Khung trang nội dung (cuộn độc lập trong AppShell). */
export function Page({ title, subtitle, actions, children, wide = false }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={`mx-auto w-full px-4 py-8 sm:px-8 sm:py-10 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4 p-6">
      <h2 className="text-sm font-medium">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
