import { z } from 'zod';
import { handler, json, parseBody, clientIp } from '@/lib/http';
import { q1 } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { issueEmailToken, normalizeEmail } from '@/lib/accounts';
import { sendResetEmail } from '@/lib/mail';
import { env } from '@/lib/env';

const schema = z.object({ email: z.string().email().max(200) });

export const POST = handler(async (req) => {
  const ip = clientIp(req);
  const { email: raw } = await parseBody(req, schema);
  const email = normalizeEmail(raw);
  await rateLimit(`forgot-ip:${ip}`, 10, 3600);
  await rateLimit(`forgot-email:${email}`, 3, 3600);

  const u = await q1('SELECT id, status FROM users WHERE email = $1', [email]);
  let mailSent = false;
  if (u && u.status === 'active') {
    const token = await issueEmailToken(u.id, 'reset', 1);
    try {
      mailSent = await sendResetEmail(email, token);
    } catch {
      mailSent = false;
    }
  }
  // Luôn trả về thành công để không lộ email nào tồn tại.
  return json({ ok: true, emailConfigured: env.smtpConfigured });
});
