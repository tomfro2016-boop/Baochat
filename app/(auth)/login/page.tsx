'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShell, { Divider, GoogleButton } from '@/components/AuthShell';
import { ErrorNote, Spinner } from '@/components/ui';
import { useApp } from '@/components/Providers';
import { api } from '@/lib/client/api';

function LoginForm() {
  const { tr, refresh } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const urlErr = sp.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const errMap: Record<string, string> = {
    google_not_configured: tr('Đăng nhập Google chưa được cấu hình trên máy chủ.', 'Google sign-in is not configured on the server.'),
    oauth_state: tr('Phiên đăng nhập Google không hợp lệ, hãy thử lại.', 'Invalid Google sign-in session, please try again.'),
    oauth_failed: tr('Đăng nhập Google thất bại.', 'Google sign-in failed.'),
    email_not_verified: tr('Email Google của bạn chưa được xác minh.', 'Your Google email is not verified.'),
    blocked: tr('Tài khoản của bạn đã bị khóa.', 'Your account has been blocked.'),
    registration_closed: tr('Hệ thống đang tạm đóng đăng ký.', 'Registration is currently closed.'),
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', { body: { email, password } });
      await refresh();
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={tr('Đăng nhập', 'Sign in')}
      subtitle={tr('Tiếp tục với tài khoản Baochat của bạn', 'Continue with your Baochat account')}
      footer={
        <>
          {tr('Chưa có tài khoản?', "Don't have an account?")}{' '}
          <Link className="text-ink underline decoration-primary underline-offset-4 hover:text-accent" href="/register">
            {tr('Đăng ký', 'Sign up')}
          </Link>
        </>
      }
    >
      <ErrorNote>{error || (urlErr ? errMap[urlErr] || urlErr : '')}</ErrorNote>
      <GoogleButton label={tr('Tiếp tục với Google', 'Continue with Google')} />
      <Divider text={tr('hoặc', 'or')} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="pw">{tr('Mật khẩu', 'Password')}</label>
            <Link href="/forgot" className="mb-1.5 text-xs text-ink underline decoration-primary underline-offset-4 hover:text-accent">
              {tr('Quên mật khẩu?', 'Forgot password?')}
            </Link>
          </div>
          <input id="pw" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />} {tr('Đăng nhập', 'Sign in')}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
