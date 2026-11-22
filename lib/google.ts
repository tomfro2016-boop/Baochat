import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from './env';
import { ApiError } from './http';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export function redirectUri() {
  return `${env.appUrl}/api/auth/google/callback`;
}

export function buildAuthUrl(state: string, challenge: string) {
  const p = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean; name: string; picture?: string };

/** Đổi code lấy id_token và XÁC MINH chữ ký, issuer, audience ở backend. */
export async function exchangeCode(code: string, verifier: string): Promise<GoogleIdentity> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new ApiError(400, 'Google từ chối mã đăng nhập');
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new ApiError(400, 'Google không trả về id_token');

  const { payload } = await jwtVerify(data.id_token, JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env.googleClientId,
  });

  const email = String(payload.email || '').toLowerCase();
  if (!payload.sub || !email) throw new ApiError(400, 'Thiếu thông tin tài khoản Google');
  return {
    sub: String(payload.sub),
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: String(payload.name || email.split('@')[0]),
    picture: payload.picture ? String(payload.picture) : undefined,
  };
}
