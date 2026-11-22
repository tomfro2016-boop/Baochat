import { z } from 'zod';
import { handler, json, parseBody, clientIp, ApiError } from '@/lib/http';
import { q } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { consumeEmailToken, sendVerification } from '@/lib/accounts';
import { requireUser } from '@/lib/auth';

const schema = z.object({ token: z.string().min(10).max(200) });

// Xác minh bằng token trong link email
export const POST = handler(async (req) => {
  await rateLimit(`verify:${clientIp(req)}`, 30, 3600);
  const { token } = await parseBody(req, schema);
  const t = await consumeEmailToken(token, 'verify');
  if (!t) throw new ApiError(400, 'Liên kết không hợp lệ hoặc đã hết hạn.');
  await q('UPDATE users SET email_verified = true WHERE id = $1', [t.user_id]);
  return json({ ok: true });
});

// Gửi lại email xác minh
export const PUT = handler(async () => {
  const u = await requireUser();
  if (u.email_verified) return json({ ok: true, already: true });
  await rateLimit(`resend-verify:${u.id}`, 3, 3600);
  const sent = await sendVerification(u.id, u.email);
  return json({ ok: true, mailSent: sent });
});
