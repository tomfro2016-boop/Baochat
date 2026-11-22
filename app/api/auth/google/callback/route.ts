import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { env, isAdminEmail } from '@/lib/env';
import { exchangeCode } from '@/lib/google';
import { q, q1 } from '@/lib/db';
import { createUser } from '@/lib/accounts';
import { createSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { logActivity, logError } from '@/lib/log';
import { clientIp } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const go = (path: string) => NextResponse.redirect(new URL(path, env.appUrl));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ip = clientIp(req);
  try {
    await rateLimit(`google-cb:${ip}`, 30, 600);
    const jar = await cookies();
    const raw = jar.get('bc_oauth')?.value;
    jar.delete('bc_oauth');
    if (!raw) return go('/login?error=oauth_state');
    const { state, verifier } = JSON.parse(raw) as { state: string; verifier: string };
    const code = url.searchParams.get('code');
    if (url.searchParams.get('error') || !code || url.searchParams.get('state') !== state) return go('/login?error=oauth_state');

    // Xác minh id_token ở backend (chữ ký, issuer, audience).
    const g = await exchangeCode(code, verifier);
    if (!g.emailVerified) return go('/login?error=email_not_verified');

    let user = await q1('SELECT * FROM users WHERE google_sub = $1', [g.sub]);
    if (!user) {
      const byEmail = await q1('SELECT * FROM users WHERE email = $1', [g.email]);
      if (byEmail) {
        // Liên kết Google vào tài khoản email có sẵn. Google đã xác minh email nên an toàn;
        // nếu tài khoản cũ CHƯA xác minh email thì xóa mật khẩu để chặn kẻ đã đăng ký trước bằng email của người khác.
        user = await q1(
          `UPDATE users SET google_sub = $2, email_verified = true,
                  password_hash = CASE WHEN email_verified THEN password_hash ELSE NULL END
            WHERE id = $1 RETURNING *`,
          [byEmail.id, g.sub],
        );
      } else {
        const s = await getSettings();
        if (!s.registration_open && !isAdminEmail(g.email)) return go('/login?error=registration_closed');
        user = await createUser({
          email: g.email,
          displayName: g.name,
          googleSub: g.sub,
          emailVerified: true,
        });
        await logActivity(user.id, 'register', { method: 'google' }, ip);
      }
    }
    if (user.status === 'blocked') return go('/login?error=blocked');

    // Đồng bộ quyền admin theo biến môi trường (nguồn sự thật duy nhất ở server).
    const shouldBeAdmin = isAdminEmail(user.email);
    const desired = shouldBeAdmin ? 'admin' : 'user';
    if (user.role !== desired) await q('UPDATE users SET role = $2 WHERE id = $1', [user.id, desired]);
    if (shouldBeAdmin) await logActivity(user.id, 'admin_login', {}, ip);

    await createSession(user.id, req);
    await logActivity(user.id, 'login', { method: 'google' }, ip);
    return go('/');
  } catch (e) {
    await logError('google-oauth', e instanceof Error ? e.message : String(e));
    return go('/login?error=oauth_failed');
  }
}
