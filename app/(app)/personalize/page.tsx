'use client';

import { useCallback, useEffect, useState } from 'react';
import { Brain, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ErrorNote, Field, OkNote, Page, Section, Spinner, Toggle } from '@/components/ui';
import { useApp, type Mode } from '@/components/Providers';
import { api } from '@/lib/client/api';

type Profile = {
  id: string;
  name: string;
  ai_name: string;
  style: Mode;
  humor_level: number;
  address_style: string;
  default_lang: 'auto' | 'vi' | 'en';
  custom_instructions: string;
  interests: string;
  is_active: boolean;
};
type Memory = { id: string; content: string; source: 'manual' | 'auto'; created_at: string };

const STYLES: { id: Mode; vi: string; en: string; descVi: string; descEn: string }[] = [
  { id: 'serious', vi: 'Nghiêm túc', en: 'Serious', descVi: 'Chính xác, có cấu trúc, chuyên nghiệp', descEn: 'Precise, structured, professional' },
  { id: 'casual', vi: 'Bình thường', en: 'Casual', descVi: 'Tự nhiên, thân thiện', descEn: 'Natural and friendly' },
  { id: 'funny', vi: 'Hài hước', en: 'Funny', descVi: 'Vui vẻ, trêu đùa nhẹ', descEn: 'Cheerful, light teasing' },
  { id: 'playful', vi: 'Cợt nhả', en: 'Playful', descVi: 'Như một người bạn, dí dỏm', descEn: 'Like a witty friend' },
];

type Draft = Omit<Profile, 'id' | 'is_active'>;
const toDraft = (p: Profile): Draft => ({
  name: p.name,
  ai_name: p.ai_name,
  style: p.style,
  humor_level: p.humor_level,
  address_style: p.address_style,
  default_lang: p.default_lang,
  custom_instructions: p.custom_instructions,
  interests: p.interests,
});

export default function PersonalizePage() {
  const { me, tr, refresh } = useApp();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [newMem, setNewMem] = useState('');

  const loadProfiles = useCallback(async (keep?: string) => {
    const d = await api<{ profiles: Profile[] }>('/api/profiles');
    setProfiles(d.profiles);
    const pick = d.profiles.find((p) => p.id === keep) ?? d.profiles.find((p) => p.is_active) ?? d.profiles[0] ?? null;
    setSelId(pick?.id ?? null);
    setDraft(pick ? toDraft(pick) : null);
    setDirty(false);
    return d.profiles;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let list = await loadProfiles();
        // Người dùng mới chưa có cấu hình nào: tạo cấu hình mặc định thật trong database
        if (!list.length) {
          await api('/api/profiles', { body: { name: tr('Mặc định', 'Default'), ai_name: 'Baochat', style: me?.user.defaultMode ?? 'casual' } });
          list = await loadProfiles();
          const first = list[0];
          if (first) {
            await api(`/api/profiles/${first.id}`, { method: 'PATCH', body: { activate: true } });
            await loadProfiles(first.id);
          }
        }
        const m = await api<{ memories: Memory[] }>('/api/memories');
        setMemories(m.memories);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (p: Profile) => {
    if (dirty && !confirm(tr('Bỏ các thay đổi chưa lưu?', 'Discard unsaved changes?'))) return;
    setSelId(p.id);
    setDraft(toDraft(p));
    setDirty(false);
    setErr('');
    setOk('');
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    setDirty(true);
    setOk('');
  };

  const flash = (msg: string) => {
    setOk(msg);
    setTimeout(() => setOk(''), 2500);
  };

  const save = async () => {
    if (!selId || !draft) return;
    setSaving(true);
    setErr('');
    try {
      await api(`/api/profiles/${selId}`, { method: 'PATCH', body: draft });
      await loadProfiles(selId);
      flash(tr('Đã lưu. Áp dụng từ cuộc trò chuyện tiếp theo.', 'Saved. Applies from the next message.'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const activate = async (id: string) => {
    try {
      await api(`/api/profiles/${id}`, { method: 'PATCH', body: { activate: true } });
      await loadProfiles(id);
      flash(tr('Đã chọn làm cấu hình đang dùng.', 'Set as active profile.'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const create = async () => {
    setErr('');
    try {
      const r = await api<{ profile: Profile }>('/api/profiles', { body: { name: tr('Cấu hình mới', 'New profile'), ai_name: 'Baochat', style: 'casual' } });
      await loadProfiles(r.profile.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async () => {
    if (!selId || !confirm(tr('Xóa cấu hình này?', 'Delete this profile?'))) return;
    try {
      await api(`/api/profiles/${selId}`, { method: 'DELETE' });
      await loadProfiles();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleUser = async (body: Record<string, boolean>) => {
    try {
      await api('/api/me', { method: 'PATCH', body });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const addMemory = async () => {
    const content = newMem.trim();
    if (content.length < 2) return;
    try {
      const r = await api<{ memory: Memory }>('/api/memories', { body: { content } });
      setMemories((m) => [r.memory, ...(m ?? [])]);
      setNewMem('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  type Asst = { id: string; name: string; description: string; instructions: string; share_token: string | null };
  type Added = { id: string; name: string; description: string; owner_name: string };
  const [assts, setAssts] = useState<Asst[]>([]);
  const [added, setAdded] = useState<Added[]>([]);
  const [aId, setAId] = useState<string | null>(null);
  const [aName, setAName] = useState('');
  const [aDesc, setADesc] = useState('');
  const [aText, setAText] = useState('');
  useEffect(() => {
    api<{ assistants: Asst[]; added: Added[] }>('/api/assistants').then((d) => { setAssts(d.assistants); setAdded(d.added); }).catch(() => {});
  }, []);
  const [styleText, setStyleText] = useState('');
  const [styleBusy, setStyleBusy] = useState(false);
  const learnStyle = async () => {
    setStyleBusy(true);
    setErr('');
    try {
      const r = await api<{ assistant: Asst }>('/api/style', { body: { samples: styleText } });
      setAssts((a) => [...a, r.assistant]);
      setStyleText('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStyleBusy(false);
    }
  };
  const resetAsst = () => { setAId(null); setAName(''); setADesc(''); setAText(''); };
  const saveAsst = async () => {
    if (!aName.trim() || aText.trim().length < 5) return;
    try {
      if (aId) {
        await api(`/api/assistants/${aId}`, { method: 'PATCH', body: { name: aName.trim(), description: aDesc.trim(), instructions: aText.trim() } });
        setAssts((a) => a.map((x) => (x.id === aId ? { ...x, name: aName.trim(), description: aDesc.trim(), instructions: aText.trim() } : x)));
      } else {
        const r = await api<{ assistant: Asst }>('/api/assistants', { body: { name: aName.trim(), description: aDesc.trim(), instructions: aText.trim() } });
        setAssts((a) => [...a, r.assistant]);
      }
      resetAsst();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const delAsst = async (id: string, own = true) => {
    if (own && !confirm(tr('Xóa trợ lý này? Những người đang dùng cũng sẽ mất quyền.', 'Delete this assistant? People using it lose access.'))) return;
    if (own) setAssts((a) => a.filter((x) => x.id !== id)); else setAdded((a) => a.filter((x) => x.id !== id));
    await api(`/api/assistants/${id}`, { method: 'DELETE' }).catch(() => {});
  };
  const shareAsst = async (x: Asst, enabled: boolean) => {
    try {
      const r = await api<{ token: string | null }>(`/api/assistants/${x.id}/share`, { body: { enabled } });
      setAssts((a) => a.map((y) => (y.id === x.id ? { ...y, share_token: r.token } : y)));
      if (r.token) { try { await navigator.clipboard.writeText(`${window.location.origin}/a/${r.token}`); } catch { /* tự sao chép */ } }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const saveMemory = async () => {
    const content = editVal.trim();
    if (!editId || content.length < 2) return;
    const id = editId;
    try {
      await api(`/api/memories/${id}`, { method: 'PATCH', body: { content } });
      setMemories((m) => (m ?? []).map((x) => (x.id === id ? { ...x, content } : x)));
      setEditId(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const delMemory = async (id: string) => {
    setMemories((m) => (m ?? []).filter((x) => x.id !== id));
    await api(`/api/memories/${id}`, { method: 'DELETE' }).catch(() => {});
  };
  const clearMemories = async () => {
    if (!confirm(tr('Xóa toàn bộ thông tin đã ghi nhớ?', 'Delete everything Baochat remembers?'))) return;
    await api('/api/memories', { method: 'DELETE' });
    setMemories([]);
  };

  const active = profiles?.find((p) => p.is_active);

  return (
    <Page
      title="Personalize AI"
      subtitle={tr('Tùy chỉnh cách Baochat xưng hô, nói chuyện và ghi nhớ bạn.', 'Customize how Baochat addresses, talks to and remembers you.')}
    >
      {err && (
        <div className="mb-4">
          <ErrorNote>{err}</ErrorNote>
        </div>
      )}
      {!profiles && !err && (
        <div className="flex justify-center py-20 text-muted">
          <Spinner />
        </div>
      )}

      {profiles && (
        <>
          <Section title={tr('Cấu hình AI cá nhân', 'Personal AI profiles')} hint={tr('Tạo nhiều cấu hình và chuyển đổi bất cứ lúc nào. Cấu hình có dấu ✓ đang được áp dụng.', 'Create several profiles and switch any time. The ✓ profile is the active one.')}>
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => select(p)}
                  className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm transition-colors ${selId === p.id ? 'border-primary bg-surface2 text-ink' : 'border-line text-muted hover:bg-surface2 hover:text-ink'}`}
                >
                  {p.is_active && <Check size={14} className="text-ok" />}
                  {p.name}
                </button>
              ))}
              <button onClick={create} className="btn-ghost !px-3.5 !py-2">
                <Plus size={15} /> {tr('Thêm', 'Add')}
              </button>
            </div>

            {draft && selId && (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={tr('Tên cấu hình', 'Profile name')}>
                    <input className="input" value={draft.name} maxLength={60} onChange={(e) => set('name', e.target.value)} />
                  </Field>
                  <Field label={tr('Tên của AI', 'AI name')} hint={tr('Ví dụ: Bảo, Mimi, Jarvis…', 'e.g. Bao, Mimi, Jarvis…')}>
                    <input className="input" value={draft.ai_name} maxLength={40} onChange={(e) => set('ai_name', e.target.value)} />
                  </Field>
                </div>

                <Field label={tr('Phong cách giao tiếp', 'Conversation style')}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {STYLES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => set('style', s.id)}
                        className={`rounded-md border p-3 text-left transition-colors ${draft.style === s.id ? 'border-primary bg-surface2' : 'border-line hover:bg-surface2'}`}
                      >
                        <p className="text-sm font-medium">{tr(s.vi, s.en)}</p>
                        <p className="text-xs text-muted">{tr(s.descVi, s.descEn)}</p>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label={`${tr('Mức độ hài hước', 'Humor level')}: ${draft.humor_level}%`}>
                  <input type="range" min={0} max={100} step={5} value={draft.humor_level} onChange={(e) => set('humor_level', Number(e.target.value))} className="w-full accent-[rgb(var(--primary))]" />
                  <div className="flex justify-between text-[11px] text-muted">
                    <span>{tr('Nghiêm', 'Dry')}</span>
                    <span>{tr('Rất hài', 'Hilarious')}</span>
                  </div>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={tr('Cách xưng hô', 'How to address you')} hint={tr('Ví dụ: "Gọi tôi là anh Bảo, bạn xưng em"', 'e.g. "Call me Bao, refer to yourself as Claude"')}>
                    <input className="input" value={draft.address_style} maxLength={300} onChange={(e) => set('address_style', e.target.value)} />
                  </Field>
                  <Field label={tr('Ngôn ngữ mặc định của AI', 'AI default language')}>
                    <select className="input" value={draft.default_lang} onChange={(e) => set('default_lang', e.target.value as Draft['default_lang'])}>
                      <option value="auto">{tr('Tự động theo người dùng', 'Match the user')}</option>
                      <option value="vi">Tiếng Việt</option>
                      <option value="en">English</option>
                    </select>
                  </Field>
                </div>

                <Field label={tr('Hướng dẫn riêng', 'Custom instructions')} hint={tr('AI sẽ luôn tuân theo trong mọi cuộc trò chuyện.', 'The AI follows these in every conversation.')}>
                  <textarea className="input min-h-[96px] resize-y" maxLength={2000} value={draft.custom_instructions} onChange={(e) => set('custom_instructions', e.target.value)} placeholder={tr('Ví dụ: Luôn giải thích kèm ví dụ code ngắn…', 'e.g. Always include a short code example…')} />
                </Field>
                <Field label={tr('Sở thích & thông tin về bạn', 'Interests & about you')}>
                  <textarea className="input min-h-[72px] resize-y" maxLength={800} value={draft.interests} onChange={(e) => set('interests', e.target.value)} placeholder={tr('Ví dụ: Mình là sinh viên CNTT, thích bóng đá và anime…', "e.g. I'm a CS student who likes football and anime…")} />
                </Field>

                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-primary" onClick={save} disabled={!dirty || saving}>
                    {saving ? <Spinner /> : <Check size={16} />} {tr('Lưu thay đổi', 'Save changes')}
                  </button>
                  {!profiles.find((p) => p.id === selId)?.is_active && (
                    <button className="btn-ghost" onClick={() => activate(selId)} disabled={dirty}>
                      <Check size={16} strokeWidth={1.5} /> {tr('Dùng cấu hình này', 'Use this profile')}
                    </button>
                  )}
                  <button className="btn-danger ml-auto" onClick={remove} disabled={profiles.length <= 1}>
                    <Trash2 size={16} /> {tr('Xóa', 'Delete')}
                  </button>
                </div>
                {ok && <OkNote>{ok}</OkNote>}
              </div>
            )}
            {active && <p className="mt-4 text-xs text-muted">{tr('Đang dùng', 'Active')}: {active.name}</p>}
          </Section>

          <Section title={tr('Trợ lý của tôi', 'My assistants')}>
            <div className="space-y-3">
              <p className="text-sm text-muted">{tr('Tạo vai trò riêng và chia sẻ bằng liên kết. Bạn toàn quyền sửa, thu hồi hoặc xóa; người được chia sẻ chỉ dùng được, không thấy hướng dẫn bên trong.', 'Create your own roles and share them by link. You can edit, revoke or delete; people you share with can use it but never see the instructions.')}</p>
              <input className="input" placeholder={tr('Tên trợ lý', 'Name')} maxLength={40} value={aName} onChange={(e) => setAName(e.target.value)} />
              <input className="input" placeholder={tr('Mô tả ngắn (hiện khi chia sẻ)', 'Short description (shown when shared)')} maxLength={200} value={aDesc} onChange={(e) => setADesc(e.target.value)} />
              <textarea className="input min-h-[90px]" placeholder={tr('Hướng dẫn: vai trò, giọng điệu, quy tắc…', 'Instructions: role, tone, rules…')} maxLength={3000} value={aText} onChange={(e) => setAText(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={saveAsst}>{aId ? tr('Lưu thay đổi', 'Save changes') : tr('Thêm trợ lý', 'Add assistant')}</button>
                {aId && <button className="btn btn-ghost" onClick={resetAsst}>{tr('Hủy', 'Cancel')}</button>}
              </div>
              {assts.length > 0 && (
                <ul className="space-y-2">
                  {assts.map((a) => (
                    <li key={a.id} className="rounded-md bg-surface2 px-3 py-2 text-sm">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{a.name}</p>
                          <p className="line-clamp-2 break-words text-muted">{a.description || a.instructions}</p>
                        </div>
                        <button className="shrink-0 text-muted transition-colors hover:text-ink" onClick={() => { setAId(a.id); setAName(a.name); setADesc(a.description); setAText(a.instructions); }} aria-label={tr('Sửa', 'Edit')}>
                          <Pencil size={15} />
                        </button>
                        <button className="shrink-0 text-muted transition-colors hover:text-danger" onClick={() => delAsst(a.id)} aria-label={tr('Xóa', 'Delete')}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {a.share_token ? (
                          <>
                            <span className="max-w-[260px] truncate font-mono text-muted">/a/{a.share_token}</span>
                            <button className="text-primary hover:underline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/a/${a.share_token}`).catch(() => {})}>{tr('Sao chép link', 'Copy link')}</button>
                            <button className="text-danger hover:underline" onClick={() => shareAsst(a, false)}>{tr('Thu hồi chia sẻ', 'Stop sharing')}</button>
                          </>
                        ) : (
                          <button className="text-primary hover:underline" onClick={() => shareAsst(a, true)}>{tr('Chia sẻ bằng liên kết', 'Share via link')}</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-2 border-t border-line pt-3">
                <p className="mono-label">{tr('học văn phong của tôi', 'learn my writing style')}</p>
                <p className="text-sm text-muted">{tr('Dán vài tin nhắn/email bạn đã tự viết (từ 200 ký tự). Baochat tạo trợ lý "Văn phong của tôi" để soạn thư theo giọng của bạn. Chỉ dán nội dung bạn thấy ổn khi gửi cho dịch vụ AI.', 'Paste a few messages/emails you wrote (200+ chars). Baochat creates a "My writing style" assistant. Only paste what you are comfortable sending to the AI provider.')}</p>
                <textarea className="input min-h-[110px]" maxLength={12000} value={styleText} onChange={(e) => setStyleText(e.target.value)} placeholder={tr('Dán văn bản mẫu ở đây…', 'Paste sample text here…')} />
                <button className="btn btn-primary" onClick={learnStyle} disabled={styleBusy || styleText.trim().length < 200}>{styleBusy ? tr('Đang phân tích…', 'Analyzing…') : tr('Phân tích & tạo trợ lý', 'Analyze & create assistant')}</button>
              </div>
              {added.length > 0 && (
                <>
                  <p className="mono-label pt-2">{tr('được chia sẻ với tôi', 'shared with me')}</p>
                  <ul className="space-y-2">
                    {added.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 rounded-md bg-surface2 px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{a.name} <span className="text-xs font-normal text-muted">· {a.owner_name}</span></p>
                          {a.description && <p className="line-clamp-2 break-words text-muted">{a.description}</p>}
                        </div>
                        <button className="shrink-0 text-muted transition-colors hover:text-danger" onClick={() => delAsst(a.id, false)} aria-label={tr('Gỡ', 'Remove')}>
                          <X size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Section>
          <Section title={tr('Bộ nhớ & lịch sử', 'Memory & history')}>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{tr('Ghi nhớ thông tin về tôi', 'Remember things about me')}</p>
                  <p className="text-xs text-muted">{tr('AI tự ghi nhớ thông tin hữu ích (sở thích, tên…) và dùng trong các cuộc trò chuyện sau.', 'The AI saves useful details (preferences, name…) and uses them in later chats.')}</p>
                </div>
                <Toggle checked={!!me?.user.memoryEnabled} onChange={(v) => toggleUser({ memoryEnabled: v })} label="memory" />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{tr('Dùng lịch sử trò chuyện làm ngữ cảnh', 'Use chat history as context')}</p>
                  <p className="text-xs text-muted">{tr('Tắt: mỗi câu hỏi được xử lý độc lập, AI không nhớ các tin trước trong cuộc trò chuyện.', 'Off: each message is handled on its own; the AI does not see earlier turns.')}</p>
                </div>
                <Toggle checked={!!me?.user.useHistory} onChange={(v) => toggleUser({ useHistory: v })} label="history" />
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Brain size={16} strokeWidth={1.5} className="text-muted" /> {tr('Thông tin đã ghi nhớ', 'Saved memories')}
                </h3>
                {memories && memories.length > 0 && (
                  <button className="text-xs text-danger hover:underline" onClick={clearMemories}>
                    {tr('Xóa tất cả', 'Delete all')}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={newMem}
                  maxLength={300}
                  onChange={(e) => setNewMem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) addMemory();
                  }}
                  placeholder={tr('Thêm điều bạn muốn AI nhớ…', 'Add something for the AI to remember…')}
                />
                <button className="btn-primary shrink-0" onClick={addMemory} disabled={newMem.trim().length < 2}>
                  <Plus size={16} /> {tr('Thêm', 'Add')}
                </button>
              </div>
              {memories === null ? (
                <div className="flex justify-center py-6 text-muted">
                  <Spinner />
                </div>
              ) : memories.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{tr('Chưa có thông tin nào được ghi nhớ.', 'Nothing remembered yet.')}</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {memories.map((m) => (
                    <li key={m.id} className="flex items-start gap-3 rounded-md bg-surface2 px-3 py-2 text-sm">
                      {editId === m.id ? (
                        <>
                          <input
                            className="input flex-1 !py-1"
                            value={editVal}
                            maxLength={500}
                            autoFocus
                            onChange={(e) => setEditVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveMemory();
                              if (e.key === 'Escape') setEditId(null);
                            }}
                          />
                          <button className="shrink-0 text-muted transition-colors hover:text-ok" onClick={saveMemory} aria-label={tr('Lưu', 'Save')}>
                            <Check size={15} />
                          </button>
                          <button className="shrink-0 text-muted transition-colors hover:text-ink" onClick={() => setEditId(null)} aria-label={tr('Hủy', 'Cancel')}>
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 break-words">{m.content}</span>
                          <span className="chip shrink-0 !py-0.5 text-[10px]">{m.source === 'auto' ? 'auto' : tr('thủ công', 'manual')}</span>
                          <button className="shrink-0 text-muted transition-colors hover:text-ink" onClick={() => { setEditId(m.id); setEditVal(m.content); }} aria-label={tr('Sửa', 'Edit')}>
                            <Pencil size={15} />
                          </button>
                        </>
                      )}
                      <button className="shrink-0 text-muted transition-colors hover:text-danger" onClick={() => delMemory(m.id)} aria-label={tr('Xóa', 'Delete')}>
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
        </>
      )}
    </Page>
  );
}
