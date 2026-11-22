'use client';

import { useRef, useState } from 'react';
import { Camera, Check, Moon, Sun, Trash2 } from 'lucide-react';
import { Avatar, ErrorNote, Field, OkNote, Page, Section, Spinner } from '@/components/ui';
import { useApp, type Mode } from '@/components/Providers';
import { api } from '@/lib/client/api';

const ACCENTS = ['#7867FF', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#F43F5E', '#EC4899', '#8B5CF6'];
const MODES: { id: Mode; vi: string; en: string }[] = [
  { id: 'serious', vi: 'Nghiêm túc', en: 'Serious' },
  { id: 'casual', vi: 'Bình thường', en: 'Casual' },
  { id: 'funny', vi: 'Hài hước', en: 'Funny' },
  { id: 'playful', vi: 'Cợt nhả', en: 'Playful' },
];

export default function SettingsPage() {
  const { me, tr, lang, setLang, theme, setTheme, setAccent, refresh } = useApp();
  const u = me!.user;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(u.displayName);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwOk, setPwOk] = useState('');

  const flash = (m: string) => {
    setOk(m);
    setTimeout(() => setOk(''), 2500);
  };

  const saveName = async () => {
    const v = name.trim();
    if (!v || v === u.displayName) return;
    setSavingName(true);
    setErr('');
    try {
      await api('/api/me', { method: 'PATCH', body: { displayName: v } });
      await refresh();
      flash(tr('Đã cập nhật tên hiển thị.', 'Display name updated.'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingName(false);
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api('/api/me/avatar', { form });
      await refresh();
      flash(tr('Đã cập nhật ảnh đại diện.', 'Avatar updated.'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setErr('');
    try {
      await api('/api/me/avatar', { method: 'DELETE' });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const changePassword = async () => {
    setPwErr('');
    setPwOk('');
    if (pw.length < 8) return setPwErr(tr('Mật khẩu mới tối thiểu 8 ký tự.', 'New password must be at least 8 characters.'));
    if (pw !== pw2) return setPwErr(tr('Mật khẩu nhập lại không khớp.', 'Passwords do not match.'));
    setPwBusy(true);
    try {
      await api('/api/me/password', { body: { current: cur || undefined, password: pw } });
      setCur('');
      setPw('');
      setPw2('');
      setPwOk(tr('Đã đổi mật khẩu.', 'Password changed.'));
      await refresh();
    } catch (e) {
      setPwErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPwBusy(false);
    }
  };

  const setDefaultMode = async (m: Mode) => {
    await api('/api/me', { method: 'PATCH', body: { defaultMode: m } });
    await refresh();
  };

  return (
    <Page title={tr('Cài đặt', 'Settings')} subtitle={tr('Quản lý hồ sơ, giao diện và bảo mật tài khoản.', 'Manage your profile, appearance and account security.')}>
      {err && (
        <div className="mb-4">
          <ErrorNote>{err}</ErrorNote>
        </div>
      )}
      {ok && (
        <div className="mb-4">
          <OkNote>{ok}</OkNote>
        </div>
      )}

      <Section title={tr('Hồ sơ cá nhân', 'Profile')}>
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative">
            <Avatar name={u.displayName} url={u.avatarUrl} size={80} />
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Spinner />
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Camera size={16} /> {tr('Đổi ảnh đại diện', 'Change avatar')}
            </button>
            {u.avatarUrl && (
              <button className="btn-ghost" onClick={removeAvatar}>
                <Trash2 size={16} /> {tr('Xóa ảnh', 'Remove')}
              </button>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={tr('Tên hiển thị', 'Display name')}>
            <div className="flex gap-2">
              <input
                className="input"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveName();
                }}
              />
              <button className="btn-primary shrink-0" onClick={saveName} disabled={savingName || !name.trim() || name.trim() === u.displayName}>
                {savingName ? <Spinner /> : <Check size={16} />}
              </button>
            </div>
          </Field>
          <Field label="Email">
            <input className="input opacity-70" value={u.email} readOnly />
            <p className={`mt-1 text-xs ${u.emailVerified ? 'text-ok' : 'text-muted'}`}>{u.emailVerified ? tr('Đã xác minh', 'Verified') : tr('Chưa xác minh', 'Not verified')}</p>
          </Field>
          <Field label={tr('ID người dùng', 'User ID')}>
            <input className="input opacity-70" value={u.publicId} readOnly />
          </Field>
          <Field label={tr('Đăng nhập bằng', 'Sign-in methods')}>
            <div className="flex flex-wrap gap-2 pt-1">
              {u.hasGoogle && <span className="chip">Google</span>}
              {u.hasPassword && <span className="chip">Email + {tr('mật khẩu', 'password')}</span>}
              {u.isAdmin && <span className="chip !border-primary/50 !text-accent">Admin</span>}
            </div>
          </Field>
        </div>
      </Section>

      <Section title={tr('Giao diện & ngôn ngữ', 'Appearance & language')}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label={tr('Ngôn ngữ giao diện', 'Interface language')}>
            <div className="flex gap-2">
              {(['vi', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${lang === l ? 'border-primary bg-primary/15' : 'border-line text-muted hover:bg-surface2'}`}>
                  {l === 'vi' ? 'Tiếng Việt' : 'English'}
                </button>
              ))}
            </div>
          </Field>
          <Field label={tr('Chế độ màu', 'Theme')}>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map((t) => (
                <button key={t} onClick={() => setTheme(t)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${theme === t ? 'border-primary bg-primary/15' : 'border-line text-muted hover:bg-surface2'}`}>
                  {t === 'dark' ? <Moon size={15} /> : <Sun size={15} />} {t === 'dark' ? 'Dark' : 'Light'}
                </button>
              ))}
            </div>
          </Field>
          <Field label={tr('Màu nhấn', 'Accent color')}>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((c) => (
                <button key={c} onClick={() => setAccent(c)} aria-label={c} className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${u.accent.toLowerCase() === c.toLowerCase() ? 'border-ink' : 'border-transparent'}`} style={{ background: c }} />
              ))}
              <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-line" title={tr('Tùy chọn màu', 'Custom color')}>
                <span className="absolute inset-0" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
                <input type="color" value={u.accent} onChange={(e) => setAccent(e.target.value.toUpperCase())} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
            </div>
          </Field>
          <Field label={tr('Chế độ trò chuyện mặc định', 'Default chat mode')}>
            <select className="input" value={u.defaultMode} onChange={(e) => setDefaultMode(e.target.value as Mode)}>
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {tr(m.vi, m.en)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title={u.hasPassword ? tr('Đổi mật khẩu', 'Change password') : tr('Đặt mật khẩu', 'Set a password')} hint={u.hasPassword ? undefined : tr('Tài khoản của bạn đăng nhập bằng Google. Đặt mật khẩu để có thể đăng nhập thêm bằng email.', 'Your account uses Google sign-in. Set a password to also sign in with email.')}>
        <div className="grid max-w-md gap-4">
          {u.hasPassword && (
            <Field label={tr('Mật khẩu hiện tại', 'Current password')}>
              <input type="password" className="input" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
            </Field>
          )}
          <Field label={tr('Mật khẩu mới', 'New password')} hint={tr('Tối thiểu 8 ký tự.', 'At least 8 characters.')}>
            <input type="password" className="input" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label={tr('Nhập lại mật khẩu mới', 'Confirm new password')}>
            <input type="password" className="input" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          {pwErr && <ErrorNote>{pwErr}</ErrorNote>}
          {pwOk && <OkNote>{pwOk}</OkNote>}
          <div>
            <button className="btn-primary" onClick={changePassword} disabled={pwBusy || !pw}>
              {pwBusy && <Spinner />} {tr('Cập nhật mật khẩu', 'Update password')}
            </button>
          </div>
        </div>
      </Section>
    </Page>
  );
}
