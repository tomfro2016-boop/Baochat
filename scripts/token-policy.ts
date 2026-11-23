import { Client } from 'pg';

/**
 * Áp dụng chính sách token cho database hiện có:
 *  - Mỗi ngày 1.000.000.000 token (chu kỳ 24 giờ), hết token thì sau 7 giờ được cấp lại.
 *  - Tặng 1.000.000.000.000 token cho email bên dưới (cộng vào số dư; lần reset không làm mất phần tặng).
 * Chạy: npx tsx --env-file=.env.local scripts/token-policy.ts
 */
const GIFT_EMAIL = 'dinhhoaikhanhdang23092009@gmail.com';
const DAILY_QUOTA = 1_000_000_000; // 1 tỷ token mỗi ngày
const GIFT_AMOUNT = 1_000_000_000_000; // quà: 1 nghìn tỷ token

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL (chạy với --env-file=.env.local)');
  const c = new Client({ connectionString: url, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
  await c.connect();
  try {
    await c.query('BEGIN');
    const set = (k: string, v: unknown) =>
      c.query(`INSERT INTO system_settings (key, value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [k, JSON.stringify(v)]);
    await set('token_reset_interval_hours', 24);
    await set('token_exhausted_wait_hours', 7);
    await set('token_grant_min', DAILY_QUOTA);
    await set('token_grant_max', DAILY_QUOTA);

    const q = await c.query(`UPDATE users SET token_quota = $1::bigint, token_balance = GREATEST(token_balance, $1::bigint) WHERE role <> 'admin' AND token_quota < $1::bigint RETURNING id`, [DAILY_QUOTA]);
    console.log(`Đã đặt hạn mức ${DAILY_QUOTA.toLocaleString('vi-VN')} token/ngày cho ${q.rowCount} tài khoản.`);

    const u = await c.query(`SELECT id, token_balance FROM users WHERE lower(email) = lower($1)`, [GIFT_EMAIL]);
    if (u.rows[0]) {
      const r = await c.query(`UPDATE users SET token_balance = token_balance + $2::bigint WHERE id = $1 RETURNING token_balance`, [u.rows[0].id, GIFT_AMOUNT]);
      await c.query(`INSERT INTO token_ledger (user_id, delta, balance_after, reason) VALUES ($1,$2,$3,'admin_adjust')`, [u.rows[0].id, GIFT_AMOUNT, r.rows[0].token_balance]);
      console.log(`Đã tặng ${GIFT_AMOUNT.toLocaleString('vi-VN')} token cho ${GIFT_EMAIL}. Số dư mới: ${r.rows[0].token_balance}`);
    } else {
      const cur = (await c.query(`SELECT value FROM system_settings WHERE key = 'pending_gifts'`)).rows[0]?.value ?? {};
      cur[GIFT_EMAIL.toLowerCase()] = GIFT_AMOUNT;
      await set('pending_gifts', cur);
      console.log(`${GIFT_EMAIL} chưa có tài khoản: quà ${GIFT_AMOUNT.toLocaleString('vi-VN')} token sẽ tự cộng khi họ đăng ký/đăng nhập lần đầu.`);
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
