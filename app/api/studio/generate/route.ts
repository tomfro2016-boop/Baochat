import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireVerifiedUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { getSettings } from '@/lib/settings';
import { applyResetIfDue, loadFreshUserTokens, chargeTokens, estimateTokens } from '@/lib/tokens';
import { listAvailableModels, orderModels, completeWithFallback } from '@/lib/ai/providers';
import { KINDS } from '@/lib/studio/schemas';
import { buildStudioMessages, parseStudioOutput } from '@/lib/studio/generate';
import { logActivity } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const schema = z.object({
  kind: z.enum(KINDS),
  prompt: z.string().trim().min(3).max(8000),
  framework: z.enum(['html', 'react']).optional(),
  format: z.enum(['docx', 'pdf', 'txt', 'md']).optional(),
  baseItemId: z.string().uuid().optional(),
  imageFileIds: z.array(z.string().uuid()).max(20).optional(),
  modelId: z.string().max(80).nullable().optional(),
});

export const POST = handler(async (req) => {
  const user = await requireVerifiedUser();
  const b = await parseBody(req, schema, 100_000);
  const s = await getSettings();
  await rateLimit(`studio:${user.id}`, user.isAdmin ? 60 : 8, 60);

  await applyResetIfDue(user);
  const tk = (await loadFreshUserTokens(user.id))!;
  if (!user.isAdmin && tk.token_balance <= 0) {
    throw new ApiError(402, 'Bạn đã hết token. Vui lòng chờ đến lần reset tiếp theo.', { code: 'OUT_OF_TOKENS', resetAt: tk.token_reset_at });
  }
  const models = orderModels(await listAvailableModels(), b.modelId ?? s.default_model, false);
  if (!models.length) throw new ApiError(503, 'Chưa có AI provider nào được cấu hình.', { code: 'NO_MODEL' });

  let base: any = null;
  let baseItem: { id: string; kind: string; payload: any } | null = null;
  if (b.baseItemId) {
    baseItem = await q1('SELECT id, kind, payload FROM studio_items WHERE id = $1 AND user_id = $2', [b.baseItemId, user.id]);
    if (!baseItem || baseItem.kind !== b.kind) throw new ApiError(404, 'Không tìm thấy bản gốc để chỉnh sửa');
    base = baseItem.payload;
  }

  // Ảnh minh họa cho slide: chỉ chấp nhận tệp ảnh của chính người dùng
  let imageIds: string[] = [];
  if (b.kind === 'presentation' && b.imageFileIds?.length) {
    const rows = await q<{ id: string }>(`SELECT id FROM files WHERE id = ANY($1::uuid[]) AND user_id = $2 AND mime LIKE 'image/%'`, [b.imageFileIds, user.id]);
    const ok = new Set(rows.map((r) => r.id));
    imageIds = b.imageFileIds.filter((i) => ok.has(i));
  } else if (base?.imageFileIds) imageIds = base.imageFileIds;

  const msgs = buildStudioMessages(b.kind, b.prompt, { framework: b.framework ?? base?.framework, basePayload: base, uiLang: user.ui_lang });
  const estIn = estimateTokens(msgs.map((m) => m.content).join('\n'));
  const maxOut = user.isAdmin ? 8192 : Math.max(512, Math.min(8192, Math.floor(tk.token_balance - estIn)));

  const { text, usage, model } = await completeWithFallback(models, msgs, { maxTokens: maxOut, temperature: 0.6, signal: req.signal });
  const total = ((usage.input || estIn) + (usage.output || estimateTokens(text))) * model.multiplier;
  // Luôn tính token cho lần gọi AI, kể cả khi kết quả không dùng được
  const balance = await chargeTokens(user, total, { reason: 'studio', model: model.id });

  let parsed;
  try {
    parsed = parseStudioOutput(b.kind, text, { framework: b.framework ?? base?.framework, documentFormat: b.format ?? base?.format, imageFileIds: imageIds });
  } catch (e) {
    throw new ApiError(422, `AI trả về kết quả không đọc được: ${e instanceof Error ? e.message : 'định dạng sai'}. Hãy thử lại (đã tính token cho lần gọi này).`, { balance });
  }

  let item;
  if (baseItem) {
    item = await q1(`UPDATE studio_items SET title = $2, prompt = $3, payload = $4, updated_at = now() WHERE id = $1 RETURNING id, kind, title, payload, updated_at`, [baseItem.id, parsed.title, b.prompt, JSON.stringify(parsed.payload)]);
  } else {
    item = await q1(`INSERT INTO studio_items (user_id, kind, title, prompt, payload) VALUES ($1,$2,$3,$4,$5) RETURNING id, kind, title, payload, updated_at`, [user.id, b.kind, parsed.title, b.prompt, JSON.stringify(parsed.payload)]);
  }
  await logActivity(user.id, 'studio_generate', { kind: b.kind, model: model.id, tokens: Math.ceil(total) });
  return json({ item, balance });
});
