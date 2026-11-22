import { z } from 'zod';
import { handler, parseBody, ApiError, clientIp } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireVerifiedUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { getSettings } from '@/lib/settings';
import { applyResetIfDue, loadFreshUserTokens, chargeTokens, estimateTokens } from '@/lib/tokens';
import { listAvailableModels, orderModels, streamWithFallback, type ChatMsg, type ModelRow } from '@/lib/ai/providers';
import { buildSystemPrompt, type Mode } from '@/lib/ai/prompt';
import { searchAndRead } from '@/lib/search';
import { isImage } from '@/lib/files';
import { env } from '@/lib/env';
import { maybeExtractMemories } from '@/lib/ai/memory';
import { logActivity, logError } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  action: z.enum(['send', 'regenerate', 'edit']).default('send'),
  content: z.string().max(30_000).default(''),
  attachmentIds: z.array(z.string().uuid()).max(8).default([]),
  search: z.boolean().default(false),
  mode: z.enum(['serious', 'casual', 'funny', 'playful']).optional(),
  modelId: z.string().max(80).nullable().optional(),
  editMessageId: z.string().uuid().optional(),
});

const HISTORY_CHAR_BUDGET = 60_000;
const FILE_TEXT_BUDGET = 14_000;

type AttachmentRef = { id: string; name: string; mime: string; size: number };

export const POST = handler(async (req) => {
  const user = await requireVerifiedUser();
  const b = await parseBody(req, schema, 200_000);
  const s = await getSettings();
  await rateLimit(`chat:${user.id}`, user.isAdmin ? 120 : s.chat_rate_per_minute, 60);

  // ---- token: reset nếu đến hạn, rồi kiểm tra còn token không (CHỈ ở server)
  await applyResetIfDue(user);
  const tk = (await loadFreshUserTokens(user.id))!;
  if (!user.isAdmin && tk.token_balance <= 0) {
    throw new ApiError(402, 'Bạn đã hết token. Vui lòng chờ đến lần reset tiếp theo.', { code: 'OUT_OF_TOKENS', resetAt: tk.token_reset_at });
  }
  if (b.search && !env.searchConfigured) throw new ApiError(400, 'Tìm kiếm Internet chưa được cấu hình trên máy chủ.', { code: 'SEARCH_NOT_CONFIGURED' });

  const available = await listAvailableModels();
  if (!available.length) throw new ApiError(503, 'Chưa có AI provider nào được cấu hình (thiếu API key trên máy chủ).', { code: 'NO_MODEL' });

  if (b.action !== 'send' && !b.conversationId) throw new ApiError(400, 'Thiếu conversationId');

  // ---- hội thoại
  let conv = b.conversationId ? await q1<{ id: string; mode: Mode | null; model_id: string | null; title: string }>('SELECT id, mode, model_id, title FROM conversations WHERE id = $1 AND user_id = $2', [b.conversationId, user.id]) : null;
  if (b.conversationId && !conv) throw new ApiError(404, 'Không tìm thấy cuộc trò chuyện');
  const isNew = !conv;
  if (!conv) {
    conv = (await q1(
      `INSERT INTO conversations (user_id, mode, model_id, search_enabled) VALUES ($1,$2,$3,$4) RETURNING id, mode, model_id, title`,
      [user.id, b.mode ?? null, b.modelId ?? null, b.search],
    ))!;
  } else {
    await q('UPDATE conversations SET search_enabled = $2, mode = COALESCE($3, mode), model_id = COALESCE($4, model_id), updated_at = now() WHERE id = $1', [conv.id, b.search, b.mode ?? null, b.modelId ?? null]);
  }
  const convId = conv.id;

  // ---- xử lý hành động
  let userMessageId: string | null = null;
  let userText = (b.content ?? '').trim();
  let attachments: AttachmentRef[] = [];

  const loadAttachments = async (ids: string[]) => {
    if (!ids.length) return [] as AttachmentRef[];
    return q<AttachmentRef>('SELECT id, name, mime, size FROM files WHERE id = ANY($1::uuid[]) AND user_id = $2 AND purpose = \'attachment\'', [ids, user.id]);
  };

  if (b.action === 'regenerate') {
    const last = await q1<{ id: string; role: string }>('SELECT id, role FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1', [convId]);
    if (last?.role === 'assistant') await q('DELETE FROM messages WHERE id = $1', [last.id]);
    const lastUser = await q1<{ id: string; content: string; attachments: AttachmentRef[] }>(
      `SELECT id, content, attachments FROM messages WHERE conversation_id = $1 AND role = 'user' ORDER BY created_at DESC, id DESC LIMIT 1`,
      [convId],
    );
    if (!lastUser) throw new ApiError(400, 'Không có câu hỏi để tạo lại');
    userMessageId = lastUser.id;
    userText = lastUser.content;
    attachments = lastUser.attachments;
  } else {
    attachments = await loadAttachments(b.attachmentIds ?? []);
    if (!userText && !attachments.length) throw new ApiError(400, 'Tin nhắn trống');
    if (b.action === 'edit') {
      if (!b.editMessageId) throw new ApiError(400, 'Thiếu editMessageId');
      const target = await q1<{ created_at: string }>(`SELECT created_at FROM messages WHERE id = $1 AND conversation_id = $2 AND user_id = $3 AND role = 'user'`, [b.editMessageId, convId, user.id]);
      if (!target) throw new ApiError(404, 'Không tìm thấy tin nhắn để chỉnh sửa');
      await q('DELETE FROM messages WHERE conversation_id = $1 AND created_at >= $2', [convId, target.created_at]);
    }
    const row = await q1<{ id: string }>(
      `INSERT INTO messages (conversation_id, user_id, role, content, attachments) VALUES ($1,$2,'user',$3,$4) RETURNING id`,
      [convId, user.id, userText, JSON.stringify(attachments)],
    );
    userMessageId = row!.id;
    if (isNew || conv.title === 'Cuộc trò chuyện mới') {
      const title = (userText || attachments[0]?.name || 'Tệp đính kèm').replace(/\s+/g, ' ').slice(0, 60);
      await q('UPDATE conversations SET title = $2 WHERE id = $1', [convId, title]);
      conv.title = title;
    }
  }

  // ---- hồ sơ AI + ghi nhớ + chế độ
  const profile = await q1('SELECT * FROM ai_profiles WHERE user_id = $1 AND is_active LIMIT 1', [user.id]);
  const memories = user.memory_enabled ? (await q<{ content: string }>('SELECT content FROM memories WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30', [user.id])).map((m) => m.content) : [];
  const mode: Mode = (b.mode ?? conv.mode ?? profile?.style ?? user.default_mode) as Mode;

  // ---- lịch sử
  let history = user.use_history
    ? await q<{ id: string; role: 'user' | 'assistant'; content: string; attachments: AttachmentRef[] }>(
        `SELECT id, role, content, attachments FROM (
           SELECT id, role, content, attachments, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC LIMIT 40
         ) t ORDER BY created_at, id`,
        [convId],
      )
    : await q<{ id: string; role: 'user' | 'assistant'; content: string; attachments: AttachmentRef[] }>(
        `SELECT id, role, content, attachments FROM messages WHERE id = $1`,
        [userMessageId],
      );
  // cắt theo ngân sách ký tự (giữ tin mới nhất)
  let used = 0;
  const kept: typeof history = [];
  for (const m of [...history].reverse()) {
    used += m.content.length;
    if (used > HISTORY_CHAR_BUDGET && kept.length) break;
    kept.unshift(m);
  }
  history = kept;

  const allFileIds = [...new Set(history.flatMap((m) => (m.attachments || []).map((a) => a.id)))];
  const fileRows = allFileIds.length
    ? await q<{ id: string; name: string; mime: string; data: Buffer; extracted_text: string | null }>(
        'SELECT id, name, mime, data, extracted_text FROM files WHERE id = ANY($1::uuid[]) AND user_id = $2',
        [allFileIds, user.id],
      )
    : [];
  const fileMap = new Map(fileRows.map((f) => [f.id, f]));

  const lastUserIdx = history.map((m) => m.role).lastIndexOf('user');
  const needVision = history.some((m, i) => i === lastUserIdx && (m.attachments || []).some((a) => isImage(a.mime)));
  const chatMsgs: ChatMsg[] = history.map((m, i) => {
    let content = m.content;
    const images: ChatMsg['images'] = [];
    for (const a of m.attachments || []) {
      const f = fileMap.get(a.id);
      if (!f) continue;
      if (isImage(f.mime)) {
        if (i === lastUserIdx) images.push({ mime: f.mime, b64: f.data.toString('base64') });
        else content += `\n[Đã gửi hình ảnh: ${f.name}]`;
      } else if (f.extracted_text) {
        content += `\n\n[Tệp đính kèm: ${f.name}]\n${f.extracted_text.slice(0, FILE_TEXT_BUDGET)}`;
      } else {
        content += `\n\n[Tệp đính kèm: ${f.name} - không đọc được nội dung]`;
      }
    }
    return { role: m.role, content: content || '(không có nội dung)', images: images.length ? images : undefined };
  });

  const models = orderModels(available, b.modelId ?? conv.model_id ?? s.default_model, needVision);
  if (!models.length) throw new ApiError(400, 'Chưa có model hỗ trợ hình ảnh được bật. Hãy bật model có Vision trong Admin.', { code: 'NO_VISION_MODEL' });

  const encoder = new TextEncoder();
  const ip = clientIp(req);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* client đã ngắt kết nối */
        }
      };
      send({ type: 'meta', conversationId: convId, userMessageId, title: conv!.title });

      let sources: { title: string; url: string; snippet: string }[] = [];
      let searchContext = '';
      if (b.search) {
        try {
          const query = userText.slice(0, 300) || 'tìm kiếm';
          const r = await searchAndRead(query);
          sources = r.sources;
          searchContext = r.context;
          send({ type: 'sources', sources });
        } catch (e) {
          await logError('search', e instanceof Error ? e.message : String(e));
          send({ type: 'notice', message: 'Không tìm kiếm được trên Internet lúc này; Baochat trả lời bằng kiến thức sẵn có.' });
        }
      }

      const system = buildSystemPrompt({
        mode,
        profile,
        memories,
        uiLang: user.ui_lang,
        userName: user.display_name,
        withSearch: b.search,
        searchContext,
      });
      const full: ChatMsg[] = [{ role: 'system', content: system }, ...chatMsgs];
      const estIn = estimateTokens(full.map((m) => m.content).join('\n')) + (needVision ? 800 : 0);
      const balanceNow = user.isAdmin ? Infinity : tk.token_balance;
      const maxOut = user.isAdmin ? 4096 : Math.max(256, Math.min(4096, Math.floor(balanceNow - estIn)));

      let text = '';
      let usage: { input: number; output: number } | null = null;
      let usedModel: ModelRow | null = null;
      let failed: string | null = null;
      let extractAfter = false;
      try {
        for await (const ev of streamWithFallback(models, full, { maxTokens: maxOut, temperature: mode === 'serious' ? 0.3 : 0.8, signal: req.signal })) {
          if (ev.model) {
            usedModel = ev.model;
            send({ type: 'model', id: ev.model.id, label: ev.model.label });
          }
          if (ev.delta) {
            text += ev.delta;
            send({ type: 'delta', t: ev.delta });
          }
          if (ev.usage) usage = ev.usage;
        }
      } catch (e) {
        failed = req.signal.aborted ? null : e instanceof Error ? e.message : String(e);
        if (failed) await logError('chat', failed, { conv: convId, model: usedModel?.id });
      }

      // ---- lưu tin nhắn + tính token thực tế
      let messageId: string | null = null;
      let balance: number | null = null;
      try {
        const inTok = usage?.input || estIn;
        const outTok = usage?.output || estimateTokens(text);
        const mult = usedModel?.multiplier ?? 1;
        if (text) {
          const row = await q1<{ id: string }>(
            `INSERT INTO messages (conversation_id, user_id, role, content, sources, model, tokens_in, tokens_out)
             VALUES ($1,$2,'assistant',$3,$4,$5,$6,$7) RETURNING id`,
            [convId, user.id, text, JSON.stringify(sources), usedModel?.id ?? null, inTok, outTok],
          );
          messageId = row!.id;
          await q('UPDATE conversations SET updated_at = now() WHERE id = $1', [convId]);
        }
        if (text || usage) {
          balance = await chargeTokens(user, (inTok + outTok) * mult, { reason: 'chat', model: usedModel?.id, ref: messageId ?? undefined });
        }
        await logActivity(user.id, 'ai_call', { model: usedModel?.id, tokens: inTok + outTok, search: b.search, ok: !failed }, ip);
        const fresh = await loadFreshUserTokens(user.id);
        if (failed) {
          send({ type: 'error', message: text ? 'Kết nối AI bị gián đoạn; phần trả lời đã được lưu.' : 'AI hiện không phản hồi. Hãy thử lại hoặc đổi model.' });
        }
        send({
          type: 'done',
          messageId,
          model: usedModel?.id ?? null,
          tokensCharged: Math.ceil((inTok + outTok) * mult),
          balance: user.isAdmin ? null : fresh?.token_balance ?? balance,
          resetAt: user.isAdmin ? null : fresh?.token_reset_at,
        });
        extractAfter = !!(text && !failed && user.memory_enabled && userText);
      } catch (e) {
        await logError('chat-save', e instanceof Error ? e.message : String(e));
        send({ type: 'error', message: 'Không lưu được câu trả lời.' });
      }
      // đóng luồng NGAY để giao diện không phải chờ bước trích xuất ghi nhớ (một lệnh gọi AI nữa)
      try {
        controller.close();
      } catch {}
      if (extractAfter) {
        try {
          await maybeExtractMemories(user, userText, available.slice(0, 2));
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
});
