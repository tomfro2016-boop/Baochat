import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const schema = z.object({ rating: z.union([z.literal(1), z.literal(-1), z.null()]) });

export const PATCH = handler(async (req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Không tìm thấy');
  const { rating } = await parseBody(req, schema);
  const r = await q(`UPDATE messages SET rating = $3 WHERE id = $1 AND user_id = $2 AND role = 'assistant' RETURNING id`, [id, u.id, rating]);
  if (!r.length) throw new ApiError(404, 'Không tìm thấy');
  return json({ ok: true });
});
