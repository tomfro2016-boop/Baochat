import { handler, json } from '@/lib/http';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const GET = handler(async (req) => {
  const u = await requireUser();
  const kind = new URL(req.url).searchParams.get('kind');
  const rows = kind
    ? await q('SELECT id, kind, title, updated_at FROM studio_items WHERE user_id = $1 AND kind = $2 ORDER BY updated_at DESC LIMIT 100', [u.id, kind])
    : await q('SELECT id, kind, title, updated_at FROM studio_items WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100', [u.id]);
  return json({ items: rows });
});
