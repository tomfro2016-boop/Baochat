import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/log';

export const GET = handler(async () => {
  await requireAdmin();
  return json({ announcements: await q('SELECT id, title, body, active, created_at FROM announcements ORDER BY created_at DESC LIMIT 50') });
});

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const b = await parseBody(req, z.object({ title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(1000) }));
  const row = await q1('INSERT INTO announcements (title, body) VALUES ($1,$2) RETURNING id', [b.title, b.body]);
  await logActivity(admin.id, 'admin_announcement_create', { id: row?.id });
  return json({ ok: true });
});

export const PATCH = handler(async (req) => {
  const admin = await requireAdmin();
  const b = await parseBody(req, z.object({ id: z.string().uuid(), active: z.boolean() }));
  const r = await q('UPDATE announcements SET active = $2 WHERE id = $1 RETURNING id', [b.id, b.active]);
  if (!r.length) throw new ApiError(404, 'Không tìm thấy');
  await logActivity(admin.id, 'admin_announcement_toggle', b);
  return json({ ok: true });
});

export const DELETE = handler(async (req) => {
  const admin = await requireAdmin();
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(400, 'id không hợp lệ');
  await q('DELETE FROM announcements WHERE id = $1', [id]);
  await logActivity(admin.id, 'admin_announcement_delete', { id });
  return json({ ok: true });
});
