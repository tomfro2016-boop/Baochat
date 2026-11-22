import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1, tx } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { profileSchema } from '@/lib/schemas';

const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

const patchSchema = profileSchema.partial().extend({ activate: z.boolean().optional() });

export const PATCH = handler(async (req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!uuid(id)) throw new ApiError(404, 'Không tìm thấy');
  const b = await parseBody(req, patchSchema);
  const own = await q1('SELECT id FROM ai_profiles WHERE id = $1 AND user_id = $2', [id, u.id]);
  if (!own) throw new ApiError(404, 'Không tìm thấy');

  await tx(async (c) => {
    if (b.activate) {
      await c.query('UPDATE ai_profiles SET is_active = false WHERE user_id = $1', [u.id]);
      await c.query('UPDATE ai_profiles SET is_active = true WHERE id = $1', [id]);
    }
    const { activate, ...fields } = b;
    const sets: string[] = [];
    const vals: any[] = [id];
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      vals.push(v);
      sets.push(`${k} = $${vals.length}`); // k đã được zod giới hạn trong các khóa của schema
    }
    if (sets.length) await c.query(`UPDATE ai_profiles SET ${sets.join(', ')} WHERE id = $1`, vals);
  });
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!uuid(id)) throw new ApiError(404, 'Không tìm thấy');
  const p = await q1<{ is_active: boolean }>('SELECT is_active FROM ai_profiles WHERE id = $1 AND user_id = $2', [id, u.id]);
  if (!p) throw new ApiError(404, 'Không tìm thấy');
  const n = await q1<{ n: number }>('SELECT count(*)::int AS n FROM ai_profiles WHERE user_id = $1', [u.id]);
  if ((n?.n ?? 0) <= 1) throw new ApiError(400, 'Cần giữ lại ít nhất một cấu hình');
  await q('DELETE FROM ai_profiles WHERE id = $1', [id]);
  if (p.is_active) await q(`UPDATE ai_profiles SET is_active = true WHERE id = (SELECT id FROM ai_profiles WHERE user_id = $1 ORDER BY created_at LIMIT 1)`, [u.id]);
  return json({ ok: true });
});
