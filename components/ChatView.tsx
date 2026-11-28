'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Cpu,
  Download,
  Link2,
  FileText,
  Globe,
  Megaphone,
  MessageCircle,
  Mic,
  Paperclip,
  Pencil,
  RefreshCw,
  Scale,
  Smile,
  UserRound,
  Volume2,
  Square,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Markdown from './Markdown';
import DotField from './fx/DotField';
import { PRESETS } from '@/lib/ai/presets';
import { DEEP_META } from '@/lib/ai/deep-meta';
import Magnetic from './fx/Magnetic';
import Scramble from './fx/Scramble';
import { useSpotlight } from './fx/useSpotlight';
import { Countdown, ErrorNote, Spinner } from './ui';
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

const MODES: { id: Mode; vi: string; en: string; icon: LucideIcon }[] = [
  { id: 'serious', vi: 'Nghiêm túc', en: 'Serious', icon: Scale },
  { id: 'casual', vi: 'Bình thường', en: 'Casual', icon: MessageCircle },
  { id: 'funny', vi: 'Hài hước', en: 'Funny', icon: Smile },
  { id: 'playful', vi: 'Cợt nhả', en: 'Playful', icon: Zap },
];

const tmpId = () => 'tmp-' + Math.random().toString(36).slice(2);
const isImg = (mime: string) => mime.startsWith('image/');

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  return (
    <span className="chip max-w-[14rem] !text-ink">
      {isImg(a.mime) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/${a.id}`} alt="" className="h-5 w-5 rounded-sm object-cover" />
      ) : (
        <FileText size={13} strokeWidth={1.5} className="shrink-0 text-muted" />
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
      <button type="button" className="btn-ghost !h-8 !px-3 text-xs" onClick={() => setOpen((o) => !o)}>
        {icon}
        <span className="max-w-[9rem] truncate">{cur?.label ?? '—'}</span>
        <ChevronDown size={14} strokeWidth={1.5} className="text-muted" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
            className="absolute left-0 top-full z-30 mt-1.5 max-h-72 min-w-[12rem] overflow-y-auto rounded-lg border border-line bg-surface p-1"
          >
            {options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface2 ${o.id === value ? 'text-primary' : ''}`}
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
    <div className="mt-4 border-t border-line pt-3">
      <p className="mono-label mb-2">{tr('nguồn', 'sources')}</p>
      <ol className="space-y-1.5">
        {sources.map((s, i) => {
          let host = '';
          try {
            host = new URL(s.url).hostname.replace(/^www\./, '');
          } catch {}
          return (
            <li key={s.url + i} className="flex gap-2 text-sm">
              <span className="w-5 shrink-0 font-mono text-[11px] text-muted">{String(i + 1).padStart(2, '0')}</span>
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

async function videoFrames(file: File, n: number): Promise<File[]> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej(new Error('video'));
    });
    const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
    const vw = v.videoWidth || 768;
    const vh = v.videoHeight || 432;
    const scale = Math.min(1, 768 / Math.max(vw, vh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(vw * scale));
    c.height = Math.max(1, Math.round(vh * scale));
    const ctx = c.getContext('2d');
    const out: File[] = [];
    if (!ctx) return out;
    const base = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'video';
    for (let i = 0; i < n; i++) {
      const t = Math.max(0, Math.min(dur - 0.05, (dur * (i + 0.5)) / n));
      await new Promise<void>((res) => {
        v.onseeked = () => res();
        v.currentTime = t;
      });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.8));
      if (blob) out.push(new File([blob], `${base}-khung-${i + 1}.jpg`, { type: 'image/jpeg' }));
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ChatView() {
  const { me, tr, lang, refresh, bumpConvs, patchTokens } = useApp();
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
  const [preset, setPresetState] = useState<string>('none');
  const [deep, setDeep] = useState<string>('none');
  const [myAssistants, setMyAssistants] = useState<{ id: string; name: string }[]>([]);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem('bc_preset');
      if (v && (PRESETS.some((p) => p.id === v) || v.startsWith('a:'))) setPresetState(v);
    } catch {}
    api<{ assistants: { id: string; name: string }[]; added: { id: string; name: string }[] }>('/api/assistants').then((d) => setMyAssistants([...d.assistants, ...d.added])).catch(() => {});
  }, []);
  const setPreset = (v: string) => {
    setPresetState(v);
    try {
      localStorage.setItem('bc_preset', v);
    } catch {}
  };
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
  const camRef = useRef<HTMLInputElement>(null);
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
      const expanded: File[] = [];
      for (const f of files) {
        if (f.type.startsWith('video/')) {
          setNotice(tr(`Đang lấy khung hình từ "${f.name}"…`, `Extracting frames from "${f.name}"…`));
          try {
            const frames = await videoFrames(f, 6);
            if (frames.length) {
              expanded.push(...frames);
              setNotice(tr(`Đã lấy ${frames.length} khung hình từ video. AI sẽ xem các khung hình này (không nghe được âm thanh).`, `Took ${frames.length} frames from the video. The AI sees these frames (no audio).`));
              continue;
            }
          } catch { /* rơi xuống thông báo lỗi */ }
          setError(tr(`Không đọc được video "${f.name}".`, `Couldn't read video "${f.name}".`));
        } else expanded.push(f);
      }
      files = expanded;
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
            preset: preset === 'none' || preset.startsWith('a:') ? null : preset,
            assistantId: preset.startsWith('a:') ? preset.slice(2) : null,
            deep: deep === 'none' ? null : deep,
            editMessageId: opts.editMessageId,
          },
          (e: SseEvent) => {
            switch (e.type) {
              case 'meta':
                realConv = e.conversationId;
                if (!convId) {
                  setConvId(e.conversationId);
                  loadedRef.current = e.conversationId; // URL sắp đổi do ta -> không tải lại
                  // replaceState (không điều hướng Next) để trang KHÔNG bị dựng lại và luồng trả lời không bị mất
                  window.history.replaceState(null, '', `/c/${e.conversationId}`);
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
    [busy, convId, search, mode, modelId, preset, deep, router, bumpConvs, patchTokens, refresh],
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

  // Nhập bằng giọng nói (trình duyệt hỗ trợ Web Speech API: Chrome, Edge, Safari)
  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert(tr('Trình duyệt này chưa hỗ trợ nhập giọng nói. Hãy dùng Chrome hoặc Edge', 'This browser does not support voice input. Try Chrome or Edge'));
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = lang === 'vi' ? 'vi-VN' : 'en-US';
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript;
      if (t) setInput((cur) => (cur ? cur.replace(/\s*$/, ' ') : '') + t.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  // Đọc to câu trả lời: chọn giọng đúng ngôn ngữ, đọc từng câu để không bị ngắt giữa chừng
  const pickVoice = (tag: string) => {
    const pre = tag.slice(0, 2).toLowerCase();
    const list = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(pre));
    return (
      list.find((v) => /natural|online/i.test(v.name)) ||
      list.find((v) => /google/i.test(v.name)) ||
      list.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) ||
      list[0] ||
      null
    );
  };
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.getVoices();
    const h = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', h);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', h);
  }, []);

  const speakBrowser = (m: Msg) => {
    if (!('speechSynthesis' in window)) {
      alert(tr('Trình duyệt này không hỗ trợ đọc to', 'This browser does not support read aloud'));
      return;
    }
    window.speechSynthesis.cancel();
    const tag = lang === 'vi' ? 'vi-VN' : 'en-US';
    const voice = pickVoice(tag);
    if (!voice) {
      alert(
        lang === 'vi'
          ? 'Máy của bạn chưa có giọng đọc tiếng Việt nên đọc sẽ sai. Cách xử lý: dùng trình duyệt Microsoft Edge (có giọng "HoaiMy" tiếng Việt tự nhiên), hoặc trên Windows vào Cài đặt, Thời gian và ngôn ngữ, Giọng nói, Thêm giọng nói, chọn Tiếng Việt'
          : 'No English voice found on this device',
      );
      return;
    }
    const plain = m.content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[(\d+)\]/g, '')
      .replace(/[*_`#>\[\]|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
    const chunks = plain.match(/[^.!?;\n]+[.!?;]?/g)?.map((x) => x.trim()).filter(Boolean) ?? [plain];
    setSpeakingId(m.id);
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95;
      if (i === chunks.length - 1) u.onend = () => setSpeakingId(null);
      u.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(u);
    });
  };
  // Giọng Gemini (có biểu cảm theo tính cách chat). Lỗi hoặc hết lượt thì quay về giọng trình duyệt.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsRef = useRef<{ stop: boolean } | null>(null);
  const stopSpeaking = () => {
    if (ttsRef.current) ttsRef.current.stop = true;
    audioRef.current?.pause();
    audioRef.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeakingId(null);
  };

  const speak = async (m: Msg) => {
    if (speakingId === m.id) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    const plain = m.content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[(\d+)\]/g, '')
      .replace(/[*_`#>\[\]|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3600);
    if (!plain) return;
    // Cắt theo câu, mỗi đoạn tối đa khoảng 450 ký tự
    const chunks: string[] = [];
    let cur = '';
    for (const sent of plain.match(/[^.!?;]+[.!?;]*\s*/g) ?? [plain]) {
      if ((cur + sent).length > 450 && cur) {
        chunks.push(cur.trim());
        cur = '';
      }
      cur += sent;
    }
    if (cur.trim()) chunks.push(cur.trim());

    const token = { stop: false };
    ttsRef.current = token;
    setSpeakingId(m.id);
    let fellBack = false;
    const fetchChunk = async (text: string) => {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang, mode }), signal: undefined });
      if (!res.ok) throw new Error(String(res.status));
      return res.blob();
    };
    try {
      let next = fetchChunk(chunks[0]);
      for (let i = 0; i < chunks.length; i++) {
        const blob = await next;
        if (token.stop) return;
        if (i + 1 < chunks.length) {
          next = fetchChunk(chunks[i + 1]);
          next.catch(() => {});
        }
        await new Promise<void>((resolve, reject) => {
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          audioRef.current = a;
          a.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          a.onerror = () => reject(new Error('audio'));
          a.play().catch(reject);
        });
        if (token.stop) return;
      }
    } catch {
      if (!token.stop) {
        fellBack = true;
        speakBrowser(m);
      }
    } finally {
      if (!fellBack && ttsRef.current === token) setSpeakingId(null);
    }
  };

  useEffect(() => () => {
    recRef.current?.stop?.();
    audioRef.current?.pause();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  // Tải cuộc trò chuyện về dạng Markdown
  const exportMd = () => {
    const title = (msgs.find((m) => m.role === 'user')?.content || 'Baochat').slice(0, 60).replace(/\s+/g, ' ');
    const body = msgs
      .filter((m) => m.content)
      .map((m) => `## ${m.role === 'user' ? me?.user.displayName || 'Bạn' : 'Baochat'}\n\n${m.content}`)
      .join('\n\n---\n\n');
    const blob = new Blob([`# ${title}\n\n${body}\n`], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `baochat-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  useEffect(() => { setShareUrl(null); }, [convId]);
  const shareConv = async () => {
    if (!convId) return;
    try {
      const r = await api<{ token: string }>(`/api/share/${convId}`, { method: 'POST' });
      const url = `${window.location.origin}/s/${r.token}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); } catch { /* người dùng tự sao chép */ }
    } catch (e: any) {
      setError(e?.message || tr('Không tạo được liên kết.', 'Could not create link.'));
    }
  };
  const unshare = async () => {
    if (!convId) return;
    try { await api(`/api/share/${convId}`, { method: 'DELETE' }); } catch { /* bỏ qua */ }
    setShareUrl(null);
  };

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
    { t: tr('Viết một email xin nghỉ phép lịch sự', 'Write a polite leave-request email') },
    { t: tr('Giải thích async/await trong JavaScript kèm ví dụ', 'Explain async/await in JavaScript with examples') },
    { t: tr('Tìm tin công nghệ mới nhất hôm nay', "Find today's latest tech news"), search: true },
    { t: tr('Giải phương trình x² − 5x + 6 = 0 từng bước', 'Solve x² − 5x + 6 = 0 step by step') },
  ];

  const empty = msgs.length === 0 && !loadingConv;
  const spot = useSpotlight();

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
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-5">
        <Dropdown
          value={modelId}
          onChange={setModelId}
          icon={<Cpu size={14} strokeWidth={1.5} className="text-muted" />}
          options={[{ id: 'auto', label: tr('Tự động', 'Auto') }, ...models.map((m) => ({ id: m.id, label: m.label, hint: m.vision ? 'Vision' : undefined }))]}
        />
        <Dropdown value={mode} onChange={setMode} icon={(() => { const I = MODES.find((m) => m.id === mode)?.icon ?? MessageCircle; return <I size={14} strokeWidth={1.5} className="text-muted" />; })()} options={MODES.map((m) => ({ id: m.id, label: tr(m.vi, m.en) }))} />
        <Dropdown
          value={preset}
          onChange={setPreset}
          icon={<UserRound size={14} strokeWidth={1.5} className="text-muted" />}
          options={[{ id: 'none', label: tr('Trợ lý chung', 'General') }, ...PRESETS.map((p) => ({ id: p.id as string, label: tr(p.vi, p.en) })), ...myAssistants.map((a) => ({ id: `a:${a.id}`, label: a.name }))]}
        />
        <Dropdown
          value={deep}
          onChange={setDeep}
          icon={<Zap size={14} strokeWidth={1.5} className={deep === 'none' ? 'text-muted' : 'text-primary'} />}
          options={[{ id: 'none', label: tr('Thường', 'Standard') }, ...DEEP_META.map((d) => ({ id: d.id as string, label: tr(d.vi, d.en) }))]}
        />
        {msgs.length > 0 && (
          <button type="button" className="icon-btn" onClick={exportMd} title={tr('Tải cuộc trò chuyện (.md)', 'Download conversation (.md)')} aria-label={tr('Tải cuộc trò chuyện', 'Download conversation')}>
            <Download size={15} strokeWidth={1.5} />
          </button>
        )}
        {convId && msgs.length > 0 && (
          <button type="button" className="icon-btn" onClick={shareConv} title={tr('Chia sẻ bằng liên kết', 'Share via link')} aria-label={tr('Chia sẻ', 'Share')}>
            <Link2 size={15} strokeWidth={1.5} />
          </button>
        )}
        {shareUrl && (
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1 text-xs">
            <span className="max-w-[220px] truncate font-mono text-muted">{shareUrl}</span>
            <span className="text-ok">{tr('đã chép', 'copied')}</span>
            <button type="button" className="text-danger hover:underline" onClick={unshare}>{tr('Thu hồi', 'Revoke')}</button>
          </div>
        )}
        <div className="ml-auto hidden items-center text-xs text-muted sm:flex">
          <span className="font-mono tabular-nums">{tokens?.unlimited ? '∞' : fmtNum(tokens?.balance)} token</span>
        </div>
      </div>

      {/* Khu vực tin nhắn */}
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto">
        {empty && (
          <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_25%,black,transparent)]">
            <DotField />
          </div>
        )}
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {loadingConv && (
            <div className="flex justify-center py-20 text-muted">
              <Spinner />
            </div>
          )}

          {empty && (
            <div className="stagger relative pb-6 pt-6 sm:pt-20">
              <p className="mono-label relative">{me?.user.displayName}</p>
              <h1 className="relative mt-3 text-4xl font-medium leading-[1.1] sm:text-6xl">
                <Scramble text={tr('Hỏi, tìm, viết, dựng', 'Ask, search, write, build')} />
                <span className="cursor-block ml-2 !h-[0.8em] align-baseline" />
              </h1>
              <p className="relative mt-4 max-w-md text-sm text-muted">{tr('Một cuộc trò chuyện mới. Chọn một gợi ý bên dưới hoặc nhắn thẳng vào ô chat', 'A new conversation. Pick a prompt below or type in the box')}</p>

              {me?.announcements?.length ? (
                <div className="mt-6 w-full space-y-2">
                  {me.announcements.map((a) => (
                    <div key={a.id} className="flex gap-3 border-l-2 border-primary bg-surface px-4 py-3 text-sm">
                      <Megaphone size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-muted">{a.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <ol className="relative mt-10 divide-y divide-line border-y border-line">
                {suggestions.map((s, n) => (
                  <li key={s.t} className="spot" onPointerMove={spot}>
                    <button
                      onClick={() => {
                        setInput(s.t);
                        if (s.search && me?.features.search) setSearch(true);
                        taRef.current?.focus();
                      }}
                      className="group relative flex w-full items-baseline gap-4 px-2 py-3 text-left text-sm transition-colors duration-150"
                    >
                      <span className="font-mono text-xs text-muted transition-colors duration-150 group-hover:text-primary">{String(n + 1).padStart(2, '0')}</span>
                      <span className="flex-1 text-muted transition-[color,transform] duration-200 group-hover:translate-x-1 group-hover:text-ink">{s.t}</span>
                      <ArrowUpRight size={14} strokeWidth={1.5} className="self-center text-muted opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-8">
            {msgs.map((m, i) => (
              <motion.div key={m.k ?? m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}>
                {m.role === 'user' ? (
                  <div className="flex flex-col items-end gap-1.5">
                    {m.attachments.length > 0 && (
                      <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
                        {m.attachments.map((a) =>
                          isImg(a.mime) ? (
                            <a key={a.id} href={`/api/files/${a.id}`} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/api/files/${a.id}`} alt={a.name} className="max-h-40 rounded-md border border-line object-cover" />
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
                          <div className="whitespace-pre-wrap break-words rounded-md border border-line bg-surface px-4 py-3 text-[15px] leading-7 text-ink">{m.content}</div>
                          {!busy && !m.id.startsWith('tmp-') && (
                            <button
                              className="icon-btn absolute -left-10 top-1/2 hidden h-8 w-8 -translate-y-1/2 group-hover:inline-flex max-lg:inline-flex max-lg:!-left-9"
                              aria-label={tr('Chỉnh sửa', 'Edit')}
                              title={tr('Chỉnh sửa', 'Edit')}
                              onClick={() => setEditing({ id: m.id, text: m.content })}
                            >
                              <Pencil size={14} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="mono-label mb-2">baochat</p>
                    <div className="min-w-0">
                      {m.content ? (
                        <Markdown>{m.content}</Markdown>
                      ) : m.streaming ? (
                        <div className="flex h-7 items-center gap-3 text-muted">
                          <span className="cursor-block" />
                          <span className="font-mono text-xs">{search ? tr('đang tìm và suy nghĩ', 'searching and thinking') : tr('đang xử lý', 'thinking')}</span>
                        </div>
                      ) : null}
                      {m.streaming && m.content && <span className="cursor-block ml-1" />}
                      {m.error && <div className="mt-2"><ErrorNote>{m.error}</ErrorNote></div>}
                      <SourceList sources={m.sources} />
                      {!m.streaming && m.content && (
                        <div className="mt-2 flex items-center gap-0.5 text-muted">
                          <button className="icon-btn !h-8 !w-8" onClick={() => copy(m)} title={tr('Sao chép', 'Copy')} aria-label={tr('Sao chép', 'Copy')}>
                            {copied === m.id ? <Check size={15} strokeWidth={1.5} className="text-ok" /> : <Copy size={15} strokeWidth={1.5} />}
                          </button>
                          <button className={`icon-btn !h-8 !w-8 ${speakingId === m.id ? '!text-primary' : ''}`} onClick={() => speak(m)} title={tr('Đọc to', 'Read aloud')} aria-label={tr('Đọc to', 'Read aloud')}>
                            <Volume2 size={15} strokeWidth={1.5} />
                          </button>
                          {!m.id.startsWith('tmp-') && (
                            <>
                              <button className={`icon-btn !h-8 !w-8 ${m.rating === 1 ? '!text-ok' : ''}`} onClick={() => rate(m, 1)} title={tr('Câu trả lời tốt', 'Good answer')} aria-label="Like">
                                <ThumbsUp size={15} strokeWidth={1.5} />
                              </button>
                              <button className={`icon-btn !h-8 !w-8 ${m.rating === -1 ? '!text-danger' : ''}`} onClick={() => rate(m, -1)} title={tr('Câu trả lời chưa tốt', 'Bad answer')} aria-label="Dislike">
                                <ThumbsDown size={15} strokeWidth={1.5} />
                              </button>
                            </>
                          )}
                          {i === lastAsstIdx && !busy && (
                            <button className="icon-btn !h-8 !w-8" onClick={() => run('regenerate')} disabled={outOfTokens} title={tr('Tạo lại', 'Regenerate')} aria-label={tr('Tạo lại', 'Regenerate')}>
                              <RefreshCw size={15} strokeWidth={1.5} />
                            </button>
                          )}
                          {m.model && <span className="ml-2 font-mono text-[11px]">{models.find((x) => x.id === m.model)?.label ?? m.model}</span>}
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
        <button onClick={scrollDown} className="absolute bottom-40 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-md border border-line bg-surface transition-colors hover:bg-surface2" aria-label="Scroll down">
          <ArrowDown size={16} strokeWidth={1.5} />
        </button>
      )}

      {/* Ô nhập liệu */}
      <div className="border-t border-line bg-bg px-3 pb-3 pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-2">
          {outOfTokens && tokens && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
              <span className="text-danger">{tr('Bạn đã hết token.', "You're out of tokens.")}</span>
              <span className="text-muted">
                {tr('Reset sau', 'Resets in')} <Countdown resetAt={tokens.resetAt} serverNow={tokens.serverNow} className="font-medium text-ink" />
              </span>
            </div>
          )}
          {!busy && !loadingConv && convId && msgs.length > 0 && msgs[msgs.length - 1].role === 'user' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
              <span className="text-danger">{tr('Câu hỏi này chưa có câu trả lời (AI không phản hồi).', 'This message has no reply (the AI did not respond).')}</span>
              <button className="btn-primary !py-1.5 text-xs" onClick={() => run('regenerate')} disabled={outOfTokens}>
                {tr('Thử lại', 'Retry')}
              </button>
            </div>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
          {notice && !error && <div className="rounded-md border border-line bg-surface2 px-3 py-2 text-xs text-muted">{notice}</div>}

          <div className="rounded-lg border border-line bg-surface transition-colors duration-150 focus-within:border-primary">
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
              placeholder={outOfTokens ? tr('Đang chờ reset token…', 'Waiting for token reset…') : tr('Nhắn cho Baochat', 'Message Baochat')}
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
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.pptx,.xlsx,.csv,.txt,.md,.json,.html,.css,.js,.ts,.py,.java,.cs,.lua"
                onChange={(e) => {
                  uploadFiles(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  uploadFiles(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              <button className="icon-btn" onClick={() => camRef.current?.click()} title={tr('Chụp ảnh', 'Take photo')} aria-label={tr('Chụp ảnh', 'Take photo')}>
                <Camera size={16} strokeWidth={1.5} />
              </button>
              <button className="icon-btn" onClick={() => fileRef.current?.click()} title={tr('Đính kèm tệp, hình ảnh, video', 'Attach files, images, video')} aria-label={tr('Đính kèm', 'Attach')}>
                <Paperclip size={16} strokeWidth={1.5} />
              </button>
              <button className={`icon-btn ${listening ? '!text-danger' : ''}`} onClick={toggleMic} title={listening ? tr('Dừng nói', 'Stop dictation') : tr('Nhập bằng giọng nói', 'Voice input')} aria-label={tr('Nhập bằng giọng nói', 'Voice input')} aria-pressed={listening}>
                <Mic size={16} strokeWidth={1.5} />
              </button>
              <button
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors duration-150 ${search ? 'bg-surface2 text-primary' : 'text-muted hover:bg-surface2 hover:text-ink'}`}
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
                <Globe size={15} strokeWidth={1.5} /> {tr('Tìm web', 'Web')}
              </button>
              <Link href="/studio" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink">
                <Wand2 size={15} strokeWidth={1.5} /> Studio
              </Link>
              <div className="ml-auto hidden items-center gap-1 pr-2 text-[11px] text-muted sm:flex">
                <kbd>Enter</kbd> {tr('gửi', 'send')}
                <kbd className="ml-2">Shift</kbd>+<kbd>Enter</kbd>
              </div>
              <div>
                {busy ? (
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface2 text-ink transition-colors hover:bg-line" onClick={stop} aria-label={tr('Dừng', 'Stop')} title={tr('Dừng', 'Stop')}>
                    <Square size={13} fill="currentColor" />
                  </button>
                ) : (
                  <Magnetic>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-[rgb(var(--on-primary))] transition-[background-color,transform] duration-150 hover:bg-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={send}
                    disabled={(!input.trim() && !pending.length) || uploading > 0 || outOfTokens}
                    aria-label={tr('Gửi', 'Send')}
                    title={tr('Gửi', 'Send')}
                  >
                    <ArrowUp size={16} strokeWidth={2} />
                  </button>
                  </Magnetic>
                )}
              </div>
            </div>
          </div>
          <p className="text-center font-mono text-[11px] text-muted">{tr('Baochat có thể sai, hãy kiểm tra thông tin quan trọng', 'Baochat can be wrong, check important information')}</p>
        </div>
      </div>

      <AnimatePresence>
        {dragOver && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-bg/90">
            <div className="rounded-lg border border-dashed border-primary px-10 py-8 text-center">
              <Paperclip strokeWidth={1.5} className="mx-auto mb-2 text-primary" />
              <p className="font-medium">{tr('Thả tệp để đính kèm', 'Drop files to attach')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
