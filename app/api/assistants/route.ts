import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const GET = handler(async () => {
  const u = await requireUser();
  const mine = await q(
    `SELECT a.id, a.name, a.description, a.instructions, a.share_token,
            COALESCE((SELECT json_agg(json_build_object('id', f.id, 'name', f.name) ORDER BY af.created_at)
                        FROM assistant_files af JOIN files f ON f.id = af.file_id WHERE af.assistant_id = a.id), '[]'::json) AS files
       FROM assistants a WHERE a.user_id = $1 ORDER BY a.created_at`,
    [u.id],
  );
  // Trợ lý được chia sẻ: người dùng KHÔNG thấy phần hướng dẫn
  const added = await q(
    `SELECT a.id, a.name, a.description, usr.display_name AS owner_name
       FROM assistant_subs s JOIN assistants a ON a.id = s.assistant_id JOIN users usr ON usr.id = a.user_id
      WHERE s.user_id = $1 AND a.share_token IS NOT NULL ORDER BY s.created_at`,
    [u.id],
  );
  return json({ assistants: mine, added });
});

const assistantBody = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).optional(),
  instructions: z.string().trim().min(5).max(3000),
});

export const POST = handler(async (req) => {
  const u = await requireUser();
  const b = await parseBody(req, assistantBody);
  const n = await q1<{ n: number }>('SELECT count(*)::int AS n FROM assistants WHERE user_id = $1', [u.id]);
  if ((n?.n ?? 0) >= 20) throw new ApiError(400, 'Tối đa 20 trợ lý');
  const row = await q1(
    'INSERT INTO assistants (user_id, name, description, instructions) VALUES ($1,$2,$3,$4) RETURNING id, name, description, instructions, share_token',
    [u.id, b.name, b.description ?? '', b.instructions],
  );
  return json({ assistant: row });
});
