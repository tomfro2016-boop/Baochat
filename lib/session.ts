import { cookies } from 'next/headers';
import { env } from './env';
import { q, q1 } from './db';
import { randomToken, sha256 } from './crypto';

export const SESSION_COOKIE = 'bc_session';
const SESSION_DAYS = 30;

export async function createSession(userId: string, req?: Request) {
  const token = randomToken(32);
  const ua = req?.headers.get('user-agent')?.slice(0, 300) ?? null;
  await q(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1,$2, now() + ($3 || ' days')::interval, $4, $5)`,
    [userId, sha256(token), String(SESSION_DAYS), ua, null],
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await q('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

export async function getSessionUserRow() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await q1(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  return row;
}
