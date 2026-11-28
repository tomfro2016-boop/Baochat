import { handler, json, ApiError } from '@/lib/http';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const DELETE = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Không tìm thấy');
  await q('DELETE FROM assistants WHERE id = $1 AND user_id = $2', [id, u.id]);
  return json({ ok: true });
});
