import { handler, json } from '@/lib/http';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const GET = handler(async (req) => {
  const u = await requireUser();
  const search = new URL(req.url).searchParams.get('q')?.trim().slice(0, 100);
  if (search) {
    const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
    const rows = await q(
      `SELECT DISTINCT c.id, c.title, c.updated_at FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
       WHERE c.user_id = $1 AND (c.title ILIKE $2 OR m.content ILIKE $2)
       ORDER BY c.updated_at DESC LIMIT 50`,
      [u.id, like],
    );
    return json({ conversations: rows });
  }
  const rows = await q('SELECT id, title, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 200', [u.id]);
  return json({ conversations: rows });
});
