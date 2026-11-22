import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { randomToken, pkceChallenge } from '@/lib/crypto';
import { buildAuthUrl } from '@/lib/google';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!env.googleConfigured) {
    return NextResponse.redirect(new URL('/login?error=google_not_configured', env.appUrl));
  }
  const state = randomToken(24);
  const verifier = randomToken(48);
  const jar = await cookies();
  jar.set('bc_oauth', JSON.stringify({ state, verifier }), {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: 600,
  });
  return NextResponse.redirect(buildAuthUrl(state, pkceChallenge(verifier)));
}
