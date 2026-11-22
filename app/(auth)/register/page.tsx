'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell, { Divider, GoogleButton } from '@/components/AuthShell';
import { ErrorNote, Spinner } from '@/components/ui';
import { useApp } from '@/components/Providers';
import { api } from '@/lib/client/api';

export default function RegisterPage() {
  const { tr, lang, refresh } = useApp();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/register', { body: { email, password, displayName: name, lang } });
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
      title={tr('Tạo tài khoản', 'Create your account')}
      subtitle={tr('Nhận token miễn phí ngay khi đăng ký', 'Get free tokens as soon as you sign up')}
      footer={
        <>
          {tr('Đã có tài khoản?', 'Already have an account?')}{' '}
          <Link className="text-accent hover:underline" href="/login">
            {tr('Đăng nhập', 'Sign in')}
          </Link>
        </>
      }
    >
      <ErrorNote>{error}</ErrorNote>
      <GoogleButton label={tr('Đăng ký với Google', 'Sign up with Google')} />
      <Divider text={tr('hoặc dùng email', 'or use email')} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">{tr('Tên hiển thị', 'Display name')}</label>
          <input id="name" required maxLength={60} className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pw">{tr('Mật khẩu (tối thiểu 8 ký tự)', 'Password (min. 8 characters)')}</label>
          <input id="pw" type="password" required minLength={8} autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />} {tr('Đăng ký', 'Sign up')}
        </button>
      </form>
    </AuthShell>
  );
}
