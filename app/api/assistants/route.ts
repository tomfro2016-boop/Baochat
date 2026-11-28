import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const GET = handler(async () => {
  const u = await requireUser();
  const rows = await q('SELECT id, name, instructions FROM assistants WHERE user_id = $1 ORDER BY created_at', [u.id]);
  return json({ assistants: rows });
});

const body = z.object({ name: z.string().trim().min(1).max(40), instructions: z.string().trim().min(5).max(3000) });

export const POST = handler(async (req) => {
  const u = await requireUser();
  const b = await parseBody(req, body);
  const n = await q1<{ n: number }>('SELECT count(*)::int AS n FROM assistants WHERE user_id = $1', [u.id]);
  if ((n?.n ?? 0) >= 20) throw new ApiError(400, 'Tối đa 20 trợ lý');
  const row = await q1('INSERT INTO assistants (user_id, name, instructions) VALUES ($1,$2,$3) RETURNING id, name, instructions', [u.id, b.name, b.instructions]);
  return json({ assistant: row });
});
