import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/log';

const patch = z.object({
  model_name: z.string().min(1).max(120).optional(),
  label: z.string().min(1).max(60).optional(),
  vision: z.boolean().optional(),
  max_output: z.number().int().min(64).max(64000).optional(),
  multiplier: z.number().min(0.1).max(100).optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  enabled: z.boolean().optional(),
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
  const r = await q(`UPDATE models SET ${sets.join(', ')} WHERE id = $1 RETURNING id`, vals);
  if (!r.length) throw new ApiError(404, 'Không tìm thấy model');
  await logActivity(admin.id, 'admin_model_update', { id, ...b });
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  await q('DELETE FROM models WHERE id = $1', [id]);
  await logActivity(admin.id, 'admin_model_delete', { id });
  return json({ ok: true });
});
