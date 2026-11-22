import { NextResponse, type NextRequest } from 'next/server';

// Chuyển hướng nhanh khi chưa có cookie phiên. Việc xác thực thật sự luôn nằm ở API (server) –
// middleware này chỉ để trải nghiệm người dùng, không phải lớp bảo mật.
const PUBLIC = ['/login', '/register', '/forgot', '/reset', '/verify'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname === '/icon.svg') return NextResponse.next();
  const has = req.cookies.has('bc_session');
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (!has && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (has && (pathname === '/login' || pathname === '/register')) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
