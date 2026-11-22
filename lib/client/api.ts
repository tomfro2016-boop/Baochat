export class ApiErr extends Error {
  constructor(
    public status: number,
    message: string,
    public data: any = {},
  ) {
    super(message);
  }
}

export async function api<T = any>(url: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method || (opts.body || opts.form ? 'POST' : 'GET'), signal: opts.signal };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, init);
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* không phải JSON */
  }
  if (!res.ok) throw new ApiErr(res.status, data?.error || `Lỗi ${res.status}`, data);
  return data as T;
}

export type SseEvent = { type: string; [k: string]: any };

/** Gọi /api/chat và đọc luồng SSE. */
export async function streamChat(body: unknown, onEvent: (e: SseEvent) => void, signal: AbortSignal) {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok) {
    let data: any = {};
    try {
      data = await res.json();
    } catch {}
    throw new ApiErr(res.status, data?.error || `Lỗi ${res.status}`, data);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          onEvent(JSON.parse(line.slice(5).trim()));
        } catch {
          /* bỏ qua gói lỗi */
        }
      }
    }
  }
}
