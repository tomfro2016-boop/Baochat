'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Languages, Moon, Sun } from 'lucide-react';
import { Logo } from './ui';
import { useApp } from './Providers';

export default function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const { lang, setLang, theme, setTheme } = useApp();
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4 flex gap-1">
        <button className="icon-btn" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} aria-label="Language" title="Tiếng Việt / English">
          <Languages size={18} />
          <span className="ml-1 text-xs font-medium uppercase">{lang}</span>
        </button>
        <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo size={40} />
        </Link>
        <div className="card p-7 shadow-2xl shadow-black/20">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6 space-y-4">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
        <p className="mt-6 text-center text-xs text-muted">Baochat — Your Personal AI Universe</p>
      </motion.div>
    </main>
  );
}

export function GoogleButton({ label }: { label: string }) {
  return (
    <a href="/api/auth/google" className="btn-ghost w-full">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z" />
      </svg>
      {label}
    </a>
  );
}

export function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-line" />
      {text}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
