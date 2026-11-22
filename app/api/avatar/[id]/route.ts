import { handler, ApiError } from '@/lib/http';
import { q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const GET = handler(async (_req, ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Không tìm thấy');
  const row = await q1<{ mime: string; data: Buffer }>(
    `SELECT f.mime, f.data FROM users u JOIN files f ON f.id = u.avatar_file_id WHERE u.id = $1`,
    [id],
  );
  if (!row) throw new ApiError(404, 'Không tìm thấy');
  return new Response(new Uint8Array(row.data), {
    headers: { 'content-type': row.mime, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' },
  });
});
