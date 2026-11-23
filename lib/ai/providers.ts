import { q } from '../db';
import { logError } from '../log';

export type ChatMsg = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: { mime: string; b64: string }[];
};

export type ModelRow = {
  id: string;
  provider_id: string;
  provider_label: string;
  kind: 'openai' | 'anthropic';
  base_url: string;
  api_key_env: string;
  model_name: string;
  label: string;
  vision: boolean;
  max_output: number;
  multiplier: number;
  priority: number;
};

export type StreamEvent = { delta?: string; usage?: { input: number; output: number }; model?: ModelRow };

const MODEL_SELECT = `
  SELECT m.id, m.provider_id, p.label AS provider_label, p.kind, p.base_url, p.api_key_env,
         m.model_name, m.label, m.vision, m.max_output, m.multiplier, m.priority
    FROM models m JOIN providers p ON p.id = m.provider_id
   WHERE m.enabled AND p.enabled
   ORDER BY m.priority ASC, m.id ASC`;

/** Các model đang bật VÀ provider có khóa API trong biến môi trường. */
export async function listAvailableModels(): Promise<ModelRow[]> {
  const rows = await q<ModelRow>(MODEL_SELECT);
  return rows.filter((m) => !!process.env[m.api_key_env]);
}

export async function listAllModelsWithStatus() {
  const rows = await q<ModelRow & { enabled: boolean }>(
    `SELECT m.id, m.provider_id, p.label AS provider_label, p.kind, p.base_url, p.api_key_env,
            m.model_name, m.label, m.vision, m.max_output, m.multiplier, m.priority, m.enabled
       FROM models m JOIN providers p ON p.id = m.provider_id ORDER BY m.priority, m.id`,
  );
  return rows.map((m) => ({ ...m, keyPresent: !!process.env[m.api_key_env] }));
}

/** Sắp xếp thứ tự thử: model ưu tiên trước, sau đó theo priority (cơ chế fallback). */
export function orderModels(all: ModelRow[], preferredId: string | null | undefined, needVision: boolean): ModelRow[] {
  const pool = needVision ? all.filter((m) => m.vision) : all;
  const first = preferredId ? pool.filter((m) => m.id === preferredId) : [];
  const rest = pool.filter((m) => m.id !== preferredId);
  return [...first, ...rest];
}

// ---------------------------------------------------------------- SSE helper
async function* sseLines(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
  if (buf.startsWith('data:')) yield buf.slice(5).trim();
}

/**
 * Hai mốc thời gian: `headerMs` chờ nhà cung cấp bắt đầu phản hồi (tránh treo khi model quá tải),
 * sau đó `totalMs` cho toàn bộ luồng trả lời. `started()` gọi ngay khi nhận được header.
 */
function makeSignal(parent: AbortSignal | undefined, headerMs = 40_000, totalMs = 120_000) {
  const ctl = new AbortController();
  const abort = (why: string) => ctl.abort(new Error(why));
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => abort('timeout: nhà cung cấp AI không phản hồi'), headerMs);
  const onParent = () => abort('aborted');
  if (parent) {
    if (parent.aborted) onParent();
    else parent.addEventListener('abort', onParent, { once: true });
  }
  return {
    signal: ctl.signal,
    started() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => abort('timeout: phản hồi quá lâu'), totalMs);
    },
    done() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      parent?.removeEventListener('abort', onParent);
      try { ctl.abort(); } catch {} // đóng kết nối nếu ta dừng sớm (chống lặp / người dùng bấm dừng)
    },
  };
}

async function errorText(res: Response) {
  try {
    const t = await res.text();
    return t.slice(0, 400);
  } catch {
    return '';
  }
}

// ------------------------------------------------------------------- OpenAI
function toOpenAIMessages(msgs: ChatMsg[]) {
  return msgs.map((m) => {
    if (m.images?.length && m.role === 'user') {
      return {
        role: 'user',
        content: [
          { type: 'text', text: m.content },
          ...m.images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.b64}` } })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

async function* streamOpenAI(model: ModelRow, msgs: ChatMsg[], opts: CallOpts): AsyncGenerator<StreamEvent> {
  const key = process.env[model.api_key_env]!;
  const sig = makeSignal(opts.signal, 40_000, opts.totalMs ?? 120_000);
  try {
  const res = await fetch(`${model.base_url.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model.model_name,
      messages: toOpenAIMessages(msgs),
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.7,
      ...(model.base_url.includes('openrouter.ai') ? { frequency_penalty: 0.4, presence_penalty: 0.2 } : {}),
    }),
    signal: sig.signal,
  });
  sig.started();
  if (!res.ok) throw new Error(`${model.provider_label} HTTP ${res.status}: ${await errorText(res)}`);
  let usage: { input: number; output: number } | undefined;
  for await (const data of sseLines(res)) {
    if (data === '[DONE]') break;
    let j: any;
    try {
      j = JSON.parse(data);
    } catch {
      continue;
    }
    const delta = j.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) yield { delta };
    if (j.usage) usage = { input: j.usage.prompt_tokens ?? 0, output: j.usage.completion_tokens ?? 0 };
  }
  if (usage) yield { usage };
  } finally {
    sig.done();
  }
}

// ---------------------------------------------------------------- Anthropic
function toAnthropic(msgs: ChatMsg[]) {
  const system = msgs
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const out: { role: 'user' | 'assistant'; content: any }[] = [];
  for (const m of msgs) {
    if (m.role === 'system') continue;
    const blocks: any[] = [];
    if (m.images?.length && m.role === 'user') {
      for (const i of m.images) blocks.push({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.b64 } });
    }
    blocks.push({ type: 'text', text: m.content || ' ' });
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content.push(...blocks); // Anthropic yêu cầu xen kẽ vai trò
    else out.push({ role: m.role, content: blocks });
  }
  if (out.length && out[0].role !== 'user') out.unshift({ role: 'user', content: [{ type: 'text', text: '(bắt đầu)' }] });
  return { system, messages: out };
}

async function* streamAnthropic(model: ModelRow, msgs: ChatMsg[], opts: CallOpts): AsyncGenerator<StreamEvent> {
  const key = process.env[model.api_key_env]!;
  const { system, messages } = toAnthropic(msgs);
  const sig = makeSignal(opts.signal, 40_000, opts.totalMs ?? 120_000);
  try {
  const res = await fetch(`${model.base_url.replace(/\/+$/, '')}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: model.model_name,
      system,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
    signal: sig.signal,
  });
  sig.started();
  if (!res.ok) throw new Error(`${model.provider_label} HTTP ${res.status}: ${await errorText(res)}`);
  let input = 0;
  let output = 0;
  for await (const data of sseLines(res)) {
    let j: any;
    try {
      j = JSON.parse(data);
    } catch {
      continue;
    }
    if (j.type === 'message_start') input = j.message?.usage?.input_tokens ?? 0;
    else if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') yield { delta: j.delta.text };
    else if (j.type === 'message_delta') output = j.usage?.output_tokens ?? output;
    else if (j.type === 'error') throw new Error(`${model.provider_label}: ${j.error?.message || 'stream error'}`);
  }
  yield { usage: { input, output } };
  } finally {
    sig.done();
  }
}

// ---------------------------------------------------------------- Public API
export type CallOpts = { maxTokens: number; temperature?: number; signal?: AbortSignal; totalMs?: number };

/**
 * Stream với fallback: thử lần lượt các model. Chỉ chuyển sang model kế tiếp khi lỗi xảy ra
 * TRƯỚC khi có chữ nào được gửi đi. Nếu lỗi giữa chừng, ném lỗi để phía gọi lưu phần đã có.
 */
const MAX_ATTEMPTS = 3; // số lần thử mỗi model khi gặp lỗi tạm thời
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });

/** Lỗi tạm thời (quá tải, giới hạn tốc độ, treo mạng) đáng để thử lại; lỗi khóa/tên model thì không. */
export function isTransient(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const code = Number(msg.match(/HTTP (\d{3})/)?.[1] ?? 0);
  if (code) return [408, 409, 425, 429, 500, 502, 503, 504].includes(code);
  return /timeout|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|terminated/i.test(msg);
}

/**
 * Stream với retry + fallback: mỗi model được thử tối đa MAX_ATTEMPTS lần nếu lỗi tạm thời
 * (chờ 1s, 2s giữa các lần), rồi mới chuyển sang model kế tiếp. Chỉ thử lại/chuyển model khi lỗi xảy ra
 * TRƯỚC khi có chữ nào được gửi đi. Nếu lỗi giữa chừng, ném lỗi để phía gọi lưu phần đã có.
 */
export async function* streamWithFallback(models: ModelRow[], msgs: ChatMsg[], opts: CallOpts): AsyncGenerator<StreamEvent> {
  if (!models.length) throw new Error('NO_MODEL');
  let lastErr: unknown;
  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let started = false;
      try {
        yield { model };
        const maxTokens = Math.min(opts.maxTokens, model.max_output);
        const gen = model.kind === 'anthropic' ? streamAnthropic(model, msgs, { ...opts, maxTokens }) : streamOpenAI(model, msgs, { ...opts, maxTokens });
        for await (const ev of gen) {
          if (ev.delta) started = true;
          yield ev;
        }
        return;
      } catch (e) {
        lastErr = e;
        await logError('ai', `Model ${model.id} lỗi (lần ${attempt}/${MAX_ATTEMPTS}): ${e instanceof Error ? e.message : e}`, { model: model.id, started });
        if (started || opts.signal?.aborted) throw e;
        if (!isTransient(e) || attempt === MAX_ATTEMPTS) break; // lỗi vĩnh viễn hoặc hết lượt -> model kế tiếp
        await sleep(1000 * attempt, opts.signal);
        if (opts.signal?.aborted) throw e;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Tất cả model đều lỗi');
}

/** Gọi không stream (Studio, trích xuất ghi nhớ, kiểm tra model). */
export async function completeWithFallback(
  models: ModelRow[],
  msgs: ChatMsg[],
  opts: CallOpts,
): Promise<{ text: string; usage: { input: number; output: number }; model: ModelRow }> {
  let text = '';
  let usage = { input: 0, output: 0 };
  let used: ModelRow | undefined;
  for await (const ev of streamWithFallback(models, msgs, opts)) {
    if (ev.model) {
      if (used && used.id !== ev.model.id) text = ''; // model trước lỗi sớm -> bỏ
      used = ev.model;
    }
    if (ev.delta) text += ev.delta;
    if (ev.usage) usage = ev.usage;
  }
  return { text, usage, model: used! };
}
