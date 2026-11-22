import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/log';

const patch = z.object({
  enabled: z.boolean().optional(),
  base_url: z.string().url().max(300).refine((u) => u.startsWith('https://') || u.startsWith('http://localhost'), 'Chỉ cho phép https').optional(),
  api_key_env: z.string().regex(/^[A-Z][A-Z0-9_]{2,60}$/).optional(), // TÊN biến môi trường, không phải khóa
});

export const PATCH = handler(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const b = await parseBody(req, patch);
  const sets: string[] = [];
  const vals: any[] = [id];
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    vals.push(v);
    sets.push(`${k} = $${vals.length}`);
  }
  if (!sets.length) return json({ ok: true });
  const r = await q(`UPDATE providers SET ${sets.join(', ')} WHERE id = $1 RETURNING id`, vals);
  if (!r.length) throw new ApiError(404, 'Không tìm thấy provider');
  await logActivity(admin.id, 'admin_provider_update', { id, ...b });
  return json({ ok: true });
});
