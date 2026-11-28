'use client';

import { useMemo, useRef, useState } from 'react';
import { Copy, Download, Eye, PenLine, Undo2, Wand2, X } from 'lucide-react';
import Markdown from './Markdown';
import { useApp } from './Providers';
import { api } from '@/lib/client/api';

function htmlFrom(doc: string): string | null {
  const m = /```html\s*\n([\s\S]*?)```/i.exec(doc);
  if (m) return m[1];
  if (/^\s*<!doctype html|^\s*<html[\s>]/i.test(doc)) return doc;
  return null;
}

export default function Canvas({ initial, onClose }: { initial: string; onClose: () => void }) {
  const { tr } = useApp();
  const [doc, setDoc] = useState(initial);
  const [hist, setHist] = useState<string[]>([]);
  const [sel, setSel] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const [ins, setIns] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(() => htmlFrom(doc), [doc]);
  const hasSel = sel.b > sel.a;

  const push = (next: string) => {
    setHist((h) => [...h.slice(-30), doc]);
    setDoc(next);
  };

  const run = async (scope: 'selection' | 'all') => {
    if (!ins.trim() || busy) return;
    const useSel = scope === 'selection' && hasSel;
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ text: string }>('/api/canvas', {
        body: { selection: useSel ? doc.slice(sel.a, sel.b) : '', instruction: ins.trim(), document: doc, scope: useSel ? 'selection' : 'all' },
      });
      if (useSel) {
        push(doc.slice(0, sel.a) + r.text + doc.slice(sel.b));
        setSel({ a: sel.a, b: sel.a + r.text.length });
      } else push(r.text);
      setIns('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const isHtml = !!html && tab === 'preview';
    const blob = new Blob([isHtml ? html! : doc], { type: isHtml ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = isHtml ? 'baochat-canvas.html' : 'baochat-canvas.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-bg sm:w-[min(560px,50vw)]" aria-label="Canvas">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <span className="mono-label mr-2">canvas</span>
        <button className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs ${tab === 'edit' ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink'}`} onClick={() => setTab('edit')}>
          <PenLine size={14} strokeWidth={1.5} /> {tr('Soạn', 'Edit')}
        </button>
        <button className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs ${tab === 'preview' ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink'}`} onClick={() => setTab('preview')}>
          <Eye size={14} strokeWidth={1.5} /> {html ? tr('Chạy thử', 'Run') : tr('Xem', 'Preview')}
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button className="icon-btn" disabled={!hist.length} onClick={() => { setDoc(hist[hist.length - 1]); setHist((h) => h.slice(0, -1)); }} title={tr('Hoàn tác', 'Undo')} aria-label={tr('Hoàn tác', 'Undo')}>
            <Undo2 size={15} strokeWidth={1.5} />
          </button>
          <button className="icon-btn" onClick={() => navigator.clipboard.writeText(doc).catch(() => {})} title={tr('Sao chép', 'Copy')} aria-label={tr('Sao chép', 'Copy')}>
            <Copy size={15} strokeWidth={1.5} />
          </button>
          <button className="icon-btn" onClick={download} title={tr('Tải về', 'Download')} aria-label={tr('Tải về', 'Download')}>
            <Download size={15} strokeWidth={1.5} />
          </button>
          <button className="icon-btn" onClick={onClose} title={tr('Đóng', 'Close')} aria-label={tr('Đóng', 'Close')}>
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'edit' ? (
          <textarea
            ref={taRef}
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
            onSelect={(e) => setSel({ a: e.currentTarget.selectionStart, b: e.currentTarget.selectionEnd })}
            spellCheck={false}
            className="h-full min-h-[300px] w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-6 outline-none"
          />
        ) : html ? (
          <iframe title="preview" sandbox="allow-scripts" srcDoc={html} className="h-full min-h-[400px] w-full bg-white" />
        ) : (
          <div className="p-4">
            <Markdown>{doc}</Markdown>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        {err && <p className="mb-2 text-xs text-danger">{err}</p>}
        <p className="mb-2 text-xs text-muted">
          {hasSel ? tr(`Đã bôi đen ${sel.b - sel.a} ký tự: AI chỉ sửa đoạn này.`, `${sel.b - sel.a} chars selected: AI edits only this.`) : tr('Bôi đen một đoạn trong ô Soạn để sửa cục bộ, hoặc để trống để sửa cả bài.', 'Select text in the editor to edit locally, or leave empty to edit everything.')}
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={ins}
            maxLength={600}
            disabled={busy}
            placeholder={tr('Ví dụ: viết ngắn gọn hơn, đổi giọng trang trọng, thêm xử lý lỗi…', 'e.g. make it shorter, more formal, add error handling…')}
            onChange={(e) => setIns(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) run('selection');
            }}
          />
          <button className="btn btn-primary" disabled={busy || ins.trim().length < 2} onClick={() => run('selection')}>
            <Wand2 size={15} strokeWidth={1.5} /> {busy ? tr('Đang sửa…', 'Editing…') : hasSel ? tr('Sửa đoạn', 'Edit selection') : tr('Sửa cả bài', 'Edit all')}
          </button>
        </div>
      </div>
    </aside>
  );
}
