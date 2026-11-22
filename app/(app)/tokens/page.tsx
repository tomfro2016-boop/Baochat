'use client';

import { useEffect, useState } from 'react';
import { Infinity as InfinityIcon, Timer } from 'lucide-react';
import { Countdown, ErrorNote, Page, Spinner, Stat } from '@/components/ui';
import { useApp, type TokenInfo } from '@/components/Providers';
import { api } from '@/lib/client/api';
import { fmtNum } from '@/lib/client/util';

type LedgerRow = { id: number; delta: number; balance_after: number | null; reason: string; model: string | null; created_at: string };
type Data = { summary: TokenInfo; ledger: LedgerRow[]; daily: { day: string; used: number }[] };

const REASONS: Record<string, [string, string]> = {
  chat: ['Trò chuyện', 'Chat'],
  studio: ['AI Studio', 'AI Studio'],
  memory: ['Ghi nhớ', 'Memory'],
  grant: ['Cấp ban đầu', 'Initial grant'],
  reset: ['Reset định kỳ', 'Scheduled reset'],
  admin_adjust: ['Quản trị điều chỉnh', 'Admin adjustment'],
};

export default function TokensPage() {
  const { tr, lang, patchTokens, me } = useApp();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Data>('/api/tokens')
      .then((d) => {
        setData(d);
        patchTokens(d.summary);
      })
      .catch((e) => setError(e.message));
    // chỉ tải một lần khi vào trang; số liệu header được đồng bộ lại sau mỗi lần reset (Countdown gọi refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.tokens.resetAt]);

  const s = data?.summary;
  const max = Math.max(1, ...(data?.daily.map((d) => d.used) ?? [1]));
  const pct = s && !s.unlimited && s.quota ? Math.max(0, Math.min(100, ((s.balance ?? 0) / s.quota) * 100)) : 100;

  return (
    <Page title="Token Usage" subtitle={tr('Theo dõi số token còn lại, đã dùng và thời điểm reset.', 'Track your remaining and used tokens, and the next reset.')}>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && (
        <div className="flex justify-center py-20 text-muted">
          <Spinner />
        </div>
      )}
      {data && s && (
        <>
          <div className="card mb-5 overflow-hidden p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted">{tr('Token hiện tại', 'Current tokens')}</p>
                <p className="mt-1 flex items-baseline gap-2 text-5xl font-semibold tabular-nums tracking-tight">
                  {s.unlimited ? <InfinityIcon size={48} className="text-accent" /> : fmtNum(s.balance)}
                  {!s.unlimited && <span className="text-lg font-normal text-muted">/ {fmtNum(s.quota)}</span>}
                </p>
              </div>
              <div className="rounded-xl bg-surface2 px-4 py-3 text-sm">
                {s.unlimited ? (
                  <p className="text-accent">{tr('Tài khoản đặc quyền: không giới hạn, không reset.', 'Privileged account: unlimited, no reset.')}</p>
                ) : (
                  <>
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <Timer size={13} /> {tr('Reset tiếp theo sau', 'Next reset in')}
                    </p>
                    <p className="mt-0.5 text-xl font-semibold">
                      <Countdown resetAt={s.resetAt} serverNow={s.serverNow} />
                    </p>
                    <p className="text-[11px] text-muted">{s.resetAt && new Date(s.resetAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</p>
                  </>
                )}
              </div>
            </div>
            {!s.unlimited && (
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface2">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            )}
            {!s.unlimited && (s.balance ?? 0) <= 0 && <p className="mt-3 text-sm text-danger">{tr('Bạn đã hết token. Hãy chờ đến lần reset tiếp theo.', "You're out of tokens. Please wait for the next reset.")}</p>}
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Stat label={tr('Tổng token được cấp', 'Total granted')} value={s.unlimited ? '∞' : fmtNum(s.quota)} sub={tr('mỗi chu kỳ', 'per cycle')} />
            <Stat label={tr('Đã dùng (chu kỳ này)', 'Used (this cycle)')} value={fmtNum(s.usedCycle)} />
            <Stat label={tr('Đã dùng (tổng cộng)', 'Used (all time)')} value={fmtNum(s.usedTotal)} />
          </div>

          <div className="card mb-5 p-5">
            <h2 className="text-base font-semibold">{tr('Tiêu thụ 14 ngày gần nhất', 'Last 14 days')}</h2>
            {data.daily.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{tr('Chưa có dữ liệu tiêu thụ.', 'No usage yet.')}</p>
            ) : (
              <div className="mt-4 flex h-36 items-end gap-1.5">
                {data.daily.map((d) => (
                  <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${fmtNum(d.used)}`}>
                    <div className="w-full rounded-t-md bg-primary/70 transition-all group-hover:brightness-125" style={{ height: `${Math.max(4, (d.used / max) * 100)}%` }} />
                    <span className="mt-1 text-center text-[10px] text-muted">{d.day.slice(8)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold">{tr('Lịch sử tiêu thụ token', 'Token history')}</h2>
            </div>
            {data.ledger.length === 0 ? (
              <p className="p-5 text-sm text-muted">{tr('Chưa có giao dịch nào.', 'No transactions yet.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface2/60 text-left text-xs text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">{tr('Thời gian', 'Time')}</th>
                      <th className="px-3 py-2.5 font-medium">{tr('Loại', 'Type')}</th>
                      <th className="px-3 py-2.5 font-medium">Model</th>
                      <th className="px-3 py-2.5 text-right font-medium">{tr('Thay đổi', 'Change')}</th>
                      <th className="px-5 py-2.5 text-right font-medium">{tr('Còn lại', 'Balance')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.ledger.map((r) => (
                      <tr key={r.id} className="hover:bg-surface2/40">
                        <td className="whitespace-nowrap px-5 py-2.5 text-muted">{new Date(r.created_at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</td>
                        <td className="px-3 py-2.5">{REASONS[r.reason] ? tr(...REASONS[r.reason]) : r.reason}</td>
                        <td className="px-3 py-2.5 text-muted">{r.model ?? '—'}</td>
                        <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${r.delta < 0 ? 'text-danger' : 'text-ok'}`}>{(r.delta > 0 ? '+' : '') + fmtNum(r.delta)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-muted">{r.balance_after === null ? '∞' : fmtNum(r.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
