import { handler, json, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';

const OK = ['image/png', 'image/jpeg', 'image/webp'];

export const POST = handler(async (req) => {
  const u = await requireUser();
  await rateLimit(`avatar:${u.id}`, 10, 3600);
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'Thiếu tệp ảnh');
  if (!OK.includes(file.type)) throw new ApiError(400, 'Chỉ hỗ trợ PNG, JPG, WEBP');
  if (file.size > 1_500_000) throw new ApiError(400, 'Ảnh đại diện tối đa 1,5MB');
  const data = Buffer.from(await file.arrayBuffer());
  const row = await q1<{ id: string }>(
    `INSERT INTO files (user_id, name, mime, size, data, purpose) VALUES ($1,'avatar',$2,$3,$4,'avatar') RETURNING id`,
    [u.id, file.type, data.length, data],
  );
  const old = u.avatar_file_id;
  await q('UPDATE users SET avatar_file_id = $2 WHERE id = $1', [u.id, row!.id]);
  if (old) await q('DELETE FROM files WHERE id = $1 AND user_id = $2', [old, u.id]);
  return json({ ok: true });
});

export const DELETE = handler(async () => {
  const u = await requireUser();
  if (u.avatar_file_id) {
    await q('UPDATE users SET avatar_file_id = NULL WHERE id = $1', [u.id]);
    await q('DELETE FROM files WHERE id = $1 AND user_id = $2', [u.avatar_file_id, u.id]);
  }
  return json({ ok: true });
});
