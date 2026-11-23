import { q, q1, tx } from './db';
import { secureRandomInt } from './crypto';
import { getSettings } from './settings';
import type { User } from './auth';

/**
 * HỆ THỐNG TOKEN (toàn bộ ở server, client chỉ đọc):
 *  - Mỗi user có token_quota (cấp ngẫu nhiên 1.000-10.000 khi tạo tài khoản) và token_balance.
 *  - Mỗi lần AI trả lời, server tính token thật (usage của provider, hoặc ước lượng) và trừ trong 1 câu UPDATE nguyên tử.
 *  - Đến token_reset_at, balance được đặt lại = quota (reset "lazy" khi user truy cập, trong 1 câu UPDATE nguyên tử).
 *  - Admin (isAdmin) không bị trừ và không bị giới hạn reset; vẫn ghi nhận lượng dùng để thống kê.
 */

export async function randomInitialGrant(): Promise<number> {
  const s = await getSettings();
  const lo = Math.max(0, Math.min(s.token_grant_min, s.token_grant_max));
  const hi = Math.max(s.token_grant_min, s.token_grant_max);
  return secureRandomInt(lo, hi);
}

/** Ước lượng thô khi provider không trả về usage. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

/** Áp dụng reset nếu đã đến hạn. Trả về user đã cập nhật (hoặc dòng gốc nếu không cần reset). */
export async function applyResetIfDue<T extends { id: string; isAdmin?: boolean }>(user: T): Promise<void> {
  if (user.isAdmin) return;
  const s = await getSettings();
  const secs = Math.max(60, Math.round(s.token_reset_interval_hours * 3600));
  const row = await q1<{ token_balance: number; token_quota: number }>(
    `UPDATE users
        SET token_balance = GREATEST(token_balance, token_quota), -- giữ phần token được tặng (nếu nhiều hơn hạn mức)
            token_used_cycle = 0,
            token_reset_at = now() + make_interval(secs => $2)
      WHERE id = $1 AND token_reset_at <= now()
      RETURNING token_balance, token_quota`,
    [user.id, secs],
  );
  if (row) {
    await q(
      `INSERT INTO token_ledger (user_id, delta, balance_after, reason) VALUES ($1,$2,$3,'reset')`,
      [user.id, row.token_quota, row.token_balance],
    );
  }
}

export async function loadFreshUserTokens(userId: string) {
  return q1<{
    token_quota: number;
    token_balance: number;
    token_used_cycle: number;
    token_used_total: number;
    token_reset_at: string;
  }>('SELECT token_quota, token_balance, token_used_cycle, token_used_total, token_reset_at FROM users WHERE id = $1', [userId]);
}

export async function tokenSummary(user: User) {
  await applyResetIfDue(user);
  const t = await loadFreshUserTokens(user.id);
  return {
    unlimited: user.isAdmin,
    balance: user.isAdmin ? null : t!.token_balance,
    quota: user.isAdmin ? null : t!.token_quota,
    usedCycle: t!.token_used_cycle,
    usedTotal: t!.token_used_total,
    resetAt: user.isAdmin ? null : t!.token_reset_at,
    serverNow: new Date().toISOString(),
  };
}

/** Trừ token (nguyên tử). Balance không bao giờ âm: câu trả lời cuối cùng có thể đưa balance về 0. */
export async function chargeTokens(
  user: { id: string; isAdmin: boolean },
  amount: number,
  meta: { reason: 'chat' | 'studio' | 'memory'; model?: string; ref?: string },
): Promise<number | null> {
  const n = Math.max(0, Math.ceil(amount));
  if (n === 0) return null;
  if (user.isAdmin) {
    await tx(async (c) => {
      await c.query('UPDATE users SET token_used_total = token_used_total + $2 WHERE id = $1', [user.id, n]);
      await c.query(
        `INSERT INTO token_ledger (user_id, delta, balance_after, reason, model, ref) VALUES ($1,$2,NULL,$3,$4,$5)`,
        [user.id, -n, meta.reason, meta.model ?? null, meta.ref ?? null],
      );
    });
    return null;
  }
  const waitSecs = Math.max(60, Math.round((await getSettings()).token_exhausted_wait_hours * 3600));
  return tx(async (c) => {
    // Hết token -> lần cấp lại diễn ra sau `token_exhausted_wait_hours` giờ (không muộn hơn mốc reset hiện tại)
    const r = await c.query(
      `UPDATE users
          SET token_balance = GREATEST(token_balance - $2::bigint, 0),
              token_used_cycle = token_used_cycle + $2::bigint,
              token_used_total = token_used_total + $2::bigint,
              token_reset_at = CASE WHEN token_balance - $2::bigint <= 0
                                    THEN LEAST(token_reset_at, now() + make_interval(secs => $3::int))
                                    ELSE token_reset_at END
        WHERE id = $1
        RETURNING token_balance`,
      [user.id, n, waitSecs],
    );
    const bal = r.rows[0].token_balance as number;
    await c.query(
      `INSERT INTO token_ledger (user_id, delta, balance_after, reason, model, ref) VALUES ($1,$2,$3,$4,$5,$6)`,
      [user.id, -n, bal, meta.reason, meta.model ?? null, meta.ref ?? null],
    );
    return bal;
  });
}

/** Admin điều chỉnh token của user. */
export async function adminAdjust(userId: string, mode: 'add' | 'set' | 'quota', amount: number, adminId: string) {
  return tx(async (c) => {
    if (mode === 'quota') {
      await c.query('UPDATE users SET token_quota = $2 WHERE id = $1', [userId, amount]);
      return;
    }
    const cur = await c.query('SELECT token_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!cur.rows[0]) throw new Error('Không tìm thấy người dùng');
    const before = cur.rows[0].token_balance as number;
    const next = mode === 'set' ? Math.max(0, amount) : Math.max(0, before + amount);
    await c.query('UPDATE users SET token_balance = $2 WHERE id = $1', [userId, next]);
    await c.query(
      `INSERT INTO token_ledger (user_id, delta, balance_after, reason, ref) VALUES ($1,$2,$3,'admin_adjust',$4)`,
      [userId, next - before, next, adminId],
    );
  });
}

export async function forceResetNow(userId: string) {
  const s = await getSettings();
  const secs = Math.max(60, Math.round(s.token_reset_interval_hours * 3600));
  const row = await q1<{ token_balance: number; token_quota: number }>(
    `UPDATE users SET token_balance = token_quota, token_used_cycle = 0, token_reset_at = now() + make_interval(secs => $2)
      WHERE id = $1 RETURNING token_balance, token_quota`,
    [userId, secs],
  );
  if (row) {
    await q(`INSERT INTO token_ledger (user_id, delta, balance_after, reason) VALUES ($1,$2,$3,'reset')`, [userId, row.token_quota, row.token_balance]);
  }
}

export async function ledgerFor(userId: string, limit = 100) {
  return q(
    `SELECT id, delta, balance_after, reason, model, created_at FROM token_ledger
      WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [userId, limit],
  );
}
