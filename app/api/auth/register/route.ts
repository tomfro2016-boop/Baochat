import { z } from 'zod';
import { handler, json, parseBody, clientIp, ApiError } from '@/lib/http';
import { q1 } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { hashPassword } from '@/lib/crypto';
import { createUser, normalizeEmail, sendVerification } from '@/lib/accounts';
import { createSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { isAdminEmail, env } from '@/lib/env';
import { logActivity } from '@/lib/log';

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(100),
  displayName: z.string().trim().min(1).max(60),
  lang: z.enum(['vi', 'en']).optional(),
});

export const POST = handler(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`register:${ip}`, 8, 3600);
  const b = await parseBody(req, schema);
  const s = await getSettings();
  if (!s.registration_open) throw new ApiError(403, 'Hiện tại hệ thống đang tạm đóng đăng ký.');

  const email = normalizeEmail(b.email);
  // Tài khoản đặc quyền CHỈ được tạo qua Google OAuth đã xác minh.
  if (isAdminEmail(email)) throw new ApiError(400, 'Email này phải đăng nhập bằng Google.');

  const exists = await q1('SELECT id FROM users WHERE email = $1', [email]);
  if (exists) throw new ApiError(409, 'Email đã được đăng ký. Hãy đăng nhập hoặc dùng "Quên mật khẩu".');

  const user = await createUser({
    email,
    displayName: b.displayName,
    passwordHash: await hashPassword(b.password),
    emailVerified: false,
    uiLang: b.lang,
  });
  let mailSent = false;
  try {
    mailSent = await sendVerification(user.id, email);
  } catch {
    mailSent = false;
  }
  await createSession(user.id, req);
  await logActivity(user.id, 'register', { method: 'password' }, ip);
  return json({ ok: true, verificationRequired: env.smtpConfigured, mailSent });
});
