import { z } from 'zod';
import { ApiError, handler, parseBody } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { logError } from '@/lib/log';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.object({
  text: z.string().min(1).max(1200),
  lang: z.enum(['vi', 'en']).default('vi'),
  mode: z.enum(['serious', 'casual', 'funny', 'playful']).default('casual'),
});

// Giọng và phong cách theo tính cách chat
const VOICE: Record<string, string> = { serious: 'Kore', casual: 'Zephyr', funny: 'Puck', playful: 'Leda' };
const STYLE_VI: Record<string, string> = {
  serious: 'giọng điềm tĩnh, rõ ràng, chắc chắn, nhấn nhá vừa phải ở các ý chính, ngắt nghỉ đúng chỗ',
  casual: 'giọng ấm áp, thân thiện như đang trò chuyện, ngữ điệu lên xuống tự nhiên, ngắt nghỉ như người thật',
  funny: 'giọng vui vẻ, tươi tắn, lên giọng ở chỗ hóm hỉnh, nhấn nhá rõ ràng, có thể bật cười nhẹ',
  playful: 'giọng tinh nghịch, hào hứng, nhịp nhanh nhẹ, nhấn mạnh biểu cảm, kéo dài chữ ở chỗ trêu đùa',
};
const STYLE_EN: Record<string, string> = {
  serious: 'in a calm, clear, confident voice with measured emphasis on key points and natural pauses',
  casual: 'in a warm, friendly conversational voice with natural rise and fall and human-like pauses',
  funny: 'in a bright, cheerful voice, with playful emphasis on the punchlines and a light laugh where it fits',
  playful: 'in a mischievous, energetic voice with expressive emphasis and teasing stretched words',
};

// Gemini trả PCM 24kHz 16-bit mono: bọc thêm tiêu đề WAV để trình duyệt phát được
function pcmToWav(pcm: Buffer, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(`tts:${user.id}`, user.isAdmin ? 60 : 20, 60);
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ApiError(503, 'Chưa cấu hình khóa Gemini');
  const b = await parseBody(req, schema, 20_000);

  const lang: 'vi' | 'en' = b.lang === 'en' ? 'en' : 'vi';
  const mode: string = b.mode ?? 'casual';
  const style = (lang === 'vi' ? STYLE_VI : STYLE_EN)[mode] ?? (lang === 'vi' ? STYLE_VI : STYLE_EN).casual;
  const prompt =
    lang === 'vi'
      ? `Hãy đọc đoạn văn sau bằng tiếng Việt chuẩn, phát âm rõ dấu, ${style}. Biểu cảm theo nội dung: vui khi tin vui, trầm khi nghiêm túc, tò mò khi là câu hỏi. Chỉ đọc đoạn văn, không đọc lại chỉ dẫn này:\n\n${b.text}`
      : `Read the following text aloud ${style}. Match the emotion to the content. Only read the text, not these instructions:\n\n${b.text}`;

  const models = [process.env.GEMINI_TTS_MODEL, 'gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-tts-preview'].filter(Boolean) as string[];
  let lastErr = '';
  for (const model of [...new Set(models)]) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 45_000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE[mode] ?? 'Zephyr' } } },
          },
        }),
        signal: ctl.signal,
      });
      if (r.status === 429) throw new ApiError(429, 'Giọng Gemini đang bận, thử lại sau ít phút');
      if (!r.ok) {
        lastErr = `${model} HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`;
        continue;
      }
      const data: any = await r.json();
      const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
      if (!part) {
        lastErr = `${model}: không có dữ liệu âm thanh`;
        continue;
      }
      const wav = pcmToWav(Buffer.from(part.inlineData.data, 'base64'));
      return new Response(new Uint8Array(wav), { headers: { 'content-type': 'audio/wav', 'cache-control': 'private, no-store' } });
    } catch (e) {
      if (e instanceof ApiError) throw e;
      lastErr = `${model}: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      clearTimeout(t);
    }
  }
  await logError('tts', lastErr, {});
  throw new ApiError(502, 'Không tạo được giọng đọc Gemini');
});
