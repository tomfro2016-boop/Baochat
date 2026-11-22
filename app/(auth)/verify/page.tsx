'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthShell from '@/components/AuthShell';
import { ErrorNote, OkNote, Spinner } from '@/components/ui';
import { useApp } from '@/components/Providers';
import { api } from '@/lib/client/api';

function Verify() {
  const { tr, refresh } = useApp();
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setError(tr('Liên kết không hợp lệ.', 'Invalid link.'));
      return;
    }
    api('/api/auth/verify', { body: { token } })
      .then(() => {
        setState('ok');
        refresh();
      })
      .catch((e) => {
        setState('error');
        setError(e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthShell title={tr('Xác minh email', 'Verify email')} footer={<Link className="text-accent hover:underline" href="/">{tr('Về trang chính', 'Go to app')}</Link>}>
      {state === 'loading' && (
        <div className="flex items-center gap-2 text-muted">
          <Spinner /> {tr('Đang xác minh…', 'Verifying…')}
        </div>
      )}
      {state === 'ok' && <OkNote>{tr('Email đã được xác minh. Cảm ơn bạn!', 'Your email is verified. Thank you!')}</OkNote>}
      {state === 'error' && <ErrorNote>{error}</ErrorNote>}
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
