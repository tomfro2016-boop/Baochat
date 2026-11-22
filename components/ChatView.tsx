'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Globe,
  Megaphone,
  Paperclip,
  Pencil,
  RefreshCw,
  Square,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  X,
} from 'lucide-react';
import Markdown from './Markdown';
import { Countdown, ErrorNote, Logo, Spinner } from './ui';
import { useApp, type Mode } from './Providers';
import { api, ApiErr, streamChat, type SseEvent } from '@/lib/client/api';
import { fmtNum } from '@/lib/client/util';

type Attachment = { id: string; name: string; mime: string; size: number };
type Source = { title: string; url: string; snippet?: string };
type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: Attachment[];
  sources: Source[];
  model?: string | null;
  rating?: 1 | -1 | null;
  streaming?: boolean;
  error?: string;
  k?: string; // khóa React ổn định (id tạm -> id thật không làm bong bóng nháy lại)
};

const MODES: { id: Mode; vi: string; en: string; emoji: string }[] = [
  { id: 'serious', vi: 'Nghiêm túc', en: 'Serious', emoji: '🎯' },
  { id: 'casual', vi: 'Bình thường', en: 'Casual', emoji: '💬' },
  { id: 'funny', vi: 'Hài hước', en: 'Funny', emoji: '😄' },
  { id: 'playful', vi: 'Cợt nhả', en: 'Playful', emoji: '😜' },
];

const tmpId = () => 'tmp-' + Math.random().toString(36).slice(2);
const isImg = (mime: string) => mime.startsWith('image/');

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  return (
    <span className="chip max-w-[14rem] !text-ink">
      {isImg(a.mime) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/${a.id}`} alt="" className="h-5 w-5 rounded object-cover" />
      ) : (
        <FileText size={13} className="shrink-0 text-accent" />
      )}
      <span className="truncate">{a.name}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="shrink-0 text-muted hover:text-danger">
          <X size={13} />
        </button>
      )}
    </span>
  );
}

function Dropdown<T extends string>({
  value,
  onChange,
  options,
  icon,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; hint?: string }[];
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const cur = options.find((o) => o.id === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setOpen((o) => !o)}>
        {icon}
        <span className="max-w-[9rem] truncate">{cur?.label ?? '—'}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full z-30 mt-1.5 max-h-72 min-w-[12rem] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl"
          >
            {options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface2 ${o.id === value ? 'text-accent' : ''}`}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <span>
                    {o.label}
                    {o.hint && <span className="ml-2 text-[11px] text-muted">{o.hint}</span>}
                  </span>
                  {o.id === value && <Check size={14} />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  const { tr } = useApp();
  if (!sources.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-line bg-surface2/50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Globe size={12} /> {tr('Nguồn tham khảo', 'Sources')}
      </p>
      <ol className="space-y-1.5">
        {sources.map((s, i) => {
          let host = '';
          try {
            host = new URL(s.url).hostname.replace(/^www\./, '');
          } catch {}
          return (
            <li key={s.url + i} className="flex gap-2 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[11px] text-accent">{i + 1}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 hover:text-accent">
                <span className="block truncate">{s.title || host}</span>
                <span className="block truncate text-[11px] text-muted">{host}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function ChatView() {
  const { me, tr, refresh, bumpConvs, patchTokens } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const urlId = pathname.match(/^\/c\/([0-9a-f-]{36})$/)?.[1] ?? null;

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [search, setSearch] = useState(false);
  const [mode, setMode] = useState<Mode>('casual');
  const [modelId, setModelId] = useState<string>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const loadedRef = useRef<string | null>(null); // id hội thoại đang hiển thị (tránh tải lại khi URL đổi do chính ta)
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const modeInit = useRef(false);

  const tokens = me?.tokens;
  const outOfTokens = !!tokens && !tokens.unlimited && (tokens.balance ?? 0) <= 0;
  const models = me?.features.models ?? [];

  // chế độ mặc định theo tài khoản
  useEffect(() => {
    if (me && !modeInit.current) {
      modeInit.current = true;
      setMode(me.user.defaultMode);
    }
  }, [me]);

  // Tải hội thoại khi URL đổi (bỏ qua khi URL đổi do chính luồng chat đang chạy)
  useEffect(() => {
    if (urlId === loadedRef.current) return;
    abortRef.current?.abort();
    loadedRef.current = urlId;
    setError('');
    setNotice('');
    setEditing(null);
    setPending([]);
    setBusy(false);
    if (!urlId) {
      setMsgs([]);
      setConvId(null);
      return;
    }
    setLoadingConv(true);
    api<{ conversation: { id: string; mode: Mode | null; model_id: string | null; search_enabled: boolean }; messages: any[] }>(`/api/conversations/${urlId}`)
      .then((d) => {
        if (loadedRef.current !== urlId) return;
        setConvId(d.conversation.id);
        if (d.conversation.mode) setMode(d.conversation.mode);
        setModelId(d.conversation.model_id || 'auto');
        setSearch(d.conversation.search_enabled);
        setMsgs(
          d.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            attachments: m.attachments || [],
            sources: m.sources || [],
            model: m.model,
            rating: m.rating,
          })),
        );
        stickRef.current = true;
      })
      .catch(() => {
        if (loadedRef.current === urlId) router.replace('/');
      })
      .finally(() => setLoadingConv(false));
  }, [urlId, router]);

  // Cuộn xuống khi có nội dung mới (chỉ khi người dùng đang ở cuối)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [msgs, loadingConv]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = near;
    setAtBottom(near);
  };
  const scrollDown = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  // textarea tự mở rộng
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
  }, [input]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setError('');
      const max = me?.features.maxUploadMb ?? 10;
      for (const f of files) {
        if (pending.length >= 8) {
          setError(tr('Tối đa 8 tệp mỗi tin nhắn.', 'Up to 8 files per message.'));
          break;
        }
        if (f.size > max * 1024 * 1024) {
          setError(tr(`"${f.name}" vượt quá ${max}MB.`, `"${f.name}" exceeds ${max}MB.`));
          continue;
        }
        setUploading((n) => n + 1);
        try {
          const form = new FormData();
          form.append('file', f);
          const r = await api<Attachment & { readable: boolean }>('/api/files', { form });
          setPending((p) => [...p, { id: r.id, name: r.name, mime: r.mime, size: r.size }]);
          if (!r.readable) setNotice(tr(`Không đọc được nội dung "${r.name}"; AI sẽ chỉ biết tên tệp.`, `Couldn't read "${r.name}"; the AI will only see its name.`));
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [me, pending.length, tr],
  );

  const run = useCallback(
    async (action: 'send' | 'regenerate' | 'edit', opts: { content?: string; attachments?: Attachment[]; editMessageId?: string } = {}) => {
      if (busy) return;
      setError('');
      setNotice('');
      const content = (opts.content ?? '').trim();
      const atts = opts.attachments ?? [];

      // cập nhật giao diện ngay (lạc quan) rồi đồng bộ id thật từ server
      const asstTmp = tmpId();
      const userTmp: string | null = action === 'regenerate' ? null : tmpId(); // sinh id ngoài updater (StrictMode gọi updater 2 lần)
      setMsgs((cur) => {
        let base = cur;
        if (action === 'regenerate') {
          if (base.length && base[base.length - 1].role === 'assistant') base = base.slice(0, -1);
        } else {
          if (action === 'edit' && opts.editMessageId) {
            const i = base.findIndex((m) => m.id === opts.editMessageId);
            if (i >= 0) base = base.slice(0, i);
          }
          base = [...base, { id: userTmp!, k: userTmp!, role: 'user', content, attachments: atts, sources: [] }];
        }
        return [...base, { id: asstTmp, k: asstTmp, role: 'assistant', content: '', attachments: [], sources: [], streaming: true }];
      });
      stickRef.current = true;
      setBusy(true);
      const ac = new AbortController();
      abortRef.current = ac;
      const patchAsst = (fn: (m: Msg) => Msg) => setMsgs((cur) => cur.map((m) => (m.id === asstTmp ? fn(m) : m)));
      let realConv = convId;

      try {
        await streamChat(
          {
            conversationId: convId,
            action,
            content,
            attachmentIds: atts.map((a) => a.id),
            search,
            mode,
            modelId: modelId === 'auto' ? null : modelId,
            editMessageId: opts.editMessageId,
          },
          (e: SseEvent) => {
            switch (e.type) {
              case 'meta':
                realConv = e.conversationId;
                if (!convId) {
                  setConvId(e.conversationId);
                  loadedRef.current = e.conversationId; // URL sắp đổi do ta -> không tải lại
                  router.replace(`/c/${e.conversationId}`);
                }
                bumpConvs();
                if (userTmp && e.userMessageId) {
                  setMsgs((cur) => cur.map((m) => (m.id === userTmp ? { ...m, id: e.userMessageId } : m)));
                }
                break;
              case 'sources':
                patchAsst((m) => ({ ...m, sources: e.sources }));
                break;
              case 'model':
                patchAsst((m) => ({ ...m, model: e.id }));
                break;
              case 'delta':
                patchAsst((m) => ({ ...m, content: m.content + e.t }));
                break;
              case 'notice':
                setNotice(e.message);
                break;
              case 'error':
                patchAsst((m) => ({ ...m, error: e.message }));
                break;
              case 'done':
                patchAsst((m) => ({ ...m, id: e.messageId || m.id, streaming: false }));
                if (e.balance !== undefined) patchTokens({ balance: e.balance, resetAt: e.resetAt ?? null });
                break;
            }
          },
          ac.signal,
        );
      } catch (err) {
        if (!ac.signal.aborted) {
          if (err instanceof ApiErr && err.data?.code === 'OUT_OF_TOKENS') {
            patchTokens({ balance: 0, resetAt: err.data.resetAt ?? null });
          }
          setError(err instanceof Error ? err.message : String(err));
          // bỏ bong bóng trả lời rỗng
          setMsgs((cur) => cur.filter((m) => !(m.id === asstTmp && !m.content)));
        }
      } finally {
        setMsgs((cur) => cur.map((m) => (m.id === asstTmp || m.streaming ? { ...m, streaming: false } : m)));
        setBusy(false);
        abortRef.current = null;
        refresh(); // đồng bộ lại số token chính xác từ server
        if (realConv) bumpConvs();
      }
    },
    [busy, convId, search, mode, modelId, router, bumpConvs, patchTokens, refresh],
  );

  const send = () => {
    const text = input.trim();
    if ((!text && !pending.length) || busy || uploading || outOfTokens) return;
    const atts = pending;
    setInput('');
    setPending([]);
    run('send', { content: text, attachments: atts });
  };

  const stop = () => abortRef.current?.abort();

  const saveEdit = () => {
    if (!editing) return;
    const orig = msgs.find((m) => m.id === editing.id);
    const text = editing.text.trim();
    if (!orig || (!text && !orig.attachments.length)) return;
    setEditing(null);
    run('edit', { content: text, attachments: orig.attachments, editMessageId: orig.id });
  };

  const rate = async (m: Msg, value: 1 | -1) => {
    const next = m.rating === value ? null : value;
    setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, rating: next } : x)));
    try {
      await api(`/api/messages/${m.id}`, { method: 'PATCH', body: { rating: next } });
    } catch {
      setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, rating: m.rating } : x)));
    }
  };

  const copy = async (m: Msg) => {
    await navigator.clipboard.writeText(m.content);
    setCopied(m.id);
    setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 1500);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Không gửi khi đang gõ tiếng Việt bằng IME (Telex/VNI) hoặc ký tự đang ghép
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send();
    }
  };

  const lastAsstIdx = (() => {
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'assistant') return i;
    return -1;
  })();

  const suggestions = [
    { icon: '✍️', t: tr('Viết một email xin nghỉ phép lịch sự', 'Write a polite leave-request email') },
    { icon: '💻', t: tr('Giải thích async/await trong JavaScript kèm ví dụ', 'Explain async/await in JavaScript with examples') },
    { icon: '🌐', t: tr('Tìm tin công nghệ mới nhất hôm nay', "Find today's latest tech news"), search: true },
    { icon: '🧮', t: tr('Giải phương trình x² − 5x + 6 = 0 từng bước', 'Solve x² − 5x + 6 = 0 step by step') },
  ];

  const empty = msgs.length === 0 && !loadingConv;

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        uploadFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {/* Thanh công cụ trên cùng */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 sm:px-5">
        <Dropdown
          value={modelId}
          onChange={setModelId}
          icon={<span className="text-accent">◆</span>}
          options={[{ id: 'auto', label: tr('Tự động', 'Auto') }, ...models.map((m) => ({ id: m.id, label: m.label, hint: m.vision ? 'Vision' : undefined }))]}
        />
        <Dropdown value={mode} onChange={setMode} icon={<span>{MODES.find((m) => m.id === mode)?.emoji}</span>} options={MODES.map((m) => ({ id: m.id, label: tr(m.vi, m.en) }))} />
        <div className="ml-auto hidden items-center gap-2 text-xs text-muted sm:flex">
          {tokens?.unlimited ? <span className="chip">∞ token</span> : <span className="chip">{fmtNum(tokens?.balance)} token</span>}
        </div>
      </div>

      {/* Khu vực tin nhắn */}
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {loadingConv && (
            <div className="flex justify-center py-20 text-muted">
              <Spinner />
            </div>
          )}

          {empty && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col items-center pb-6 pt-8 text-center sm:pt-16">
              <Logo size={56} withText={false} />
              <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
                {tr('Xin chào', 'Hello')}, <span className="text-accent">{me?.user.displayName}</span>
              </h1>
              <p className="mt-2 text-muted">{tr('Bạn muốn Baochat giúp gì hôm nay?', 'What can Baochat help you with today?')}</p>

              {me?.announcements?.length ? (
                <div className="mt-6 w-full max-w-xl space-y-2 text-left">
                  {me.announcements.map((a) => (
                    <div key={a.id} className="flex gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
                      <Megaphone size={16} className="mt-0.5 shrink-0 text-accent" />
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-muted">{a.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s.t}
                    onClick={() => {
                      setInput(s.t);
                      if (s.search && me?.features.search) setSearch(true);
                      taRef.current?.focus();
                    }}
                    className="card group flex items-start gap-3 p-4 text-left text-sm transition-all hover:border-primary/40 hover:bg-surface2"
                  >
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-muted transition-colors group-hover:text-ink">{s.t}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <div className="space-y-6">
            {msgs.map((m, i) => (
              <motion.div key={m.k ?? m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
                {m.role === 'user' ? (
                  <div className="flex flex-col items-end gap-1.5">
                    {m.attachments.length > 0 && (
                      <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
                        {m.attachments.map((a) =>
                          isImg(a.mime) ? (
                            <a key={a.id} href={`/api/files/${a.id}`} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/api/files/${a.id}`} alt={a.name} className="max-h-40 rounded-xl border border-line object-cover" />
                            </a>
                          ) : (
                            <AttachmentChip key={a.id} a={a} />
                          ),
                        )}
                      </div>
                    )}
                    {editing?.id === m.id ? (
                      <div className="w-full max-w-[85%] space-y-2">
                        <textarea
                          autoFocus
                          className="input min-h-[96px] resize-y"
                          value={editing.text}
                          onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditing(null);
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) saveEdit();
                          }}
                        />
                        <div className="flex justify-end gap-2">
                          <button className="btn-ghost !py-1.5 text-xs" onClick={() => setEditing(null)}>
                            {tr('Hủy', 'Cancel')}
                          </button>
                          <button className="btn-primary !py-1.5 text-xs" onClick={saveEdit} disabled={busy}>
                            {tr('Lưu & gửi lại', 'Save & resend')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      m.content && (
                        <div className="group relative max-w-[85%]">
                          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-surface2 px-4 py-2.5 text-[15px] leading-7 text-ink">{m.content}</div>
                          {!busy && !m.id.startsWith('tmp-') && (
                            <button
                              className="icon-btn absolute -left-10 top-1/2 hidden h-8 w-8 -translate-y-1/2 group-hover:inline-flex max-lg:inline-flex max-lg:!-left-9"
                              aria-label={tr('Chỉnh sửa', 'Edit')}
                              title={tr('Chỉnh sửa', 'Edit')}
                              onClick={() => setEditing({ id: m.id, text: m.content })}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      <Logo size={30} withText={false} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {m.content ? (
                        <Markdown>{m.content}</Markdown>
                      ) : m.streaming ? (
                        <div className="flex h-8 items-center gap-1.5">
                          {[0, 1, 2].map((d) => (
                            <span key={d} className="typing-dot" style={{ animationDelay: `${d * 0.15}s` }} />
                          ))}
                          <span className="ml-2 text-xs text-muted">{search ? tr('Đang tìm kiếm & suy nghĩ…', 'Searching & thinking…') : tr('Đang xử lý…', 'Thinking…')}</span>
                        </div>
                      ) : null}
                      {m.streaming && m.content && <span className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse bg-accent" />}
                      {m.error && <div className="mt-2"><ErrorNote>{m.error}</ErrorNote></div>}
                      <SourceList sources={m.sources} />
                      {!m.streaming && m.content && (
                        <div className="mt-2 flex items-center gap-0.5 text-muted">
                          <button className="icon-btn !h-8 !w-8" onClick={() => copy(m)} title={tr('Sao chép', 'Copy')} aria-label={tr('Sao chép', 'Copy')}>
                            {copied === m.id ? <Check size={15} className="text-ok" /> : <Copy size={15} />}
                          </button>
                          {!m.id.startsWith('tmp-') && (
                            <>
                              <button className={`icon-btn !h-8 !w-8 ${m.rating === 1 ? '!text-ok' : ''}`} onClick={() => rate(m, 1)} title={tr('Câu trả lời tốt', 'Good answer')} aria-label="Like">
                                <ThumbsUp size={15} />
                              </button>
                              <button className={`icon-btn !h-8 !w-8 ${m.rating === -1 ? '!text-danger' : ''}`} onClick={() => rate(m, -1)} title={tr('Câu trả lời chưa tốt', 'Bad answer')} aria-label="Dislike">
                                <ThumbsDown size={15} />
                              </button>
                            </>
                          )}
                          {i === lastAsstIdx && !busy && (
                            <button className="icon-btn !h-8 !w-8" onClick={() => run('regenerate')} disabled={outOfTokens} title={tr('Tạo lại', 'Regenerate')} aria-label={tr('Tạo lại', 'Regenerate')}>
                              <RefreshCw size={15} />
                            </button>
                          )}
                          {m.model && <span className="ml-2 text-[11px]">{models.find((x) => x.id === m.model)?.label ?? m.model}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {!atBottom && msgs.length > 0 && (
        <button onClick={scrollDown} className="absolute bottom-40 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface shadow-lg transition-colors hover:bg-surface2" aria-label="Scroll down">
          <ArrowDown size={16} />
        </button>
      )}

      {/* Ô nhập liệu */}
      <div className="border-t border-line bg-bg/60 px-3 pb-3 pt-3 backdrop-blur sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-2">
          {outOfTokens && tokens && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm">
              <span className="text-danger">{tr('Bạn đã hết token.', "You're out of tokens.")}</span>
              <span className="text-muted">
                {tr('Reset sau', 'Resets in')} <Countdown resetAt={tokens.resetAt} serverNow={tokens.serverNow} className="font-medium text-ink" />
              </span>
            </div>
          )}
          {!busy && !loadingConv && convId && msgs.length > 0 && msgs[msgs.length - 1].role === 'user' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm">
              <span className="text-danger">{tr('Câu hỏi này chưa có câu trả lời (AI không phản hồi).', 'This message has no reply (the AI did not respond).')}</span>
              <button className="btn-primary !py-1.5 text-xs" onClick={() => run('regenerate')} disabled={outOfTokens}>
                {tr('Thử lại', 'Retry')}
              </button>
            </div>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
          {notice && !error && <div className="rounded-xl border border-line bg-surface2 px-3.5 py-2 text-xs text-muted">{notice}</div>}

          <div className="rounded-2xl border border-line bg-surface shadow-lg transition-colors focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/20">
            {(pending.length > 0 || uploading > 0) && (
              <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                {pending.map((a) => (
                  <AttachmentChip key={a.id} a={a} onRemove={() => setPending((p) => p.filter((x) => x.id !== a.id))} />
                ))}
                {uploading > 0 && (
                  <span className="chip">
                    <Spinner /> {tr('Đang tải lên…', 'Uploading…')}
                  </span>
                )}
              </div>
            )}
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  uploadFiles(files);
                }
              }}
              placeholder={outOfTokens ? tr('Đang chờ reset token…', 'Waiting for token reset…') : tr('Nhắn tin cho Baochat…  (Enter để gửi, Shift+Enter xuống dòng)', 'Message Baochat…  (Enter to send, Shift+Enter for new line)')}
              disabled={outOfTokens}
              maxLength={30000}
              className="block max-h-[220px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-6 outline-none placeholder:text-muted disabled:opacity-60"
            />
            <div className="flex items-center gap-1 px-2 pb-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx,.xlsx,.csv,.txt,.md,.json,.html,.css,.js,.ts,.py,.java,.cs,.lua"
                onChange={(e) => {
                  uploadFiles(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              <button className="icon-btn" onClick={() => fileRef.current?.click()} title={tr('Đính kèm tệp / hình ảnh', 'Attach files / images')} aria-label={tr('Đính kèm', 'Attach')}>
                <Paperclip size={18} />
              </button>
              <button
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors ${search ? 'bg-primary/20 text-accent' : 'text-muted hover:bg-surface2 hover:text-ink'}`}
                onClick={() => {
                  if (!me?.features.search) {
                    setNotice(tr('Tìm kiếm Internet chưa được cấu hình trên máy chủ (cần TAVILY_API_KEY hoặc BRAVE_API_KEY).', 'Web search is not configured on the server (needs TAVILY_API_KEY or BRAVE_API_KEY).'));
                    return;
                  }
                  setSearch((s) => !s);
                }}
                aria-pressed={search}
                title={tr('Bật/tắt tìm kiếm Internet', 'Toggle web search')}
              >
                <Globe size={16} /> Search
              </button>
              <Link href="/studio" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-ink">
                <Wand2 size={16} /> AI Studio
              </Link>
              <div className="ml-auto">
                {busy ? (
                  <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface2 text-ink transition-colors hover:bg-line" onClick={stop} aria-label={tr('Dừng', 'Stop')} title={tr('Dừng', 'Stop')}>
                    <Square size={15} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white transition-all hover:shadow-glow hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
                    onClick={send}
                    disabled={(!input.trim() && !pending.length) || uploading > 0 || outOfTokens}
                    aria-label={tr('Gửi', 'Send')}
                    title={tr('Gửi', 'Send')}
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted">{tr('Baochat có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.', 'Baochat can make mistakes. Check important information.')}</p>
        </div>
      </div>

      <AnimatePresence>
        {dragOver && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
            <div className="rounded-2xl border-2 border-dashed border-primary px-10 py-8 text-center">
              <Paperclip className="mx-auto mb-2 text-accent" />
              <p className="font-medium">{tr('Thả tệp để đính kèm', 'Drop files to attach')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
