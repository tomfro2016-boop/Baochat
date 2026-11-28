'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins, CornerDownLeft, MessageSquare, Plus, Search, Settings, Shield, SlidersHorizontal, Wand2, type LucideIcon } from 'lucide-react';
import { useApp } from './Providers';
import { api } from '@/lib/client/api';

type Item = { id: string; label: string; hint?: string; icon: LucideIcon; href: string };

/** Ctrl/⌘ + K: nhảy tới trang hoặc cuộc trò chuyện bằng bàn phím. */
export default function CommandPalette() {
  const { me, tr } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [convs, setConvs] = useState<{ id: string; title: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setIdx(0);
    setTimeout(() => inputRef.current?.focus(), 30);
    api<{ conversations: { id: string; title: string }[] }>('/api/conversations')
      .then((d) => setConvs(d.conversations.slice(0, 30)))
      .catch(() => setConvs([]));
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      { id: 'new', label: tr('Cuộc trò chuyện mới', 'New chat'), icon: Plus, href: '/' },
      { id: 'studio', label: 'Studio', icon: Wand2, href: '/studio' },
      { id: 'personalize', label: tr('Cá nhân hóa', 'Personalize'), icon: SlidersHorizontal, href: '/personalize' },
      { id: 'tokens', label: tr('Token', 'Tokens'), icon: Coins, href: '/tokens' },
      { id: 'settings', label: tr('Cài đặt', 'Settings'), icon: Settings, href: '/settings' },
      ...(me?.user.isAdmin ? [{ id: 'admin', label: tr('Quản trị', 'Admin'), icon: Shield, href: '/admin' }] : []),
    ];
    const chats: Item[] = convs.map((c) => ({ id: c.id, label: c.title, hint: tr('trò chuyện', 'chat'), icon: MessageSquare, href: `/c/${c.id}` }));
    const all = [...base, ...chats];
    const k = q.trim().toLowerCase();
    return k ? all.filter((i) => i.label.toLowerCase().includes(k)) : all.slice(0, 10);
  }, [q, convs, me, tr]);

  useEffect(() => setIdx(0), [q]);

  const go = (i?: Item) => {
    if (!i) return;
    setOpen(false);
    router.push(i.href);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[16vh]">
          <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={() => setOpen(false)} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg overflow-hidden rounded-lg border border-line bg-surface"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={16} strokeWidth={1.5} className="text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIdx((i) => Math.min(items.length - 1, i + 1));
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setIdx((i) => Math.max(0, i - 1));
                  }
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) go(items[idx]);
                }}
                placeholder={tr('Tìm trang hoặc cuộc trò chuyện', 'Find a page or conversation')}
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
              <kbd>Esc</kbd>
            </div>
            <ul className="max-h-80 overflow-y-auto p-1">
              {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{tr('Không tìm thấy', 'No results')}</li>}
              {items.map((it, n) => (
                <li key={it.id}>
                  <button
                    onMouseMove={() => setIdx(n)}
                    onClick={() => go(it)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-100 ${n === idx ? 'bg-surface2 text-ink' : 'text-muted'}`}
                  >
                    <it.icon size={16} strokeWidth={1.5} />
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.hint && <span className="mono-label">{it.hint}</span>}
                    {n === idx && <CornerDownLeft size={14} strokeWidth={1.5} />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
