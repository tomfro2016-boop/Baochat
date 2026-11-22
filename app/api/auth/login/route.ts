import { z } from 'zod';
import { handler, json, parseBody, clientIp, ApiError } from '@/lib/http';
import { q1 } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { verifyPassword, hashPassword } from '@/lib/crypto';
import { normalizeEmail } from '@/lib/accounts';
import { createSession } from '@/lib/session';
import { logActivity } from '@/lib/log';

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(100) });

// Hash giả hợp lệ để thời gian phản hồi không lộ email có tồn tại hay không.
let dummyHash: Promise<string> | null = null;
const getDummy = () => (dummyHash ??= hashPassword('baochat-dummy-password'));

export const POST = handler(async (req) => {
  const ip = clientIp(req);
  const b = await parseBody(req, schema);
  const email = normalizeEmail(b.email);
  await rateLimit(`login-ip:${ip}`, 30, 600);
  await rateLimit(`login-email:${email}`, 10, 600);

  const u = await q1('SELECT * FROM users WHERE email = $1', [email]);
  const ok = await verifyPassword(b.password, u?.password_hash || (await getDummy()));
  if (!u || !u.password_hash || !ok) {
    await logActivity(u?.id ?? null, 'login_failed', { email }, ip);
    throw new ApiError(401, 'Email hoặc mật khẩu không đúng.');
  }
  if (u.status === 'blocked') throw new ApiError(403, 'Tài khoản của bạn đã bị khóa.');
  await createSession(u.id, req);
  await logActivity(u.id, 'login', { method: 'password' }, ip);
  return json({ ok: true });
});
