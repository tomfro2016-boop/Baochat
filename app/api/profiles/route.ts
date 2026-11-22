import { handler, json, parseBody, ApiError } from '@/lib/http';
import { profileSchema } from '@/lib/schemas';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const GET = handler(async () => {
  const u = await requireUser();
  const rows = await q('SELECT * FROM ai_profiles WHERE user_id = $1 ORDER BY created_at', [u.id]);
  return json({ profiles: rows });
});

export const POST = handler(async (req) => {
  const u = await requireUser();
  const b = await parseBody(req, profileSchema);
  const count = await q1<{ n: number }>('SELECT count(*)::int AS n FROM ai_profiles WHERE user_id = $1', [u.id]);
  if ((count?.n ?? 0) >= 20) throw new ApiError(400, 'Tối đa 20 cấu hình');
  const row = await q1(
    `INSERT INTO ai_profiles (user_id, name, ai_name, style, humor_level, address_style, default_lang, custom_instructions, interests)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [u.id, b.name, b.ai_name, b.style, b.humor_level, b.address_style, b.default_lang, b.custom_instructions, b.interests],
  );
  return json({ profile: row });
});
