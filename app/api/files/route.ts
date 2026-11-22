import { handler, json, ApiError } from '@/lib/http';
import { q1 } from '@/lib/db';
import { requireVerifiedUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { getSettings } from '@/lib/settings';
import { extractText, isImage } from '@/lib/files';

export const runtime = 'nodejs';

const BLOCKED_EXT = /\.(exe|dll|bat|cmd|com|scr|msi|app|jar|vbs|ps1)$/i;

export const POST = handler(async (req) => {
  const u = await requireVerifiedUser();
  await rateLimit(`upload:${u.id}`, 30, 600);
  const s = await getSettings();
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'Thiếu tệp');
  if (file.size > s.max_upload_mb * 1024 * 1024) throw new ApiError(413, `Tệp tối đa ${s.max_upload_mb}MB`);
  if (BLOCKED_EXT.test(file.name)) throw new ApiError(400, 'Loại tệp không được hỗ trợ');
  const data = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const name = file.name.replace(/[^\w.\-() À-ỹ]/g, '_').slice(0, 120) || 'file';
  const text = isImage(mime) ? null : await extractText(name, mime, data);
  const row = await q1<{ id: string }>(
    `INSERT INTO files (user_id, name, mime, size, data, extracted_text) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [u.id, name, mime, data.length, data, text],
  );
  return json({ id: row!.id, name, mime, size: data.length, readable: isImage(mime) || text !== null });
});
