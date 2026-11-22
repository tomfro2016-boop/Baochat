import { z } from 'zod';
import { handler, json, parseBody, clientIp, ApiError } from '@/lib/http';
import { q } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { hashPassword } from '@/lib/crypto';
import { consumeEmailToken } from '@/lib/accounts';
import { destroyAllSessions } from '@/lib/session';
import { logActivity } from '@/lib/log';

const schema = z.object({ token: z.string().min(10).max(200), password: z.string().min(8).max(100) });

export const POST = handler(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`reset:${ip}`, 15, 3600);
  const b = await parseBody(req, schema);
  const t = await consumeEmailToken(b.token, 'reset');
  if (!t) throw new ApiError(400, 'Liên kết không hợp lệ hoặc đã hết hạn.');
  await q('UPDATE users SET password_hash = $2, email_verified = true WHERE id = $1', [t.user_id, await hashPassword(b.password)]);
  await destroyAllSessions(t.user_id); // đăng xuất mọi thiết bị
  await logActivity(t.user_id, 'password_reset', {}, ip);
  return json({ ok: true });
});
