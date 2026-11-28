import { randomBytes } from 'crypto';
import { handler, json, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

async function own(id: string, userId: string) {
  if (!uuid(id)) throw new ApiError(404, 'Không tìm thấy');
  const c = await q1('SELECT id FROM conversations WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!c) throw new ApiError(404, 'Không tìm thấy cuộc trò chuyện');
}

export const GET = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  await own(id, u.id);
  const r = await q1<{ token: string }>('SELECT token FROM shared_conversations WHERE conversation_id = $1', [id]);
  return json({ token: r?.token ?? null });
});

export const POST = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  await own(id, u.id);
  const ex = await q1<{ token: string }>('SELECT token FROM shared_conversations WHERE conversation_id = $1', [id]);
  if (ex) return json({ token: ex.token });
  const token = randomBytes(18).toString('base64url');
  await q('INSERT INTO shared_conversations (token, conversation_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [token, id, u.id]);
  const r = await q1<{ token: string }>('SELECT token FROM shared_conversations WHERE conversation_id = $1', [id]);
  return json({ token: r!.token });
});

export const DELETE = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  await own(id, u.id);
  await q('DELETE FROM shared_conversations WHERE conversation_id = $1 AND user_id = $2', [id, u.id]);
  return json({ ok: true });
});
