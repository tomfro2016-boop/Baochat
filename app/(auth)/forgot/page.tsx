'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import { ErrorNote, OkNote, Spinner } from '@/components/ui';
import { useApp } from '@/components/Providers';
import { api } from '@/lib/client/api';

export default function ForgotPage() {
  const { tr } = useApp();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<null | { emailConfigured: boolean }>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setDone(await api('/api/auth/forgot', { body: { email } }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={tr('Quên mật khẩu', 'Forgot password')}
      subtitle={tr('Nhập email để nhận liên kết đặt lại mật khẩu', 'Enter your email to receive a reset link')}
      footer={<Link className="text-ink underline decoration-primary underline-offset-4 hover:text-accent" href="/login">{tr('← Quay lại đăng nhập', '← Back to sign in')}</Link>}
    >
      <ErrorNote>{error}</ErrorNote>
      {done ? (
        <OkNote>
          {done.emailConfigured
            ? tr('Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư (cả mục spam).', 'If that email exists, we sent a reset link. Check your inbox (and spam).')
            : tr('Máy chủ chưa cấu hình gửi email (SMTP) nên không thể gửi liên kết. Hãy liên hệ quản trị viên.', 'The server has no email (SMTP) configured, so no link could be sent. Please contact the administrator.')}
        </OkNote>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner />} {tr('Gửi liên kết', 'Send link')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
