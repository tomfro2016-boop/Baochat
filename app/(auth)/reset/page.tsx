'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthShell from '@/components/AuthShell';
import { ErrorNote, OkNote, Spinner } from '@/components/ui';
import { useApp } from '@/components/Providers';
import { api } from '@/lib/client/api';

function ResetForm() {
  const { tr } = useApp();
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/reset', { body: { token, password } });
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={tr('Đặt mật khẩu mới', 'Set a new password')} footer={<Link className="text-accent hover:underline" href="/login">{tr('Đến trang đăng nhập', 'Go to sign in')}</Link>}>
      <ErrorNote>{error || (!token ? tr('Liên kết không hợp lệ.', 'Invalid link.') : '')}</ErrorNote>
      {done ? (
        <OkNote>{tr('Đã đặt lại mật khẩu. Bạn có thể đăng nhập ngay.', 'Password updated. You can sign in now.')}</OkNote>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="pw">{tr('Mật khẩu mới', 'New password')}</label>
            <input id="pw" type="password" required minLength={8} autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy || !token}>
            {busy && <Spinner />} {tr('Cập nhật mật khẩu', 'Update password')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
