import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

const patch = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(200).optional(),
  instructions: z.string().trim().min(5).max(3000).optional(),
});

// Chủ trợ lý: sửa toàn quyền
export const PATCH = handler(async (req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!isId(id)) throw new ApiError(404, 'Không tìm thấy');
  const b = await parseBody(req, patch);
  const sets: string[] = [];
  const vals: any[] = [id, u.id];
  for (const k of ['name', 'description', 'instructions'] as const) {
    if (b[k] !== undefined) { vals.push(b[k]); sets.push(`${k} = $${vals.length}`); }
  }
  if (!sets.length) return json({ ok: true });
  const r = await q(`UPDATE assistants SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id`, vals);
  if (!r.length) throw new ApiError(404, 'Không tìm thấy trợ lý của bạn');
  return json({ ok: true });
});

// Chủ: xóa hẳn (mọi người đang dùng cũng mất). Người được chia sẻ: chỉ gỡ khỏi danh sách của mình.
export const DELETE = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!isId(id)) throw new ApiError(404, 'Không tìm thấy');
  await q('DELETE FROM assistants WHERE id = $1 AND user_id = $2', [id, u.id]);
  await q('DELETE FROM assistant_subs WHERE assistant_id = $1 AND user_id = $2', [id, u.id]);
  return json({ ok: true });
});
