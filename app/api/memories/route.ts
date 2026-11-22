import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const GET = handler(async () => {
  const u = await requireUser();
  return json({ memories: await q('SELECT id, content, source, created_at FROM memories WHERE user_id = $1 ORDER BY created_at DESC', [u.id]) });
});

export const POST = handler(async (req) => {
  const u = await requireUser();
  const { content } = await parseBody(req, z.object({ content: z.string().trim().min(2).max(300) }));
  const n = await q1<{ n: number }>('SELECT count(*)::int AS n FROM memories WHERE user_id = $1', [u.id]);
  if ((n?.n ?? 0) >= 100) throw new ApiError(400, 'Đã đạt tối đa 100 mục ghi nhớ');
  const row = await q1(`INSERT INTO memories (user_id, content, source) VALUES ($1,$2,'manual') RETURNING id, content, source, created_at`, [u.id, content]);
  return json({ memory: row });
});

// Xóa toàn bộ
export const DELETE = handler(async () => {
  const u = await requireUser();
  await q('DELETE FROM memories WHERE user_id = $1', [u.id]);
  return json({ ok: true });
});
