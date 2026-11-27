'use client';

import { useCallback, useEffect, useState } from 'react';
import { Brain, Check, Plus, Trash2 } from 'lucide-react';
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
                      <span className="flex-1 break-words">{m.content}</span>
                      <span className="chip shrink-0 !py-0.5 text-[10px]">{m.source === 'auto' ? 'auto' : tr('thủ công', 'manual')}</span>
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
