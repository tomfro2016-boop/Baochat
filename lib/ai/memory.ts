import { q, q1 } from '../db';
import { completeWithFallback, type ModelRow } from './providers';
import { chargeTokens, estimateTokens } from '../tokens';

const TRIGGER = /(tôi tên|tên tôi|tên mình|mình tên|tôi là|mình là|tôi thích|mình thích|tôi sống|mình sống|tôi làm|mình làm|tôi đang học|hãy nhớ|nhớ giúp|ghi nhớ|my name|i am |i'm |i like |i love |i live |i work |i study|remember that|please remember)/i;

/**
 * Tự động trích xuất thông tin bền vững về người dùng (nếu bật ghi nhớ).
 * Chỉ chạy khi tin nhắn có dấu hiệu chứa thông tin cá nhân để tiết kiệm token. Tốn token như mọi lần gọi AI.
 */
export async function maybeExtractMemories(user: { id: string; isAdmin: boolean }, userText: string, models: ModelRow[]) {
  if (!TRIGGER.test(userText) || userText.length > 2000 || !models.length) return;
  const count = await q1<{ n: number }>('SELECT count(*)::int AS n FROM memories WHERE user_id = $1', [user.id]);
  if ((count?.n ?? 0) >= 100) return;
  try {
    const { text, usage, model } = await completeWithFallback(
      models.slice(0, 2),
      [
        {
          role: 'system',
          content:
            'Trích xuất tối đa 3 thông tin BỀN VỮNG về người dùng từ tin nhắn (tên, sở thích, nghề nghiệp, nơi ở, mục tiêu, cách họ muốn được gọi). ' +
            'KHÔNG ghi: mật khẩu, số thẻ/giấy tờ, thông tin sức khỏe, tình dục, chính trị, tôn giáo, hoặc thông tin tạm thời. ' +
            'Mỗi mục là một câu ngắn (<= 120 ký tự) theo ngôn ngữ của người dùng. Chỉ trả về một mảng JSON các chuỗi, ví dụ ["Tên là An"]. Nếu không có gì, trả về [].',
        },
        { role: 'user', content: userText },
      ],
      { maxTokens: 200, temperature: 0 },
    );
    const total = (usage.input || estimateTokens(userText) + 120) + (usage.output || estimateTokens(text));
    await chargeTokens(user, total * model.multiplier, { reason: 'memory', model: model.id });
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return;
    for (const raw of arr.slice(0, 3)) {
      const c = String(raw).trim().slice(0, 150);
      if (c.length < 3) continue;
      await q(
        `INSERT INTO memories (user_id, content, source)
         SELECT $1,$2,'auto' WHERE NOT EXISTS (SELECT 1 FROM memories WHERE user_id = $1 AND lower(content) = lower($2))`,
        [user.id, c],
      );
    }
  } catch {
    /* ghi nhớ là tính năng phụ: lỗi không ảnh hưởng cuộc trò chuyện */
  }
}
