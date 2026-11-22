import { handler, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { buildCsv, buildDocx, buildPdf, buildPptx, buildText, buildXlsx, buildZip, type BuiltFile } from '@/lib/studio/build';
import { payloadSchemas } from '@/lib/studio/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = handler(async (req, ctx) => {
  const u = await requireUser();
  await rateLimit(`export:${u.id}`, 30, 60);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Không tìm thấy');
  const item = await q1<{ kind: keyof typeof payloadSchemas; title: string; payload: any }>('SELECT kind, title, payload FROM studio_items WHERE id = $1 AND user_id = $2', [id, u.id]);
  if (!item) throw new ApiError(404, 'Không tìm thấy');
  const format = new URL(req.url).searchParams.get('format') || '';
  const p: any = payloadSchemas[item.kind].parse(item.payload);

  let file: BuiltFile;
  switch (item.kind) {
    case 'website':
      file = await buildZip(item.title, p);
      break;
    case 'document': {
      const f = (format || p.format) as string;
      if (f === 'docx') file = await buildDocx(item.title, p);
      else if (f === 'pdf') file = await buildPdf(item.title, p);
      else if (f === 'txt' || f === 'md') file = buildText(item.title, p, f);
      else throw new ApiError(400, 'Định dạng không hỗ trợ');
      break;
    }
    case 'presentation': {
      const ids: string[] = p.imageFileIds;
      const rows = ids.length ? await q<{ id: string; mime: string; data: Buffer }>(`SELECT id, mime, data FROM files WHERE id = ANY($1::uuid[]) AND user_id = $2 AND mime LIKE 'image/%'`, [ids, u.id]) : [];
      const map = new Map(rows.map((r) => [r.id, r]));
      const images = ids.map((i) => map.get(i)).filter(Boolean) as { mime: string; data: Buffer }[];
      file = await buildPptx(p, images);
      break;
    }
    case 'spreadsheet':
      if (format === 'csv') file = buildCsv(p, Number(new URL(req.url).searchParams.get('sheet') || 0));
      else file = await buildXlsx(p);
      break;
  }
  return new Response(new Uint8Array(file.buffer), {
    headers: {
      'content-type': file.mime,
      'content-disposition': `attachment; filename="${file.filename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});
