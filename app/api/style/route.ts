import { z } from 'zod';
import { handler, json, parseBody, ApiError } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireVerifiedUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { listAvailableModels, orderModels, completeWithFallback } from '@/lib/ai/providers';
import { chargeTokens, estimateTokens } from '@/lib/tokens';

export const runtime = 'nodejs';
export const maxDuration = 60;

const body = z.object({ samples: z.string().trim().min(200, 'Hãy dán ít nhất vài đoạn văn bạn đã viết (khoảng 200 ký tự trở lên).').max(12_000) });

const SYS = `Bạn là chuyên gia phân tích văn phong. Người dùng dán các đoạn văn họ tự viết. Hãy viết BẢN MÔ TẢ VĂN PHONG để một AI khác bắt chước họ khi soạn tin nhắn, email. Chỉ dựa trên điều thực sự thấy trong mẫu, không suy diễn về đời tư. Gồm các mục ngắn gọn: xưng hô và mức trang trọng; độ dài câu và nhịp văn; từ ngữ/cụm từ lặp lại đặc trưng; cách mở đầu và kết thúc; cách dùng dấu câu, viết tắt, emoji, viết hoa; giọng điệu (thẳng, mềm, hài hước…); điều họ KHÔNG bao giờ làm. Cuối cùng thêm 2-3 câu ví dụ ngắn mô phỏng đúng giọng đó (câu mới, không chép lại mẫu). Viết bằng tiếng Việt, tối đa 350 từ.`;

export const POST = handler(async (req) => {
  const u = await requireVerifiedUser();
  await rateLimit(`style:${u.id}`, 10, 3600);
  const b = await parseBody(req, body);
  const models = orderModels(await listAvailableModels(), null, false);
  if (!models.length) throw new ApiError(400, 'Chưa có model nào được bật.');
  const n = await q1<{ n: number }>('SELECT count(*)::int AS n FROM assistants WHERE user_id = $1', [u.id]);
  if ((n?.n ?? 0) >= 20) throw new ApiError(400, 'Tối đa 20 trợ lý');
  const r = await completeWithFallback(models, [{ role: 'system', content: SYS }, { role: 'user', content: b.samples }], { maxTokens: 900, temperature: 0.3, signal: req.signal });
  const guide = r.text.trim();
  if (guide.length < 40) throw new ApiError(502, 'Không phân tích được văn phong lúc này. Hãy thử lại.');
  try {
    await chargeTokens(u, (r.usage.input || estimateTokens(b.samples) + 400) + (r.usage.output || estimateTokens(guide)), { reason: 'chat', model: r.model?.id });
  } catch {
    /* không chặn kết quả nếu trừ token lỗi */
  }
  const instructions = `Bạn là bản sao văn phong của người dùng. Khi soạn tin nhắn, email, bài đăng thay họ, hãy viết đúng như chính họ viết, người nhận không nhận ra khác biệt. Không giải thích, chỉ đưa bản nháp khi được nhờ soạn; nếu thiếu thông tin quan trọng thì hỏi ngắn gọn.\n\nHồ sơ văn phong của họ:\n${guide}`.slice(0, 3000);
  const row = await q1('INSERT INTO assistants (user_id, name, description, instructions) VALUES ($1,$2,$3,$4) RETURNING id, name, description, instructions, share_token', [u.id, 'Văn phong của tôi', 'Soạn tin nhắn, email theo đúng giọng viết của bạn', instructions]);
  return json({ assistant: row, guide });
});
