import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { rateLimit } from '@/lib/ratelimit';
import { logActivity } from '@/lib/log';

const schema = z.object({ current: z.string().max(100).optional(), password: z.string().min(8).max(100) });

export const POST = handler(async (req) => {
  const u = await requireUser();
  await rateLimit(`pw:${u.id}`, 10, 3600);
  const b = await parseBody(req, schema);
  if (u.password_hash) {
    if (!b.current || !(await verifyPassword(b.current, u.password_hash))) throw new ApiError(400, 'Mật khẩu hiện tại không đúng.');
  } else if (!u.email_verified) {
    throw new ApiError(400, 'Cần xác minh email trước khi đặt mật khẩu.');
  }
  await q('UPDATE users SET password_hash = $2 WHERE id = $1', [u.id, await hashPassword(b.password)]);
  await logActivity(u.id, 'password_change');
  return json({ ok: true });
});
