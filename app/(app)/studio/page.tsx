'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileSpreadsheet,
  FileText,
  Globe2,
  ImagePlus,
  Monitor,
  Pencil,
  Plus,
  Presentation,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import Markdown from '@/components/Markdown';
import { Countdown, ErrorNote, Field, OkNote, Page, Spinner } from '@/components/ui';
import { useApp } from '@/components/Providers';
import { api, ApiErr } from '@/lib/client/api';
import { buildPreviewHtml, timeAgo } from '@/lib/client/util';

type Kind = 'website' | 'document' | 'presentation' | 'spreadsheet';
type Cell = string | number | boolean | null;
type Slide = { title: string; bullets: string[]; notes?: string };
type Payload = any;
type Item = { id: string; kind: Kind; title: string; prompt?: string; payload: Payload; updated_at: string };
type ListItem = { id: string; kind: Kind; title: string; updated_at: string };

const KINDS: { id: Kind; icon: typeof Globe2; vi: string; en: string; hintVi: string; hintEn: string; exampleVi: string; exampleEn: string }[] = [
  {
    id: 'website',
    icon: Globe2,
    vi: 'Website Builder',
    en: 'Website Builder',
    hintVi: 'Mô tả website bạn muốn: AI sinh HTML/CSS/JS (hoặc React), xem trước ngay và tải ZIP.',
    hintEn: 'Describe the site: AI writes HTML/CSS/JS (or React), previews it live and exports a ZIP.',
    exampleVi: 'Landing page cho quán cà phê specialty, tông màu nâu kem, có menu, giờ mở cửa và form liên hệ.',
    exampleEn: 'Landing page for a specialty coffee shop, cream & brown palette, with menu, opening hours and a contact form.',
  },
  {
    id: 'document',
    icon: FileText,
    vi: 'Document Studio',
    en: 'Document Studio',
    hintVi: 'Tạo tài liệu có cấu trúc; xuất DOCX, PDF, TXT hoặc Markdown.',
    hintEn: 'Create structured documents; export as DOCX, PDF, TXT or Markdown.',
    exampleVi: 'Báo cáo tổng kết dự án phần mềm quý 3 gồm mục tiêu, kết quả, rủi ro và kế hoạch quý 4.',
    exampleEn: 'A Q3 software project summary report with goals, results, risks and a Q4 plan.',
  },
  {
    id: 'presentation',
    icon: Presentation,
    vi: 'Presentation Studio',
    en: 'Presentation Studio',
    hintVi: 'Tạo slide từ chủ đề, chỉnh nội dung và tải PowerPoint (.pptx).',
    hintEn: 'Generate slides from a topic, edit them and download PowerPoint (.pptx).',
    exampleVi: 'Thuyết trình 8 slide giới thiệu trí tuệ nhân tạo cho học sinh cấp 3.',
    exampleEn: 'An 8-slide intro to artificial intelligence for high-school students.',
  },
  {
    id: 'spreadsheet',
    icon: FileSpreadsheet,
    vi: 'Spreadsheet Studio',
    en: 'Spreadsheet Studio',
    hintVi: 'Tạo bảng tính có công thức, bảng thống kê; xuất XLSX hoặc CSV.',
    hintEn: 'Build spreadsheets with formulas and summary tables; export XLSX or CSV.',
    exampleVi: 'Bảng theo dõi chi tiêu cá nhân theo tháng với tổng theo danh mục và biểu thống kê.',
    exampleEn: 'A monthly personal budget tracker with category totals and a summary sheet.',
  },
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/* ------------------------------ Website ------------------------------ */
function WebsiteEditor({ payload, onChange }: { payload: Payload; onChange: (p: Payload) => void }) {
  const { tr } = useApp();
  const files: { path: string; content: string }[] = payload.files;
  const [sel, setSel] = useState(0);
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [width, setWidth] = useState<'100%' | '768px' | '390px'>('100%');
  const idx = Math.min(sel, files.length - 1);
  const html = useMemo(() => buildPreviewHtml(files), [files]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-line p-0.5">
          {(['preview', 'code'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}>
              {v === 'preview' ? tr('Xem trước', 'Preview') : tr('Mã nguồn', 'Code')}
            </button>
          ))}
        </div>
        {view === 'preview' && (
          <div className="flex gap-0.5">
            {([
              ['100%', Monitor],
              ['768px', Tablet],
              ['390px', Smartphone],
            ] as const).map(([w, Icon]) => (
              <button key={w} onClick={() => setWidth(w)} className={`icon-btn !h-8 !w-8 ${width === w ? '!bg-surface2 !text-ink' : ''}`} aria-label={w}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        )}
        {payload.summary && <p className="ml-auto hidden max-w-sm truncate text-xs text-muted lg:block">{payload.summary}</p>}
      </div>

      {view === 'preview' ? (
        <div className="overflow-hidden rounded-md border border-line bg-surface2 p-2">
          <div className="mx-auto transition-colors duration-300" style={{ width, maxWidth: '100%' }}>
            {/* sandbox KHÔNG có allow-same-origin: mã do AI sinh không thể đọc cookie/phiên của Baochat */}
            <iframe title="preview" srcDoc={html} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="h-[560px] w-full rounded-lg bg-white" />
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-line">
          <div className="flex gap-0.5 overflow-x-auto border-b border-line bg-surface2 px-2 pt-2">
            {files.map((f, i) => (
              <button key={f.path} onClick={() => setSel(i)} className={`whitespace-nowrap rounded-t-lg px-3 py-1.5 font-mono text-xs transition-colors ${i === idx ? 'bg-[#0d1117] text-white' : 'text-muted hover:text-ink'}`}>
                {f.path}
              </button>
            ))}
          </div>
          <textarea
            spellCheck={false}
            value={files[idx].content}
            onChange={(e) => {
              const next = clone(payload);
              next.files[idx].content = e.target.value;
              onChange(next);
            }}
            className="block h-[560px] w-full resize-y bg-[#0d1117] p-4 font-mono text-[13px] leading-6 text-[#e6edf3] outline-none"
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Document ------------------------------ */
function DocumentEditor({ payload, onChange }: { payload: Payload; onChange: (p: Payload) => void }) {
  const { tr } = useApp();
  const [view, setView] = useState<'edit' | 'preview'>('preview');
  return (
    <div>
      <div className="mb-3 flex rounded-md border border-line p-0.5 sm:w-fit">
        {(['preview', 'edit'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`flex-1 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}>
            {v === 'preview' ? tr('Xem trước', 'Preview') : tr('Chỉnh sửa (Markdown)', 'Edit (Markdown)')}
          </button>
        ))}
      </div>
      {view === 'preview' ? (
        <div className="max-h-[620px] overflow-y-auto rounded-md border border-line bg-surface2/40 p-6 sm:p-8">
          <Markdown>{payload.markdown}</Markdown>
        </div>
      ) : (
        <textarea spellCheck={false} value={payload.markdown} onChange={(e) => onChange({ ...payload, markdown: e.target.value })} className="input h-[620px] resize-y font-mono text-[13px] leading-6" />
      )}
    </div>
  );
}

/* ---------------------------- Presentation ---------------------------- */
function PresentationEditor({ payload, onChange }: { payload: Payload; onChange: (p: Payload) => void }) {
  const { tr, me } = useApp();
  const deck = payload.deck as { title: string; subtitle?: string; slides: Slide[] };
  const imageIds: string[] = payload.imageFileIds || [];
  const [sel, setSel] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const i = Math.min(sel, deck.slides.length - 1);
  const slide = deck.slides[i];

  const mutate = (fn: (d: typeof deck) => void) => {
    const next = clone(payload);
    fn(next.deck);
    onChange(next);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= deck.slides.length) return;
    mutate((d) => {
      const [s] = d.slides.splice(from, 1);
      d.slides.splice(to, 0, s);
    });
    setSel(to);
  };

  const addImage = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setErr('');
    try {
      const ids = [...imageIds];
      for (const f of Array.from(files)) {
        if (ids.length >= 20) break;
        if (!f.type.startsWith('image/')) continue;
        const form = new FormData();
        form.append('file', f);
        const r = await api<{ id: string }>('/api/files', { form });
        ids.push(r.id);
      }
      onChange({ ...payload, imageFileIds: ids });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
      <div className="space-y-2">
        <ol className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
          <li>
            <div className="rounded-lg border border-line bg-surface2/50 px-2.5 py-2 text-[11px] text-muted">
              <span className="font-medium text-ink">{tr('Slide tiêu đề', 'Title slide')}</span>
              <span className="block truncate">{deck.title}</span>
            </div>
          </li>
          {deck.slides.map((s, n) => (
            <li key={n}>
              <button onClick={() => setSel(n)} className={`w-full rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors ${n === i ? 'border-primary bg-surface2' : 'border-line hover:bg-surface2'}`}>
                <span className="text-muted">{n + 1}.</span> <span className="font-medium">{s.title || '—'}</span>
              </button>
            </li>
          ))}
        </ol>
        <button
          className="btn-ghost w-full !py-2 text-xs"
          onClick={() => {
            mutate((d) => d.slides.push({ title: tr('Slide mới', 'New slide'), bullets: [''] }));
            setSel(deck.slides.length);
          }}
          disabled={deck.slides.length >= 40}
        >
          <Plus size={14} /> {tr('Thêm slide', 'Add slide')}
        </button>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr('Tiêu đề bài thuyết trình', 'Deck title')}>
            <input className="input" value={deck.title} maxLength={200} onChange={(e) => mutate((d) => void (d.title = e.target.value))} />
          </Field>
          <Field label={tr('Phụ đề', 'Subtitle')}>
            <input className="input" value={deck.subtitle || ''} maxLength={300} onChange={(e) => mutate((d) => void (d.subtitle = e.target.value))} />
          </Field>
        </div>

        {slide && (
          <>
            {/* Xem trước bố cục slide 16:9 */}
            <div className="aspect-video w-full overflow-hidden rounded-md border border-line bg-[#171512] p-[4%] text-white">
              <div className="flex h-full flex-col">
                <h3 className="text-[clamp(14px,2.4vw,26px)] font-medium leading-tight">{slide.title}</h3>
                <div className="my-[2%] h-[3px] w-12 rounded bg-[#F0A528]" />
                <ul className="list-disc space-y-[1%] overflow-hidden pl-[4%] text-[clamp(10px,1.5vw,16px)] leading-snug text-white/85">
                  {slide.bullets.filter(Boolean).map((b, n) => (
                    <li key={n}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {tr('Slide', 'Slide')} {i + 1}/{deck.slides.length}
                </p>
                <div className="flex gap-0.5">
                  <button className="icon-btn !h-8 !w-8" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Up">
                    <ArrowUp size={15} />
                  </button>
                  <button className="icon-btn !h-8 !w-8" onClick={() => move(i, i + 1)} disabled={i === deck.slides.length - 1} aria-label="Down">
                    <ArrowDown size={15} />
                  </button>
                  <button
                    className="icon-btn !h-8 !w-8 hover:!text-danger"
                    onClick={() => {
                      mutate((d) => void d.slides.splice(i, 1));
                      setSel(Math.max(0, i - 1));
                    }}
                    disabled={deck.slides.length <= 1}
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <Field label={tr('Tiêu đề slide', 'Slide title')}>
                <input className="input" value={slide.title} maxLength={200} onChange={(e) => mutate((d) => void (d.slides[i].title = e.target.value))} />
              </Field>
              <Field label={tr('Nội dung (mỗi dòng một ý)', 'Bullets (one per line)')}>
                <textarea
                  className="input min-h-[120px] resize-y"
                  value={slide.bullets.join('\n')}
                  onChange={(e) => mutate((d) => void (d.slides[i].bullets = e.target.value.split('\n').slice(0, 10)))}
                />
              </Field>
              <Field label={tr('Ghi chú người thuyết trình', 'Speaker notes')}>
                <textarea className="input min-h-[64px] resize-y" value={slide.notes || ''} maxLength={2000} onChange={(e) => mutate((d) => void (d.slides[i].notes = e.target.value))} />
              </Field>
            </div>
          </>
        )}

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{tr('Hình minh họa', 'Illustrations')}</p>
              <p className="text-xs text-muted">{tr('Ảnh bạn tải lên sẽ được chèn vào các slide khi xuất PPTX.', 'Uploaded images are placed on slides when exporting PPTX.')}</p>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => addImage(e.target.files)} />
            <button className="btn-ghost !py-2 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading || imageIds.length >= 20}>
              {uploading ? <Spinner /> : <ImagePlus size={15} />} {tr('Thêm ảnh', 'Add images')}
            </button>
          </div>
          {err && (
            <div className="mt-3">
              <ErrorNote>{err}</ErrorNote>
            </div>
          )}
          {imageIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {imageIds.map((id) => (
                <div key={id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/${id}`} alt="" className="h-16 w-24 rounded-lg border border-line object-cover" />
                  <button
                    className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-md bg-danger text-white group-hover:flex max-lg:flex"
                    onClick={() => onChange({ ...payload, imageFileIds: imageIds.filter((x) => x !== id) })}
                    aria-label="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {me && imageIds.length === 0 && <p className="mt-3 text-xs text-muted">{tr('Chưa có ảnh nào.', 'No images yet.')}</p>}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Spreadsheet ----------------------------- */
const MAX_VISIBLE_ROWS = 300;

function SpreadsheetEditor({ payload, onChange }: { payload: Payload; onChange: (p: Payload) => void }) {
  const { tr } = useApp();
  const sheets = payload.book.sheets as { name: string; columns: string[]; rows: Cell[][] }[];
  const [sel, setSel] = useState(0);
  const i = Math.min(sel, sheets.length - 1);
  const sheet = sheets[i];

  const mutate = (fn: (b: Payload) => void) => {
    const next = clone(payload);
    fn(next.book);
    onChange(next);
  };
  const parse = (v: string): Cell => (v === '' ? null : /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v);
  const shown = sheet.rows.slice(0, MAX_VISIBLE_ROWS);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {sheets.map((s, n) => (
          <button key={n} onClick={() => setSel(n)} className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${n === i ? 'border-primary bg-surface2' : 'border-line text-muted hover:bg-surface2'}`}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="max-h-[520px] overflow-auto rounded-md border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface2">
            <tr>
              <th className="w-10 border-b border-r border-line px-2 py-1.5 text-center text-[11px] font-normal text-muted">#</th>
              {sheet.columns.map((c, ci) => (
                <th key={ci} className="min-w-[8rem] border-b border-r border-line p-0">
                  <input
                    value={c}
                    onChange={(e) => mutate((b) => void (b.sheets[i].columns[ci] = e.target.value))}
                    className="w-full bg-transparent px-2.5 py-1.5 text-left text-xs font-medium outline-none focus:bg-surface2"
                  />
                </th>
              ))}
              <th className="w-8 border-b border-line" />
            </tr>
          </thead>
          <tbody>
            {shown.map((row, ri) => (
              <tr key={ri} className="hover:bg-surface2/30">
                <td className="border-b border-r border-line px-2 text-center text-[11px] text-muted">{ri + 1}</td>
                {sheet.columns.map((_, ci) => (
                  <td key={ci} className="border-b border-r border-line p-0">
                    <input
                      value={row[ci] === null || row[ci] === undefined ? '' : String(row[ci])}
                      onChange={(e) =>
                        mutate((b) => {
                          const r = b.sheets[i].rows[ri];
                          while (r.length < sheet.columns.length) r.push(null);
                          r[ci] = parse(e.target.value);
                        })
                      }
                      className={`w-full bg-transparent px-2.5 py-1.5 outline-none focus:bg-surface2 ${typeof row[ci] === 'number' ? 'text-right tabular-nums' : ''} ${typeof row[ci] === 'string' && String(row[ci]).startsWith('=') ? 'text-accent' : ''}`}
                    />
                  </td>
                ))}
                <td className="border-b border-line text-center">
                  <button className="text-muted hover:text-danger" onClick={() => mutate((b) => void b.sheets[i].rows.splice(ri, 1))} aria-label="Delete row">
                    <X size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-ghost !py-1.5 text-xs" onClick={() => mutate((b) => void b.sheets[i].rows.push(b.sheets[i].columns.map(() => null)))} disabled={sheet.rows.length >= 5000}>
          <Plus size={14} /> {tr('Thêm dòng', 'Add row')}
        </button>
        <button className="btn-ghost !py-1.5 text-xs" onClick={() => mutate((b) => void b.sheets[i].columns.push(`${tr('Cột', 'Column')} ${b.sheets[i].columns.length + 1}`))} disabled={sheet.columns.length >= 50}>
          <Plus size={14} /> {tr('Thêm cột', 'Add column')}
        </button>
        <span className="text-xs text-muted">
          {sheet.rows.length} {tr('dòng', 'rows')} · {sheet.columns.length} {tr('cột', 'cols')}
          {sheet.rows.length > MAX_VISIBLE_ROWS && ` · ${tr('hiển thị', 'showing')} ${MAX_VISIBLE_ROWS}`}
        </span>
        <span className="ml-auto text-[11px] text-muted">{tr('Ô bắt đầu bằng "=" là công thức Excel (tính khi mở bằng Excel).', 'Cells starting with "=" are Excel formulas (evaluated when opened in Excel).')}</span>
      </div>
    </div>
  );
}

/* -------------------------------- Page -------------------------------- */
export default function StudioPage() {
  const { me, tr, lang, patchTokens, refresh } = useApp();
  const [kind, setKind] = useState<Kind>('website');
  const meta = KINDS.find((k) => k.id === kind)!;

  const [prompt, setPrompt] = useState('');
  const [framework, setFramework] = useState<'html' | 'react'>('html');
  const [format, setFormat] = useState<'docx' | 'pdf' | 'txt' | 'md'>('docx');
  const [modelId, setModelId] = useState('auto');
  const [list, setList] = useState<ListItem[] | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [draft, setDraft] = useState<Payload | null>(null);
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refine, setRefine] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const tokens = me?.tokens;
  const outOfTokens = !!tokens && !tokens.unlimited && (tokens.balance ?? 0) <= 0;
  const models = me?.features.models ?? [];

  const loadList = useCallback(async (k: Kind) => {
    try {
      const d = await api<{ items: ListItem[] }>(`/api/studio/items?kind=${k}`);
      setList(d.items);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => {
    setList(null);
    setItem(null);
    setDraft(null);
    setDirty(false);
    setErr('');
    setOk('');
    setPrompt('');
    loadList(kind);
  }, [kind, loadList]);

  const open = (it: Item) => {
    setItem(it);
    setDraft(clone(it.payload));
    setTitle(it.title);
    setDirty(false);
    setRefine('');
  };

  const openById = async (id: string) => {
    if (dirty && !confirm(tr('Bỏ các thay đổi chưa lưu?', 'Discard unsaved changes?'))) return;
    setErr('');
    try {
      const d = await api<{ item: Item }>(`/api/studio/items/${id}`);
      open(d.item);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const flash = (m: string) => {
    setOk(m);
    setTimeout(() => setOk(''), 2500);
  };

  const generate = async (base?: Item) => {
    const text = (base ? refine : prompt).trim();
    if (text.length < 3 || generating) return;
    setGenerating(true);
    setErr('');
    try {
      const r = await api<{ item: Item; balance: number | null }>('/api/studio/generate', {
        body: {
          kind,
          prompt: text,
          framework: kind === 'website' ? framework : undefined,
          format: kind === 'document' ? format : undefined,
          baseItemId: base?.id,
          modelId: modelId === 'auto' ? null : modelId,
        },
      });
      open(r.item);
      if (r.balance !== null && r.balance !== undefined) patchTokens({ balance: r.balance });
      if (!base) setPrompt('');
      loadList(kind);
      refresh();
    } catch (e) {
      if (e instanceof ApiErr && e.data?.balance !== undefined && e.data.balance !== null) patchTokens({ balance: e.data.balance });
      setErr(e instanceof Error ? e.message : String(e));
      refresh();
    } finally {
      setGenerating(false);
    }
  };

  const save = async (): Promise<boolean> => {
    if (!item || !draft) return false;
    setSaving(true);
    setErr('');
    try {
      const d = await api<{ item: Item }>(`/api/studio/items/${item.id}`, { method: 'PUT', body: { title: title.trim() || undefined, payload: draft } });
      setItem((cur) => (cur ? { ...cur, title: d.item.title, payload: d.item.payload } : cur));
      setDirty(false);
      loadList(kind);
      flash(tr('Đã lưu.', 'Saved.'));
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const download = async (fmt?: string, sheet?: number) => {
    if (!item) return;
    if (dirty && !(await save())) return;
    const qs = new URLSearchParams();
    if (fmt) qs.set('format', fmt);
    if (sheet !== undefined) qs.set('sheet', String(sheet));
    // Content-Disposition: attachment -> trình duyệt tải tệp mà không rời trang
    window.location.href = `/api/studio/items/${item.id}/download${qs.toString() ? '?' + qs : ''}`;
  };

  const remove = async (id: string) => {
    if (!confirm(tr('Xóa mục này?', 'Delete this item?'))) return;
    await api(`/api/studio/items/${id}`, { method: 'DELETE' }).catch(() => {});
    if (item?.id === id) {
      setItem(null);
      setDraft(null);
      setDirty(false);
    }
    loadList(kind);
  };

  const onChange = (p: Payload) => {
    setDraft(p);
    setDirty(true);
    setOk('');
  };

  const downloadButtons = () => {
    if (!item) return null;
    const btn = (label: string, fmt?: string, sheet?: number) => (
      <button key={label} className="btn-ghost !py-1.5 text-xs" onClick={() => download(fmt, sheet)}>
        <Download size={14} /> {label}
      </button>
    );
    if (kind === 'website') return btn(tr('Tải ZIP', 'Download ZIP'));
    if (kind === 'document') return [btn('DOCX', 'docx'), btn('PDF', 'pdf'), btn('TXT', 'txt'), btn('Markdown', 'md')];
    if (kind === 'presentation') return btn('PowerPoint (.pptx)');
    return [btn('Excel (.xlsx)'), draft?.book?.sheets?.length ? btn(tr('CSV (sheet đầu)', 'CSV (first sheet)'), 'csv', 0) : null];
  };

  return (
    <Page wide title="Studio" subtitle={tr('Tạo website, tài liệu, slide và bảng tính thật từ mô tả của bạn.', 'Create real websites, documents, slides and spreadsheets from a description.')}>
      <div className="mb-5 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => {
              if (k.id === kind) return;
              if (dirty && !confirm(tr('Bỏ các thay đổi chưa lưu?', 'Discard unsaved changes?'))) return;
              setKind(k.id);
            }}
            className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors ${kind === k.id ? 'border-primary bg-surface2 text-ink' : 'border-line text-muted hover:bg-surface2 hover:text-ink'}`}
          >
            <k.icon size={16} /> {tr(k.vi, k.en)}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Cột trái: tạo mới + danh sách */}
        <div className="space-y-5">
          <div className="card p-4">
            <p className="mb-3 text-sm text-muted">{tr(meta.hintVi, meta.hintEn)}</p>
            <div className="space-y-3">
              <textarea
                className="input min-h-[130px] resize-y"
                value={prompt}
                maxLength={8000}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={tr(meta.exampleVi, meta.exampleEn)}
              />
              {kind === 'website' && (
                <Field label={tr('Công nghệ', 'Framework')}>
                  <select className="input" value={framework} onChange={(e) => setFramework(e.target.value as 'html' | 'react')}>
                    <option value="html">HTML + CSS + JavaScript</option>
                    <option value="react">React (một tệp, qua CDN)</option>
                  </select>
                </Field>
              )}
              {kind === 'document' && (
                <Field label={tr('Định dạng chính', 'Main format')}>
                  <select className="input" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
                    <option value="docx">DOCX (Word)</option>
                    <option value="pdf">PDF</option>
                    <option value="txt">TXT</option>
                    <option value="md">Markdown</option>
                  </select>
                </Field>
              )}
              <Field label="Model">
                <select className="input" value={modelId} onChange={(e) => setModelId(e.target.value)}>
                  <option value="auto">{tr('Tự động', 'Auto')}</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              {outOfTokens && tokens && (
                <ErrorNote>
                  {tr('Hết token. Reset sau', 'Out of tokens. Resets in')} <Countdown resetAt={tokens.resetAt} serverNow={tokens.serverNow} />
                </ErrorNote>
              )}
              <button className="btn-primary w-full" onClick={() => generate()} disabled={generating || prompt.trim().length < 3 || outOfTokens || !models.length}>
                {generating && !item ? <Spinner /> : <Wand2 size={16} strokeWidth={1.5} />} {tr('Tạo bằng AI', 'Generate with AI')}
              </button>
              {!models.length && <p className="text-xs text-danger">{tr('Chưa có model AI nào được cấu hình trên máy chủ.', 'No AI model is configured on the server.')}</p>}
              <p className="text-[11px] text-muted">{tr('Việc tạo bằng AI tiêu tốn token; chỉnh sửa thủ công và tải xuống thì miễn phí.', 'AI generation consumes tokens; manual edits and downloads are free.')}</p>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 text-sm font-medium">{tr('Đã lưu', 'Saved')}</h3>
            {list === null ? (
              <div className="flex justify-center py-4 text-muted">
                <Spinner />
              </div>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted">{tr('Chưa có mục nào.', 'Nothing yet.')}</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {list.map((it) => (
                  <li key={it.id} className="group flex items-center gap-1">
                    <button onClick={() => openById(it.id)} className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm transition-colors ${item?.id === it.id ? 'bg-surface2' : 'hover:bg-surface2/60'}`}>
                      <span className="block truncate">{it.title}</span>
                      <span className="block text-[11px] text-muted">{timeAgo(it.updated_at, lang)}</span>
                    </button>
                    <button className="icon-btn !h-8 !w-8 hover:!text-danger lg:opacity-0 lg:group-hover:opacity-100" onClick={() => remove(it.id)} aria-label="Delete">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Cột phải: trình xem / chỉnh sửa */}
        <div className="min-w-0">
          {err && (
            <div className="mb-3">
              <ErrorNote>{err}</ErrorNote>
            </div>
          )}
          {ok && (
            <div className="mb-3">
              <OkNote>{ok}</OkNote>
            </div>
          )}

          {generating && (
            <div className="card flex flex-col items-center gap-3 py-20 text-center text-muted">
              <Spinner className="!h-6 !w-6" />
              <p>{tr('AI đang tạo… có thể mất tới 1–2 phút.', 'AI is working… this can take 1–2 minutes.')}</p>
            </div>
          )}

          {!generating && !item && (
            <div className="card flex flex-col items-center gap-3 px-6 py-20 text-center">
              <meta.icon size={32} strokeWidth={1.5} className="text-muted" />
              <p className="font-medium">{tr(meta.vi, meta.en)}</p>
              <p className="max-w-sm text-sm text-muted">{tr('Mô tả ý tưởng ở bên trái rồi bấm "Tạo bằng AI", hoặc mở một mục đã lưu.', 'Describe your idea on the left and press "Generate with AI", or open a saved item.')}</p>
            </div>
          )}

          {!generating && item && draft && (
            <div className="card p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input className="input min-w-0 flex-1 !py-2 font-medium" value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} aria-label="title" />
                <button className="btn-primary !py-2 text-xs" onClick={save} disabled={!dirty || saving}>
                  {saving ? <Spinner /> : <Save size={15} />} {tr('Lưu', 'Save')}
                </button>
              </div>

              {kind === 'website' && <WebsiteEditor payload={draft} onChange={onChange} />}
              {kind === 'document' && <DocumentEditor payload={draft} onChange={onChange} />}
              {kind === 'presentation' && <PresentationEditor payload={draft} onChange={onChange} />}
              {kind === 'spreadsheet' && <SpreadsheetEditor payload={draft} onChange={onChange} />}

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">{downloadButtons()}</div>

              <div className="mt-5 rounded-md bg-surface2/60 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Pencil size={15} strokeWidth={1.5} className="text-muted" /> {tr('Nhờ AI chỉnh sửa', 'Ask AI to revise')}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input"
                    value={refine}
                    maxLength={8000}
                    onChange={(e) => setRefine(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) generate(item);
                    }}
                    placeholder={tr('Ví dụ: đổi tông màu sang xanh, thêm phần giá cả…', 'e.g. switch to a blue palette, add a pricing section…')}
                  />
                  <button className="btn-primary shrink-0" onClick={() => generate(item)} disabled={refine.trim().length < 3 || outOfTokens}>
                    {tr('Áp dụng', 'Apply')}
                  </button>
                </div>
                {dirty && <p className="mt-2 text-[11px] text-muted">{tr('Lưu ý: chỉnh sửa bằng AI dựa trên bản đã lưu; hãy bấm Lưu trước nếu bạn vừa sửa thủ công.', 'Note: AI revisions start from the saved version; press Save first if you edited manually.')}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
