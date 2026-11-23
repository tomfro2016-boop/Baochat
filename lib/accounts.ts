import { q, q1, tx } from './db';
import { randomToken, sha256 } from './crypto';
import { randomInitialGrant } from './tokens';
import { getSettings } from './settings';
import { sendVerifyEmail } from './mail';

export function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

/** Tạo tài khoản mới kèm token khởi tạo ngẫu nhiên 1.000-10.000 (cấu hình được). */
export async function createUser(input: {
  email: string;
  displayName: string;
  passwordHash?: string | null;
  googleSub?: string | null;
  emailVerified: boolean;
  role?: 'user' | 'admin';
  uiLang?: string;
}) {
  const grant = await randomInitialGrant();
  const s = await getSettings();
  const secs = Math.max(60, Math.round(s.token_reset_interval_hours * 3600));
  return tx(async (c) => {
    const r = await c.query(
      `INSERT INTO users (email, email_verified, password_hash, google_sub, display_name, role,
                          token_quota, token_balance, token_reset_at, ui_lang)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7, now() + make_interval(secs => $8), $9)
       RETURNING *`,
      [input.email, input.emailVerified, input.passwordHash ?? null, input.googleSub ?? null, input.displayName.slice(0, 60), input.role ?? 'user', grant, secs, input.uiLang ?? 'vi'],
    );
    const u = r.rows[0];
    await c.query(`INSERT INTO token_ledger (user_id, delta, balance_after, reason) VALUES ($1,$2,$2,'grant')`, [u.id, grant]);
    await c.query(`INSERT INTO ai_profiles (user_id, name, is_active) VALUES ($1,'Mặc định',true)`, [u.id]);
    // Quà token đang chờ cho email này (đặt bằng scripts/token-policy.ts)
    const gifts = (await c.query(`SELECT value FROM system_settings WHERE key = 'pending_gifts'`)).rows[0]?.value as Record<string, number> | undefined;
    const gift = gifts?.[String(input.email).toLowerCase()];
    if (gift && gift > 0) {
      const g = await c.query(`UPDATE users SET token_balance = token_balance + $2::bigint WHERE id = $1 RETURNING token_balance`, [u.id, gift]);
      await c.query(`INSERT INTO token_ledger (user_id, delta, balance_after, reason) VALUES ($1,$2,$3,'admin_adjust')`, [u.id, gift, g.rows[0].token_balance]);
      const rest = { ...gifts }; delete rest[String(input.email).toLowerCase()];
      await c.query(`UPDATE system_settings SET value = $1::jsonb WHERE key = 'pending_gifts'`, [JSON.stringify(rest)]);
      u.token_balance = g.rows[0].token_balance;
    }
    return u;
  });
}

export async function issueEmailToken(userId: string, kind: 'verify' | 'reset', ttlHours: number) {
  const token = randomToken(32);
  await q(`DELETE FROM email_tokens WHERE user_id = $1 AND kind = $2 AND used_at IS NULL`, [userId, kind]);
  await q(
    `INSERT INTO email_tokens (user_id, kind, token_hash, expires_at) VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval)`,
    [userId, kind, sha256(token), String(ttlHours)],
  );
  return token;
}

export async function consumeEmailToken(token: string, kind: 'verify' | 'reset') {
  return q1<{ user_id: string }>(
    `UPDATE email_tokens SET used_at = now()
      WHERE token_hash = $1 AND kind = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [sha256(token), kind],
  );
}

export async function sendVerification(userId: string, email: string) {
  const token = await issueEmailToken(userId, 'verify', 24);
  return sendVerifyEmail(email, token);
}
