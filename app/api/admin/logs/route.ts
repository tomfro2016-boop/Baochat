import { handler, json } from '@/lib/http';
import { q } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const GET = handler(async (req) => {
  await requireAdmin();
  const type = new URL(req.url).searchParams.get('type');
  if (type === 'error') {
    return json({ logs: await q('SELECT id, source, message, detail, created_at FROM error_logs ORDER BY created_at DESC LIMIT 200') });
  }
  return json({
    logs: await q(
      `SELECT a.id, a.action, a.detail, a.ip, a.created_at, u.email
         FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT 200`,
    ),
  });
});
