import { handler, json, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const ok = (t: string) => /^[A-Za-z0-9_-]{16,64}$/.test(t);

async function find(token: string) {
  if (!ok(token)) throw new ApiError(404, 'Liên kết không hợp lệ');
  const a = await q1<{ id: string; name: string; description: string; owner_name: string; owner_id: string }>(
    `SELECT a.id, a.name, a.description, a.user_id AS owner_id, u.display_name AS owner_name
       FROM assistants a JOIN users u ON u.id = a.user_id WHERE a.share_token = $1`,
    [token],
  );
  if (!a) throw new ApiError(404, 'Trợ lý không còn được chia sẻ');
  return a;
}

// Xem thông tin công khai (không có hướng dẫn nội bộ)
export const GET = handler(async (_req, ctx) => {
  const { token } = await ctx.params;
  const a = await find(token);
  return json({ name: a.name, description: a.description, owner: a.owner_name });
});

// Thêm vào danh sách của tôi
export const POST = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { token } = await ctx.params;
  const a = await find(token);
  if (a.owner_id !== u.id) {
    await q('INSERT INTO assistant_subs (user_id, assistant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [u.id, a.id]);
  }
  return json({ ok: true, id: a.id, own: a.owner_id === u.id });
});
