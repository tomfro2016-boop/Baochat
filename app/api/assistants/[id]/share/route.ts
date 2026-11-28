import { randomBytes } from 'crypto';
import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const body = z.object({ enabled: z.boolean(), kickUsers: z.boolean().optional() });

// Chủ bật/tắt chia sẻ. Tắt = thu hồi liên kết, người đã thêm không dùng được nữa.
export const POST = handler(async (req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Không tìm thấy');
  const b = await parseBody(req, body);
  const a = await q1<{ share_token: string | null }>('SELECT share_token FROM assistants WHERE id = $1 AND user_id = $2', [id, u.id]);
  if (!a) throw new ApiError(404, 'Không tìm thấy trợ lý của bạn');
  if (b.enabled) {
    const token = a.share_token ?? randomBytes(18).toString('base64url');
    await q('UPDATE assistants SET share_token = $3 WHERE id = $1 AND user_id = $2', [id, u.id, token]);
    return json({ token });
  }
  await q('UPDATE assistants SET share_token = NULL WHERE id = $1 AND user_id = $2', [id, u.id]);
  await q('DELETE FROM assistant_subs WHERE assistant_id = $1', [id]);
  return json({ token: null });
});
