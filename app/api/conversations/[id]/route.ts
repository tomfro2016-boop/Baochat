import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export const GET = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!uuid(id)) throw new ApiError(404, 'Không tìm thấy');
  const c = await q1('SELECT id, title, mode, model_id, search_enabled FROM conversations WHERE id = $1 AND user_id = $2', [id, u.id]);
  if (!c) throw new ApiError(404, 'Không tìm thấy cuộc trò chuyện');
  const messages = await q(
    `SELECT id, role, content, attachments, sources, model, rating, created_at FROM messages
      WHERE conversation_id = $1 ORDER BY created_at, id`,
    [id],
  );
  return json({ conversation: c, messages });
});

const patch = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  mode: z.enum(['serious', 'casual', 'funny', 'playful']).nullable().optional(),
  modelId: z.string().max(80).nullable().optional(),
});

export const PATCH = handler(async (req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!uuid(id)) throw new ApiError(404, 'Không tìm thấy');
  const b = await parseBody(req, patch);
  const sets: string[] = [];
  const vals: any[] = [id, u.id];
  if (b.title !== undefined) { vals.push(b.title); sets.push(`title = $${vals.length}`); }
  if (b.mode !== undefined) { vals.push(b.mode); sets.push(`mode = $${vals.length}`); }
  if (b.modelId !== undefined) { vals.push(b.modelId); sets.push(`model_id = $${vals.length}`); }
  if (!sets.length) return json({ ok: true });
  const r = await q(`UPDATE conversations SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id`, vals);
  if (!r.length) throw new ApiError(404, 'Không tìm thấy');
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!uuid(id)) throw new ApiError(404, 'Không tìm thấy');
  await q('DELETE FROM conversations WHERE id = $1 AND user_id = $2', [id, u.id]);
  return json({ ok: true });
});
