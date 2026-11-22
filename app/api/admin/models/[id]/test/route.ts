import { handler, json, ApiError } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { listAllModelsWithStatus, completeWithFallback } from '@/lib/ai/providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Gọi thử 1 model (không fallback) để kiểm tra khóa API & tên model có hoạt động thật không.
export const POST = handler(async (_req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const all = await listAllModelsWithStatus();
  const m = all.find((x) => x.id === id);
  if (!m) throw new ApiError(404, 'Không tìm thấy model');
  if (!m.keyPresent) return json({ ok: false, error: `Thiếu biến môi trường ${m.api_key_env} trên máy chủ.` });
  const t0 = Date.now();
  try {
    const r = await completeWithFallback([m], [{ role: 'user', content: 'Trả lời đúng một từ: OK' }], { maxTokens: 16, temperature: 0 });
    return json({ ok: true, latencyMs: Date.now() - t0, reply: r.text.slice(0, 40) });
  } catch (e) {
    return json({ ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
  }
});
