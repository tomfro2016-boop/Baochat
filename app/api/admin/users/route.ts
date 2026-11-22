import { handler, json } from '@/lib/http';
import { q } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const GET = handler(async (req) => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const search = sp.get('q')?.trim().slice(0, 100) || '';
  const page = Math.max(0, Number(sp.get('page') || 0));
  const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
  const rows = await q(
    `SELECT id, seq, email, email_verified, display_name, role, status, token_quota, token_balance, token_used_cycle, token_used_total,
            token_reset_at, created_at, last_seen_at, (google_sub IS NOT NULL) AS has_google
       FROM users
      WHERE ($1 = '' OR email ILIKE $2 OR display_name ILIKE $2)
      ORDER BY created_at DESC LIMIT 25 OFFSET $3`,
    [search, like, page * 25],
  );
  return json({ users: rows });
});
