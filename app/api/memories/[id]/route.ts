import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const DELETE = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Không tìm thấy');
  await q('DELETE FROM memories WHERE id = $1 AND user_id = $2', [id, u.id]);
  return json({ ok: true });
});

const patch = z.object({ content: z.string().trim().min(2).max(500) });

export const PATCH = handler(async (req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Không tìm thấy');
  const b = await parseBody(req, patch);
  const r = await q('UPDATE memories SET content = $3 WHERE id = $1 AND user_id = $2 RETURNING id', [id, u.id, b.content]);
  if (!r.length) throw new ApiError(404, 'Không tìm thấy');
  return json({ ok: true });
});
