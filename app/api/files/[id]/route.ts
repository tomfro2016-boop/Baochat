import { handler, ApiError } from '@/lib/http';
import { q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const GET = handler(async (_req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Không tìm thấy');
  // Kiểm tra quyền sở hữu tệp
  const f = await q1<{ name: string; mime: string; data: Buffer }>('SELECT name, mime, data FROM files WHERE id = $1 AND user_id = $2', [id, u.id]);
  if (!f) throw new ApiError(404, 'Không tìm thấy');
  const safe = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'].includes(f.mime);
  return new Response(new Uint8Array(f.data), {
    headers: {
      'content-type': safe ? f.mime : 'application/octet-stream',
      'content-disposition': `${safe && f.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
});
