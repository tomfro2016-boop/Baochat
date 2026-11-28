'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiErr } from '@/lib/client/api';

export default function SharedAssistant() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<{ name: string; description: string; owner: string } | null>(null);
  const [err, setErr] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'login'>('idle');

  useEffect(() => {
    api<{ name: string; description: string; owner: string }>(`/api/assistants/shared/${token}`)
      .then(setInfo)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [token]);

  const add = async () => {
    setState('busy');
    try {
      await api(`/api/assistants/shared/${token}`, { method: 'POST' });
      setState('done');
    } catch (e) {
      if (e instanceof ApiErr && e.status === 401) setState('login');
      else {
        setErr(e instanceof Error ? e.message : String(e));
        setState('idle');
      }
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <div className="card p-6">
        <p className="mono-label mb-2">trợ lý được chia sẻ</p>
        {err && !info && <p className="text-danger">{err}</p>}
        {info && (
          <>
            <h1 className="text-xl font-semibold">{info.name}</h1>
            <p className="mt-1 text-sm text-muted">bởi {info.owner}</p>
            {info.description && <p className="mt-3 text-sm">{info.description}</p>}
            <p className="mt-3 text-xs text-muted">Hướng dẫn bên trong do chủ trợ lý quản lý và không hiển thị với bạn.</p>
            {err && <p className="mt-3 text-sm text-danger">{err}</p>}
            {state === 'done' ? (
              <Link href="/" className="btn btn-primary mt-5 w-full justify-center">Đã thêm — mở Baochat</Link>
            ) : state === 'login' ? (
              <Link href="/login" className="btn btn-primary mt-5 w-full justify-center">Đăng nhập để thêm</Link>
            ) : (
              <button className="btn btn-primary mt-5 w-full justify-center" onClick={add} disabled={state === 'busy'}>Thêm vào trợ lý của tôi</button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
