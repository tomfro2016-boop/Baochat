import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const body = z.object({ fileId: z.string().uuid() });

async function ownAssistant(id: string, userId: string) {
  if (!isId(id)) throw new ApiError(404, 'Không tìm thấy');
  const a = await q1('SELECT id FROM assistants WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!a) throw new ApiError(404, 'Không tìm thấy trợ lý của bạn');
}

// Chủ gắn tài liệu đã tải lên (/api/files) vào trợ lý
export const POST = handler(async (req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  await ownAssistant(id, u.id);
  const b = await parseBody(req, body);
  const f = await q1<{ id: string; name: string; extracted_text: string | null }>('SELECT id, name, extracted_text FROM files WHERE id = $1 AND user_id = $2', [b.fileId, u.id]);
  if (!f) throw new ApiError(404, 'Không tìm thấy tệp');
  if (!f.extracted_text) throw new ApiError(400, 'Không đọc được nội dung tệp này (hỗ trợ văn bản, PDF có chữ, Word, Excel, PowerPoint).');
  const n = await q1<{ n: number }>('SELECT count(*)::int AS n FROM assistant_files WHERE assistant_id = $1', [id]);
  if ((n?.n ?? 0) >= 10) throw new ApiError(400, 'Mỗi trợ lý tối đa 10 tài liệu');
  await q('INSERT INTO assistant_files (assistant_id, file_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, f.id]);
  return json({ file: { id: f.id, name: f.name } });
});

export const DELETE = handler(async (req, ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  await ownAssistant(id, u.id);
  const fileId = new URL(req.url).searchParams.get('fileId') || '';
  if (!isId(fileId)) throw new ApiError(400, 'Thiếu fileId');
  await q('DELETE FROM assistant_files WHERE assistant_id = $1 AND file_id = $2', [id, fileId]);
  return json({ ok: true });
});
