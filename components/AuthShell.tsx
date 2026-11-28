'use client';

import Link from 'next/link';
import { Languages, Moon, Sun } from 'lucide-react';
import { Logo } from './ui';
import { useApp } from './Providers';
import DotField from './fx/DotField';
import Magnetic from './fx/Magnetic';
import Scramble from './fx/Scramble';

export default function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const { lang, setLang, theme, setTheme } = useApp();
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Cột trái: một đoạn hội thoại mẫu, đủ để nhận ra đây là chat AI */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface px-12 py-10 lg:flex">
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_30%_60%,black,transparent)]">
          <DotField />
        </div>
        <Magnetic className="relative self-start">
          <Link href="/">
            <Logo size={28} />
          </Link>
        </Magnetic>
        <div className="relative space-y-6">
          <div className="ml-auto max-w-[80%] animate-rise rounded-md border border-line bg-bg px-4 py-3 text-sm">{lang === 'vi' ? 'Tóm tắt giúp mình file hợp đồng này trong năm dòng' : 'Summarize this contract in five lines'}</div>
          <div className="max-w-[88%] text-sm leading-7 text-muted">
            <span className="mono-label mb-1 block">baochat</span>
            <Scramble duration={2.2} delay={0.7} text={lang === 'vi' ? 'Hợp đồng thuê văn phòng 12 tháng, giá 18 triệu mỗi tháng, đặt cọc hai tháng. Điều 7 cho phép chấm dứt sớm với thông báo trước 30 ngày' : 'A 12-month office lease at 18 million a month with a two-month deposit. Clause 7 allows early termination with 30 days notice'} />
            <span className="cursor-block ml-1" />
          </div>
        </div>
        <p className="mono-label relative">{lang === 'vi' ? 'Trò chuyện, tìm kiếm, tạo tài liệu' : 'Chat, search, make documents'}</p>
      </aside>

      <section className="relative flex items-center justify-center px-4 py-10">
        <div className="absolute right-4 top-4 flex gap-1">
          <button className="icon-btn !w-auto px-2" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} aria-label="Language" title="Tiếng Việt / English">
            <Languages size={16} strokeWidth={1.5} />
            <span className="ml-1.5 font-mono text-xs">{lang}</span>
          </button>
          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Theme">
            {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
          </button>
        </div>
        <div className="w-full max-w-sm animate-rise">
          <Link href="/" className="mb-10 block lg:hidden">
            <Logo size={28} />
          </Link>
          <h1 className="text-xl font-medium">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8 space-y-4">{children}</div>
          {footer && <div className="mt-8 text-sm text-muted">{footer}</div>}
        </div>
      </section>
    </main>
  );
}

export function GoogleButton({ label }: { label: string }) {
  return (
    <a href="/api/auth/google" className="btn-ghost w-full">
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
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
