import { z } from 'zod';
import { handler, json, parseBody, ApiError, clientIp } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { adminAdjust, forceResetNow } from '@/lib/tokens';
import { destroyAllSessions } from '@/lib/session';
import { isAdminEmail } from '@/lib/env';
import { logActivity } from '@/lib/log';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('block') }),
  z.object({ action: z.literal('unblock') }),
  z.object({ action: z.literal('add_tokens'), amount: z.number().int().min(-10_000_000).max(10_000_000) }),
  z.object({ action: z.literal('set_tokens'), amount: z.number().int().min(0).max(10_000_000) }),
  z.object({ action: z.literal('set_quota'), amount: z.number().int().min(0).max(10_000_000) }),
  z.object({ action: z.literal('reset_now') }),
]);

export const PATCH = handler(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Không tìm thấy');
  const b = await parseBody(req, schema);
  const target = await q1<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = $1', [id]);
  if (!target) throw new ApiError(404, 'Không tìm thấy người dùng');

  switch (b.action) {
    case 'block':
      if (target.id === admin.id || isAdminEmail(target.email)) throw new ApiError(400, 'Không thể khóa tài khoản quản trị.');
      await q(`UPDATE users SET status = 'blocked' WHERE id = $1`, [id]);
      await destroyAllSessions(id);
      break;
    case 'unblock':
      await q(`UPDATE users SET status = 'active' WHERE id = $1`, [id]);
      break;
    case 'add_tokens':
      await adminAdjust(id, 'add', b.amount, admin.id);
      break;
    case 'set_tokens':
      await adminAdjust(id, 'set', b.amount, admin.id);
      break;
    case 'set_quota':
      await adminAdjust(id, 'quota', b.amount, admin.id);
      break;
    case 'reset_now':
      await forceResetNow(id);
      break;
  }
  await logActivity(admin.id, `admin_${b.action}`, { target: id, email: target.email, ...('amount' in b ? { amount: b.amount } : {}) }, clientIp(req));
  return json({ ok: true });
});
