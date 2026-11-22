import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { payloadSchemas, type Kind } from '@/lib/studio/schemas';

const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export const GET = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!uuid(id)) throw new ApiError(404, 'Không tìm thấy');
  const item = await q1('SELECT id, kind, title, prompt, payload, updated_at FROM studio_items WHERE id = $1 AND user_id = $2', [id, u.id]);
  if (!item) throw new ApiError(404, 'Không tìm thấy');
  return json({ item });
});

// Lưu chỉnh sửa thủ công (không tốn token)
export const PUT = handler(async (req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!uuid(id)) throw new ApiError(404, 'Không tìm thấy');
  const cur = await q1<{ kind: Kind }>('SELECT kind FROM studio_items WHERE id = $1 AND user_id = $2', [id, u.id]);
  if (!cur) throw new ApiError(404, 'Không tìm thấy');
  const b = await parseBody(req, z.object({ title: z.string().trim().min(1).max(120).optional(), payload: z.unknown() }), 3_000_000);
  const payload = payloadSchemas[cur.kind].parse(b.payload);
  const item = await q1(
    `UPDATE studio_items SET payload = $3, title = COALESCE($4, title), updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING id, kind, title, payload, updated_at`,
    [id, u.id, JSON.stringify(payload), b.title ?? null],
  );
  return json({ item });
});

export const DELETE = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!uuid(id)) throw new ApiError(404, 'Không tìm thấy');
  await q('DELETE FROM studio_items WHERE id = $1 AND user_id = $2', [id, u.id]);
  return json({ ok: true });
});
