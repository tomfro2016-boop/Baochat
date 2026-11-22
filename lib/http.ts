import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { env } from './env';
import { logError } from './log';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function clientIp(req: Request): string {
  if (env.trustProxy) {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    const real = req.headers.get('x-real-ip');
    if (real) return real.trim();
  }
  return 'unknown';
}

/** Chống CSRF: với request thay đổi dữ liệu, Origin (nếu có) phải trùng host của ứng dụng. */
function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return; // request không phải từ trình duyệt (curl, server-to-server) - cookie SameSite=Lax vẫn bảo vệ
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'Origin không hợp lệ');
  }
  const allowed = new Set<string>([new URL(env.appUrl).host]);
  if (!env.isProd) allowed.add(req.headers.get('host') || '');
  if (!allowed.has(host)) throw new ApiError(403, 'Origin không được phép');
}

export function handler(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any): Promise<Response> => {
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) checkOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return json({ error: e.message, ...(e.extra || {}) }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return json({ error: 'Dữ liệu không hợp lệ', issues: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
      }
      const msg = e instanceof Error ? e.message : String(e);
      await logError('api', msg, { url: req.url, method: req.method, stack: e instanceof Error ? e.stack?.slice(0, 1500) : undefined });
      return json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>, maxBytes = 2_000_000): Promise<T> {
  const len = Number(req.headers.get('content-length') || '0');
  if (len > maxBytes) throw new ApiError(413, 'Dữ liệu quá lớn');
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'JSON không hợp lệ');
  }
  return schema.parse(raw);
}
