'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, AlertTriangle, Bell, Cpu, Database, Lock, LockOpen, Megaphone, Plus, RefreshCw, ScrollText, Settings2, Trash2, Users, X, Zap } from 'lucide-react';
import { ErrorNote, Field, OkNote, Page, Section, Spinner, Stat, Toggle } from '@/components/ui';
import { useApp } from '@/components/Providers';
import { api } from '@/lib/client/api';
import { fmtNum, timeAgo } from '@/lib/client/util';

type Tab = 'overview' | 'users' | 'models' | 'settings' | 'announcements' | 'logs';

const Dot = ({ ok }: { ok: boolean }) => <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-ok' : 'bg-danger'}`} />;

function useAction() {
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const run = useCallback(async (fn: () => Promise<unknown>, msg?: string) => {
    setErr('');
    try {
      await fn();
      if (msg) {
        setOk(msg);
        setTimeout(() => setOk(''), 2500);
      }
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);
  return { err, ok, run, setErr };
}

function Notes({ err, ok }: { err: string; ok: string }) {
  return (
    <>
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
    </>
  );
}

/* ------------------------------ Tổng quan ------------------------------ */
function Overview() {
  const { tr } = useApp();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    api('/api/admin/stats')
      .then(setD)
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!d)
    return (
      <div className="flex justify-center py-20 text-muted">
        <Spinner />
      </div>
    );
  const t = d.totals;
  const h = d.health;
  const maxTok = Math.max(1, ...d.daily.map((x: any) => Number(x.tokens)));
  const maxNew = Math.max(1, ...d.daily.map((x: any) => Number(x.new_users)));

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr('Tổng người dùng', 'Total users')} value={fmtNum(t.users)} sub={`${t.blocked} ${tr('bị khóa', 'blocked')}`} />
        <Stat label={tr('Đang hoạt động', 'Active now')} value={fmtNum(t.active_now)} sub={`${t.active_24h} / 24h`} />
        <Stat label={tr('Tài khoản mới', 'New accounts')} value={fmtNum(t.new_24h)} sub={`${t.new_7d} / 7 ${tr('ngày', 'days')}`} />
        <Stat label={tr('Cuộc trò chuyện', 'Conversations')} value={fmtNum(t.conversations)} sub={`${fmtNum(t.messages)} ${tr('tin nhắn', 'messages')}`} />
        <Stat label={tr('Token đã dùng', 'Tokens used')} value={fmtNum(t.tokens_used)} />
        <Stat label={tr('Lượt gọi AI', 'AI calls')} value={fmtNum(t.ai_calls)} sub={`${t.ai_calls_24h} / 24h`} />
        <Stat label={tr('Lỗi 24h', 'Errors 24h')} value={fmtNum(t.errors_24h)} />
        <Stat label={tr('Model hoạt động', 'Active models')} value={h.activeModels.length} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Section title={tr('Tình trạng hệ thống', 'System health')}>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database size={15} className="text-muted" /> Database
              </span>
              <span className="flex items-center gap-2">
                <Dot ok={h.database.ok} /> {h.database.latencyMs} ms
              </span>
            </li>
            {h.providers.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Cpu size={15} className="text-muted" /> {p.label}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Dot ok={p.enabled && p.keyPresent} /> {!p.keyPresent ? tr('thiếu API key', 'no API key') : p.enabled ? tr('sẵn sàng', 'ready') : tr('đã tắt', 'disabled')}
                </span>
              </li>
            ))}
            {[
              ['Search API', h.search.configured],
              ['Google OAuth', h.google.configured],
              ['SMTP', h.smtp.configured],
            ].map(([n, ok]) => (
              <li key={n as string} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Zap size={15} className="text-muted" /> {n}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Dot ok={!!ok} /> {ok ? tr('đã cấu hình', 'configured') : tr('chưa cấu hình', 'not configured')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            {tr('Model đang hoạt động', 'Active models')}: {h.activeModels.map((m: any) => m.label).join(', ') || '—'}
          </p>
        </Section>

        <Section title={tr('14 ngày gần nhất', 'Last 14 days')}>
          <p className="mb-1 text-xs text-muted">{tr('Token tiêu thụ', 'Tokens consumed')}</p>
          <div className="flex h-24 items-end gap-1">
            {d.daily.map((x: any) => (
              <div key={x.day} className="flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(3, (Number(x.tokens) / maxTok) * 100)}%` }} title={`${x.day}: ${fmtNum(Number(x.tokens))}`} />
            ))}
          </div>
          <p className="mb-1 mt-4 text-xs text-muted">{tr('Người dùng mới', 'New users')}</p>
          <div className="flex h-16 items-end gap-1">
            {d.daily.map((x: any) => (
              <div key={x.day} className="flex-1 rounded-t bg-ok/70" style={{ height: `${Math.max(3, (Number(x.new_users) / maxNew) * 100)}%` }} title={`${x.day}: ${x.new_users}`} />
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}

/* ------------------------------ Người dùng ------------------------------ */
function UsersTab() {
  const { tr, lang, me } = useApp();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[] | null>(null);
  const [sel, setSel] = useState<any | null>(null);
  const [amount, setAmount] = useState('1000');
  const { err, ok, run } = useAction();

  const load = useCallback(() => {
    api<{ users: any[] }>(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`)
      .then((d) => {
        setRows(d.users);
        setSel((s: any) => (s ? d.users.find((u) => u.id === s.id) ?? s : s));
      })
      .catch(() => setRows([]));
  }, [q, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const act = async (body: Record<string, unknown>, msg: string) => {
    if (!sel) return;
    if (await run(() => api(`/api/admin/users/${sel.id}`, { method: 'PATCH', body }), msg)) load();
  };
  const n = Number.parseInt(amount, 10);
  const validAmount = Number.isFinite(n);

  return (
    <>
      <Notes err={err} ok={ok} />
      <div className="mb-4 flex gap-2">
        <input
          className="input max-w-sm"
          placeholder={tr('Tìm theo email hoặc tên…', 'Search by email or name…')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface2/60 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">{tr('Người dùng', 'User')}</th>
                <th className="px-3 py-2.5 font-medium">{tr('Trạng thái', 'Status')}</th>
                <th className="px-3 py-2.5 text-right font-medium">Token</th>
                <th className="px-3 py-2.5 text-right font-medium">{tr('Đã dùng', 'Used')}</th>
                <th className="px-3 py-2.5 font-medium">{tr('Hoạt động', 'Last seen')}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows === null && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
                    <Spinner />
                  </td>
                </tr>
              )}
              {rows?.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
                    {tr('Không có người dùng.', 'No users.')}
                  </td>
                </tr>
              )}
              {rows?.map((u) => (
                <tr key={u.id} className="hover:bg-surface2/40">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">
                      {u.display_name} {u.role === 'admin' && <span className="chip ml-1 !py-0 text-[10px] !text-accent">admin</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {u.email} · BC-{String(u.seq).padStart(6, '0')}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`chip ${u.status === 'blocked' ? '!border-danger/40 !text-danger' : ''}`}>{u.status === 'blocked' ? tr('Bị khóa', 'Blocked') : tr('Hoạt động', 'Active')}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.role === 'admin' ? '∞' : `${fmtNum(u.token_balance)} / ${fmtNum(u.token_quota)}`}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{fmtNum(u.token_used_total)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">{timeAgo(u.last_seen_at, lang)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setSel(u)}>
                      {tr('Quản lý', 'Manage')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
          <button className="hover:text-ink disabled:opacity-40" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ← {tr('Trước', 'Prev')}
          </button>
          <span>
            {tr('Trang', 'Page')} {page + 1}
          </span>
          <button className="hover:text-ink disabled:opacity-40" disabled={(rows?.length ?? 0) < 25} onClick={() => setPage((p) => p + 1)}>
            {tr('Sau', 'Next')} →
          </button>
        </div>
      </div>

      {sel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setSel(null)}>
          <div className="card max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{sel.display_name}</p>
                <p className="truncate text-xs text-muted">{sel.email}</p>
              </div>
              <button className="icon-btn -mr-2 -mt-1" onClick={() => setSel(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-surface2 p-3">
                <dt className="text-[11px] text-muted">{tr('Token còn lại', 'Balance')}</dt>
                <dd className="font-semibold tabular-nums">{sel.role === 'admin' ? '∞' : fmtNum(sel.token_balance)}</dd>
              </div>
              <div className="rounded-xl bg-surface2 p-3">
                <dt className="text-[11px] text-muted">{tr('Hạn mức/chu kỳ', 'Quota/cycle')}</dt>
                <dd className="font-semibold tabular-nums">{sel.role === 'admin' ? '∞' : fmtNum(sel.token_quota)}</dd>
              </div>
            </dl>

            <Field label={tr('Số token', 'Token amount')} hint={tr('Cộng/trừ: nhập số âm để trừ.', 'Add/subtract: use a negative number to subtract.')}>
              <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn-ghost text-xs" disabled={!validAmount} onClick={() => act({ action: 'add_tokens', amount: n }, tr('Đã cộng/trừ token.', 'Tokens adjusted.'))}>
                {tr('Cộng/trừ token', 'Add / subtract')}
              </button>
              <button className="btn-ghost text-xs" disabled={!validAmount || n < 0} onClick={() => act({ action: 'set_tokens', amount: n }, tr('Đã đặt số token.', 'Balance set.'))}>
                {tr('Đặt số dư', 'Set balance')}
              </button>
              <button className="btn-ghost text-xs" disabled={!validAmount || n < 0} onClick={() => act({ action: 'set_quota', amount: n }, tr('Đã đặt hạn mức.', 'Quota set.'))}>
                {tr('Đặt hạn mức', 'Set quota')}
              </button>
              <button className="btn-ghost text-xs" onClick={() => act({ action: 'reset_now' }, tr('Đã reset token.', 'Tokens reset.'))}>
                <RefreshCw size={14} /> {tr('Reset ngay', 'Reset now')}
              </button>
            </div>

            <div className="mt-5 border-t border-line pt-4">
              {sel.status === 'blocked' ? (
                <button className="btn-primary w-full" onClick={() => act({ action: 'unblock' }, tr('Đã mở khóa.', 'Unblocked.'))}>
                  <LockOpen size={16} /> {tr('Mở khóa tài khoản', 'Unblock account')}
                </button>
              ) : (
                <button className="btn-danger w-full" disabled={sel.id === me?.user.id || sel.role === 'admin'} onClick={() => act({ action: 'block' }, tr('Đã khóa tài khoản.', 'Account blocked.'))}>
                  <Lock size={16} /> {tr('Khóa tài khoản', 'Block account')}
                </button>
              )}
              {sel.role === 'admin' && <p className="mt-2 text-center text-[11px] text-muted">{tr('Không thể khóa tài khoản quản trị.', 'Admin accounts cannot be blocked.')}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ----------------------------- Models & API ----------------------------- */
function ModelsTab() {
  const { tr } = useApp();
  const [data, setData] = useState<{ models: any[]; providers: any[] } | null>(null);
  const [tests, setTests] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({ id: '', provider_id: '', model_name: '', label: '', vision: false, multiplier: 1, priority: 100, max_output: 4096 });
  const { err, ok, run } = useAction();

  const load = useCallback(() => {
    api<{ models: any[]; providers: any[] }>('/api/admin/models').then(setData).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const patchModel = async (id: string, body: Record<string, unknown>) => {
    if (await run(() => api(`/api/admin/models/${id}`, { method: 'PATCH', body }))) load();
  };
  const patchProvider = async (id: string, body: Record<string, unknown>) => {
    if (await run(() => api(`/api/admin/providers/${id}`, { method: 'PATCH', body }), tr('Đã cập nhật provider.', 'Provider updated.'))) load();
  };
  const test = async (id: string) => {
    setTesting(id);
    try {
      const r = await api<{ ok: boolean; latencyMs?: number; error?: string }>(`/api/admin/models/${id}/test`, { method: 'POST' });
      setTests((t) => ({ ...t, [id]: r.ok ? `✓ OK (${r.latencyMs} ms)` : `✗ ${r.error}` }));
    } catch (e) {
      setTests((t) => ({ ...t, [id]: `✗ ${e instanceof Error ? e.message : e}` }));
    } finally {
      setTesting(null);
    }
  };
  const del = async (id: string) => {
    if (!confirm(tr('Xóa model này?', 'Delete this model?'))) return;
    if (await run(() => api(`/api/admin/models/${id}`, { method: 'DELETE' }))) load();
  };
  const create = async () => {
    if (await run(() => api('/api/admin/models', { body: form }), tr('Đã thêm model.', 'Model added.'))) {
      setForm({ ...form, id: '', model_name: '', label: '' });
      load();
    }
  };

  if (!data)
    return (
      <div className="flex justify-center py-20 text-muted">
        <Spinner />
      </div>
    );

  return (
    <>
      <Notes err={err} ok={ok} />
      <Section title="API Providers" hint={tr('Khóa API chỉ nằm trong biến môi trường của máy chủ; ở đây chỉ hiển thị có/không và tên biến.', 'API keys live only in server environment variables; this page only shows presence and variable names.')}>
        <div className="space-y-3">
          {data.providers.map((p) => (
            <div key={p.id} className="rounded-xl border border-line p-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-medium">{p.label}</p>
                <span className="chip">{p.kind}</span>
                <span className={`chip ${p.keyPresent ? '!text-ok' : '!text-danger'}`}>
                  <Dot ok={p.keyPresent} /> {p.api_key_env}: {p.keyPresent ? tr('đã có', 'set') : tr('thiếu', 'missing')}
                </span>
                <div className="ml-auto">
                  <Toggle checked={p.enabled} onChange={(v) => patchProvider(p.id, { enabled: v })} label={p.label} />
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  className="input !py-2 text-xs"
                  defaultValue={p.base_url}
                  aria-label="Base URL"
                  onBlur={(e) => e.target.value !== p.base_url && patchProvider(p.id, { base_url: e.target.value })}
                />
                <input
                  className="input !py-2 font-mono text-xs"
                  defaultValue={p.api_key_env}
                  aria-label="Env var name"
                  onBlur={(e) => e.target.value !== p.api_key_env && patchProvider(p.id, { api_key_env: e.target.value.trim() })}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Models" hint={tr('Số nhỏ = ưu tiên cao. Khi một model lỗi, hệ thống tự động chuyển sang model tiếp theo (fallback). Hệ số nhân dùng để tính token Baochat.', 'Lower number = higher priority. If one model fails the next is tried automatically (fallback). The multiplier scales the Baochat token cost.')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Model</th>
                <th className="px-2 py-2 font-medium">{tr('Ưu tiên', 'Priority')}</th>
                <th className="px-2 py-2 font-medium">{tr('Hệ số', 'Mult.')}</th>
                <th className="px-2 py-2 font-medium">Vision</th>
                <th className="px-2 py-2 font-medium">{tr('Bật', 'On')}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.models.map((m) => (
                <tr key={m.id} className="align-top">
                  <td className="py-3 pr-3">
                    <p className="flex items-center gap-2 font-medium">
                      <Dot ok={m.enabled && m.keyPresent} /> {m.label}
                    </p>
                    <input className="mt-1 w-full max-w-[16rem] rounded-md bg-transparent px-1 py-0.5 font-mono text-[11px] text-muted outline-none focus:bg-surface2" defaultValue={m.model_name} aria-label="Model name" onBlur={(e) => e.target.value !== m.model_name && patchModel(m.id, { model_name: e.target.value })} />
                    <p className="px-1 text-[11px] text-muted">
                      {m.id} · {m.provider_label}
                    </p>
                    {tests[m.id] && <p className={`px-1 text-[11px] ${tests[m.id].startsWith('✓') ? 'text-ok' : 'text-danger'}`}>{tests[m.id]}</p>}
                  </td>
                  <td className="px-2 py-3">
                    <input type="number" className="input !w-20 !py-1.5 text-xs" defaultValue={m.priority} onBlur={(e) => Number(e.target.value) !== m.priority && patchModel(m.id, { priority: Number(e.target.value) })} />
                  </td>
                  <td className="px-2 py-3">
                    <input type="number" step="0.1" className="input !w-20 !py-1.5 text-xs" defaultValue={m.multiplier} onBlur={(e) => Number(e.target.value) !== m.multiplier && patchModel(m.id, { multiplier: Number(e.target.value) })} />
                  </td>
                  <td className="px-2 py-3">
                    <Toggle checked={m.vision} onChange={(v) => patchModel(m.id, { vision: v })} label="vision" />
                  </td>
                  <td className="px-2 py-3">
                    <Toggle checked={m.enabled} onChange={(v) => patchModel(m.id, { enabled: v })} label="enabled" />
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right">
                    <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => test(m.id)} disabled={testing === m.id}>
                      {testing === m.id ? <Spinner /> : <Activity size={13} />} Test
                    </button>
                    <button className="icon-btn !h-8 !w-8 hover:!text-danger" onClick={() => del(m.id)} aria-label="Delete">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={tr('Thêm model', 'Add model')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID (a-z, 0-9, . _ -)">
            <input className="input" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase() })} placeholder="gpt-4o" />
          </Field>
          <Field label="Provider">
            <select className="input" value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
              <option value="">—</option>
              {data.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('Tên model của nhà cung cấp', 'Provider model name')}>
            <input className="input" value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} />
          </Field>
          <Field label={tr('Tên hiển thị', 'Display label')}>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </Field>
          <Field label={tr('Ưu tiên', 'Priority')}>
            <input type="number" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
          </Field>
          <Field label={tr('Hệ số token', 'Token multiplier')}>
            <input type="number" step="0.1" className="input" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Toggle checked={form.vision} onChange={(v) => setForm({ ...form, vision: v })} label="vision" /> {tr('Hỗ trợ hình ảnh', 'Supports images')}
          </label>
          <button className="btn-primary ml-auto" onClick={create} disabled={!form.id || !form.provider_id || !form.model_name || !form.label}>
            <Plus size={16} /> {tr('Thêm', 'Add')}
          </button>
        </div>
      </Section>
    </>
  );
}

/* -------------------------------- Cấu hình -------------------------------- */
function SettingsTab() {
  const { tr, me } = useApp();
  const [s, setS] = useState<any>(null);
  const { err, ok, run } = useAction();
  useEffect(() => {
    api<{ settings: any }>('/api/admin/settings').then((d) => setS(d.settings));
  }, []);
  if (!s)
    return (
      <div className="flex justify-center py-20 text-muted">
        <Spinner />
      </div>
    );
  const set = (k: string, v: unknown) => setS({ ...s, [k]: v });
  const save = () =>
    run(async () => {
      const body = {
        token_reset_interval_hours: Number(s.token_reset_interval_hours),
        token_grant_min: Number(s.token_grant_min),
        token_grant_max: Number(s.token_grant_max),
        registration_open: !!s.registration_open,
        default_model: String(s.default_model),
        chat_rate_per_minute: Number(s.chat_rate_per_minute),
        max_upload_mb: Number(s.max_upload_mb),
      };
      const r = await api<{ settings: any }>('/api/admin/settings', { method: 'PATCH', body });
      setS(r.settings);
    }, tr('Đã lưu cấu hình.', 'Settings saved.'));

  return (
    <>
      <Notes err={err} ok={ok} />
      <Section title={tr('Token', 'Tokens')} hint={tr('Áp dụng cho tài khoản thường. Tài khoản quản trị luôn không giới hạn.', 'Applies to regular accounts. Admin accounts are always unlimited.')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={tr('Chu kỳ reset (giờ)', 'Reset interval (hours)')} hint={tr('Áp dụng cho lần reset kế tiếp của mỗi tài khoản.', 'Applies from each account’s next reset.')}>
            <input type="number" step="0.5" min="0.02" className="input" value={s.token_reset_interval_hours} onChange={(e) => set('token_reset_interval_hours', e.target.value)} />
          </Field>
          <Field label={tr('Cấp ban đầu tối thiểu', 'Initial grant min')}>
            <input type="number" className="input" value={s.token_grant_min} onChange={(e) => set('token_grant_min', e.target.value)} />
          </Field>
          <Field label={tr('Cấp ban đầu tối đa', 'Initial grant max')}>
            <input type="number" className="input" value={s.token_grant_max} onChange={(e) => set('token_grant_max', e.target.value)} />
          </Field>
        </div>
      </Section>
      <Section title={tr('Hệ thống', 'System')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={tr('Model mặc định', 'Default model')}>
            <input className="input" value={s.default_model} onChange={(e) => set('default_model', e.target.value)} />
          </Field>
          <Field label={tr('Giới hạn tin nhắn / phút', 'Messages / minute limit')}>
            <input type="number" className="input" value={s.chat_rate_per_minute} onChange={(e) => set('chat_rate_per_minute', e.target.value)} />
          </Field>
          <Field label={tr('Dung lượng tệp tối đa (MB)', 'Max upload (MB)')}>
            <input type="number" className="input" value={s.max_upload_mb} onChange={(e) => set('max_upload_mb', e.target.value)} />
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-xl bg-surface2 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{tr('Cho phép đăng ký mới', 'Open registration')}</p>
            <p className="text-xs text-muted">{tr('Tắt để chặn tạo tài khoản mới (đăng nhập vẫn hoạt động).', 'Turn off to block new sign-ups (sign-in still works).')}</p>
          </div>
          <Toggle checked={!!s.registration_open} onChange={(v) => set('registration_open', v)} label="registration" />
        </div>
      </Section>
      <button className="btn-primary" onClick={save}>
        {tr('Lưu cấu hình', 'Save settings')}
      </button>
      <p className="mt-4 text-xs text-muted">
        {tr('Quản trị đang đăng nhập', 'Signed in as admin')}: {me?.user.email}
      </p>
    </>
  );
}

/* ------------------------------- Thông báo ------------------------------- */
function AnnouncementsTab() {
  const { tr, lang } = useApp();
  const [list, setList] = useState<any[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const { err, ok, run } = useAction();
  const load = useCallback(() => {
    api<{ announcements: any[] }>('/api/admin/announcements').then((d) => setList(d.announcements));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <Notes err={err} ok={ok} />
      <Section title={tr('Tạo thông báo', 'New announcement')} hint={tr('Hiển thị cho tất cả người dùng ở màn hình trò chuyện mới.', 'Shown to all users on the new-chat screen.')}>
        <div className="space-y-3">
          <input className="input" placeholder={tr('Tiêu đề', 'Title')} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input min-h-[80px] resize-y" placeholder={tr('Nội dung', 'Body')} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          <button
            className="btn-primary"
            disabled={!title.trim() || !body.trim()}
            onClick={async () => {
              if (await run(() => api('/api/admin/announcements', { body: { title, body } }), tr('Đã đăng thông báo.', 'Announcement posted.'))) {
                setTitle('');
                setBody('');
                load();
              }
            }}
          >
            <Megaphone size={16} /> {tr('Đăng', 'Post')}
          </button>
        </div>
      </Section>
      <div className="space-y-3">
        {list?.map((a) => (
          <div key={a.id} className="card flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.title}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{a.body}</p>
              <p className="mt-1 text-[11px] text-muted">{timeAgo(a.created_at, lang)}</p>
            </div>
            <Toggle checked={a.active} onChange={async (v) => (await run(() => api('/api/admin/announcements', { method: 'PATCH', body: { id: a.id, active: v } }))) && load()} label="active" />
            <button
              className="icon-btn hover:!text-danger"
              aria-label="Delete"
              onClick={async () => {
                if (confirm(tr('Xóa thông báo này?', 'Delete this announcement?')) && (await run(() => api(`/api/admin/announcements?id=${a.id}`, { method: 'DELETE' })))) load();
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {list?.length === 0 && <p className="text-sm text-muted">{tr('Chưa có thông báo.', 'No announcements.')}</p>}
      </div>
    </>
  );
}

/* --------------------------------- Nhật ký --------------------------------- */
function LogsTab() {
  const { tr, lang } = useApp();
  const [type, setType] = useState<'activity' | 'error'>('activity');
  const [logs, setLogs] = useState<any[] | null>(null);
  useEffect(() => {
    setLogs(null);
    api<{ logs: any[] }>(`/api/admin/logs?type=${type}`).then((d) => setLogs(d.logs)).catch(() => setLogs([]));
  }, [type]);

  return (
    <>
      <div className="mb-4 flex w-fit rounded-xl border border-line p-0.5">
        {(['activity', 'error'] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${type === t ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}>
            {t === 'activity' ? tr('Hoạt động', 'Activity') : tr('Lỗi', 'Errors')}
          </button>
        ))}
      </div>
      <div className="card divide-y divide-line">
        {logs === null && (
          <div className="flex justify-center py-10 text-muted">
            <Spinner />
          </div>
        )}
        {logs?.length === 0 && <p className="p-5 text-sm text-muted">{tr('Chưa có nhật ký.', 'No logs.')}</p>}
        {logs?.map((l) => (
          <div key={l.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {type === 'error' ? <AlertTriangle size={14} className="text-danger" /> : <ScrollText size={14} className="text-muted" />}
              <span className="font-medium">{type === 'error' ? l.source : l.action}</span>
              {l.email && <span className="text-xs text-muted">{l.email}</span>}
              {l.ip && <span className="text-xs text-muted">{l.ip}</span>}
              <span className="ml-auto text-[11px] text-muted" title={new Date(l.created_at).toLocaleString()}>
                {timeAgo(l.created_at, lang)}
              </span>
            </div>
            {type === 'error' && <p className="mt-1 break-words text-xs text-danger">{l.message}</p>}
            {l.detail && Object.keys(l.detail).length > 0 && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-surface2 p-2 font-mono text-[11px] text-muted">{JSON.stringify(l.detail)}</pre>}
          </div>
        ))}
      </div>
    </>
  );
}

export default function AdminPage() {
  const { me, tr } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (me && !me.user.isAdmin) router.replace('/');
  }, [me, router]);
  if (!me?.user.isAdmin) return null;

  const tabs: { id: Tab; icon: typeof Users; label: string }[] = [
    { id: 'overview', icon: Activity, label: tr('Tổng quan', 'Overview') },
    { id: 'users', icon: Users, label: tr('Người dùng', 'Users') },
    { id: 'models', icon: Cpu, label: 'Models & API' },
    { id: 'settings', icon: Settings2, label: tr('Cấu hình', 'Config') },
    { id: 'announcements', icon: Bell, label: tr('Thông báo', 'Announcements') },
    { id: 'logs', icon: ScrollText, label: tr('Nhật ký', 'Logs') },
  ];

  return (
    <Page wide title="Admin Dashboard" subtitle={tr('Quản trị người dùng, token, model AI và cấu hình hệ thống.', 'Manage users, tokens, AI models and system configuration.')}>
      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${tab === t.id ? 'border-primary bg-primary/15 text-ink' : 'border-line text-muted hover:bg-surface2 hover:text-ink'}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <UsersTab />}
      {tab === 'models' && <ModelsTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'announcements' && <AnnouncementsTab />}
      {tab === 'logs' && <LogsTab />}
    </Page>
  );
}
