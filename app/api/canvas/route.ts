import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { requireVerifiedUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { listAvailableModels, orderModels, completeWithFallback } from '@/lib/ai/providers';
import { chargeTokens, estimateTokens } from '@/lib/tokens';

export const runtime = 'nodejs';
export const maxDuration = 60;

const body = z.object({
  selection: z.string().max(12_000),
  instruction: z.string().trim().min(2).max(600),
  document: z.string().max(30_000).default(''),
  scope: z.enum(['selection', 'all']).default('selection'),
});

const SYS = `Bạn là trình chỉnh sửa văn bản/mã trong một khung Canvas. Bạn nhận: (1) ĐOẠN CẦN SỬA, (2) YÊU CẦU, (3) TOÀN BỘ TÀI LIỆU làm ngữ cảnh. Chỉ trả về PHẦN THAY THẾ cho đoạn cần sửa, đúng định dạng gốc (Markdown/mã), cùng ngôn ngữ với đoạn gốc trừ khi yêu cầu dịch. Không giải thích, không lời dẫn, không bao quanh bằng dấu ba nháy nếu đoạn gốc không có. Giữ nguyên những gì yêu cầu không đụng tới.`;

export const POST = handler(async (req) => {
  const u = await requireVerifiedUser();
  await rateLimit(`canvas:${u.id}`, 60, 3600);
  const b = await parseBody(req, body);
  const target = b.scope === 'all' ? b.document : b.selection;
  if (!target.trim()) throw new ApiError(400, 'Chưa có nội dung để sửa');
  const models = orderModels(await listAvailableModels(), null, false);
  if (!models.length) throw new ApiError(400, 'Chưa có model nào được bật.');
  const user = `ĐOẠN CẦN SỬA:\n<<<\n${target}\n>>>\n\nYÊU CẦU: ${b.instruction}\n\n${b.scope === 'all' ? '' : `TOÀN BỘ TÀI LIỆU (chỉ để tham khảo):\n<<<\n${b.document.slice(0, 20_000)}\n>>>`}`;
  const r = await completeWithFallback(models, [{ role: 'system', content: SYS }, { role: 'user', content: user }], { maxTokens: 3000, temperature: 0.4, signal: req.signal });
  let text = r.text.trim();
  if (!text) throw new ApiError(502, 'AI không trả về nội dung. Hãy thử lại.');
  // gỡ ba nháy bao quanh nếu đoạn gốc không có
  const fenced = /^```[\w-]*\n([\s\S]*?)\n```$/.exec(text);
  if (fenced && !/^```/.test(target.trim())) text = fenced[1];
  try {
    await chargeTokens(u, ((r.usage.input || estimateTokens(user) + 150) + (r.usage.output || estimateTokens(text))) * (r.model?.multiplier ?? 1), { reason: 'chat', model: r.model?.id });
  } catch {
    /* không chặn kết quả nếu trừ token lỗi */
  }
  return json({ text });
});
