'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Coins, LogOut, Menu, MessageSquarePlus, Pencil, Search, Settings, Shield, SlidersHorizontal, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { Avatar, Countdown, Logo, Spinner } from './ui';
import { useApp } from './Providers';
import { api } from '@/lib/client/api';
import { fmtNum, timeAgo } from '@/lib/client/util';

type Conv = { id: string; title: string; updated_at: string };

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me, tr, lang, convVersion, bumpConvs } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const activeId = pathname.match(/^\/c\/([0-9a-f-]{36})$/)?.[1];

  useEffect(() => {
    const t = setTimeout(
      () => {
        api<{ conversations: Conv[] }>(`/api/conversations${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`)
          .then((d) => setConvs(d.conversations))
          .catch(() => setConvs([]));
      },
      query ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [query, convVersion]);

  async function del(id: string) {
    if (!confirm(tr('Xóa cuộc trò chuyện này?', 'Delete this conversation?'))) return;
    await api(`/api/conversations/${id}`, { method: 'DELETE' });
    bumpConvs();
    if (activeId === id) router.push('/');
  }
  async function rename(id: string) {
    const title = renameVal.trim();
    setRenaming(null);
    if (!title) return;
    await api(`/api/conversations/${id}`, { method: 'PATCH', body: { title } });
    bumpConvs();
  }

  const nav = [
    { href: '/studio', icon: Wand2, label: 'AI Studio' },
    { href: '/personalize', icon: SlidersHorizontal, label: 'Personalize AI' },
    { href: '/tokens', icon: Coins, label: 'Token Usage' },
    { href: '/settings', icon: Settings, label: tr('Cài đặt', 'Settings') },
    ...(me?.user.isAdmin ? [{ href: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  const t = me?.tokens;
  const pct = t && !t.unlimited && t.quota ? Math.max(0, Math.min(100, ((t.balance ?? 0) / t.quota) * 100)) : 100;

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <Link href="/" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <div className="px-3">
        <Link href="/" onClick={onNavigate} className="btn-primary w-full justify-start">
          <MessageSquarePlus size={17} /> {tr('Cuộc trò chuyện mới', 'New chat')}
        </Link>
        <div className="relative mt-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder={tr('Tìm cuộc trò chuyện…', 'Search conversations…')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-2">
        <p className="px-2 pb-1.5 text-[11px] font-medium text-muted">{tr('Gần đây', 'Recent')}</p>
        {convs === null && (
          <div className="flex justify-center py-6 text-muted">
            <Spinner />
          </div>
        )}
        {convs?.length === 0 && <p className="px-2 py-3 text-sm text-muted">{query ? tr('Không tìm thấy.', 'No results.') : tr('Chưa có cuộc trò chuyện nào.', 'No conversations yet.')}</p>}
        <ul className="space-y-0.5">
          {convs?.map((c) => (
            <li key={c.id} className="group relative">
              {renaming === c.id ? (
                <div className="flex items-center gap-1 px-1 py-1">
                  <input
                    autoFocus
                    className="input !py-1.5"
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename(c.id);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                  <button className="icon-btn !h-8 !w-8" onClick={() => rename(c.id)} aria-label="OK">
                    <Check size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href={`/c/${c.id}`}
                    onClick={onNavigate}
                    className={`block rounded-xl px-3 py-2 pr-16 text-sm transition-colors ${activeId === c.id ? 'bg-surface2 text-ink' : 'text-muted hover:bg-surface2/60 hover:text-ink'}`}
                  >
                    <span className="block truncate">{c.title}</span>
                    <span className="block text-[11px] opacity-70">{timeAgo(c.updated_at, lang)}</span>
                  </Link>
                  <div className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 gap-0.5 group-hover:flex max-lg:flex">
                    <button
                      className="icon-btn !h-7 !w-7"
                      aria-label={tr('Đổi tên', 'Rename')}
                      onClick={() => {
                        setRenaming(c.id);
                        setRenameVal(c.title);
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button className="icon-btn !h-7 !w-7 hover:!text-danger" aria-label={tr('Xóa', 'Delete')} onClick={() => del(c.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <nav className="border-t border-line px-2 py-2">
        {nav.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          return (
            <Link key={n.href} href={n.href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${active ? 'bg-primary/15 text-accent' : 'text-muted hover:bg-surface2 hover:text-ink'}`}>
              <n.icon size={17} /> {n.label}
            </Link>
          );
        })}
      </nav>

      {me && (
        <div className="border-t border-line p-3">
          <Link href="/tokens" onClick={onNavigate} className="mb-3 block rounded-xl bg-surface2 p-3 transition-colors hover:bg-surface2/70">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <Sparkles size={13} className="text-accent" /> Token
              </span>
              <span className="font-medium">{t?.unlimited ? '∞' : fmtNum(t?.balance)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            {t && !t.unlimited && (t.balance ?? 0) <= 0 && (
              <p className="mt-2 text-[11px] text-danger">
                {tr('Reset sau', 'Resets in')} <Countdown resetAt={t.resetAt} serverNow={t.serverNow} />
              </p>
            )}
          </Link>
          <div className="flex items-center gap-2.5">
            <Avatar name={me.user.displayName} url={me.user.avatarUrl} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{me.user.displayName}</p>
              <p className="truncate text-[11px] text-muted">{me.user.publicId}</p>
            </div>
            <button
              className="icon-btn"
              aria-label={tr('Đăng xuất', 'Sign out')}
              title={tr('Đăng xuất', 'Sign out')}
              onClick={async () => {
                await api('/api/auth/logout', { method: 'POST' });
                window.location.href = '/login';
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, tr } = useApp();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  // Cookie hết hạn/bị khóa: xóa cookie rồi về trang đăng nhập (tránh vòng lặp redirect với middleware)
  useEffect(() => {
    if (!loading && !me) {
      fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        window.location.href = '/login';
      });
    }
  }, [loading, me]);

  if (loading || !me) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted">
          <Logo size={44} />
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <aside className="hidden w-72 shrink-0 border-r border-line lg:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[82%] max-w-xs border-r border-line lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            >
              <button className="icon-btn absolute right-2 top-3 z-10" onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
              <Sidebar onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 border-b border-line px-3 lg:hidden">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label={tr('Mở menu', 'Open menu')}>
            <Menu size={20} />
          </button>
          <Logo size={26} />
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
