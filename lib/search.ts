import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from './env';

export type SearchResult = { title: string; url: string; snippet: string };

export async function webSearch(query: string, max = 6): Promise<SearchResult[]> {
  query = query.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!query) return [];
  if (env.tavilyKey) {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.tavilyKey}` },
      body: JSON.stringify({ query, max_results: max, search_depth: 'basic' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
    const j: any = await res.json();
    return (j.results || []).map((r: any) => ({ title: String(r.title || r.url), url: String(r.url), snippet: String(r.content || '').slice(0, 500) }));
  }
  if (env.braveKey) {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`, {
      headers: { 'x-subscription-token': env.braveKey, accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Brave HTTP ${res.status}`);
    const j: any = await res.json();
    return (j.web?.results || []).map((r: any) => ({
      title: String(r.title || r.url),
      url: String(r.url),
      snippet: String(r.description || '').replace(/<[^>]+>/g, '').slice(0, 500),
    }));
  }
  throw new Error('SEARCH_NOT_CONFIGURED');
}

// ------------------------------------------------------------------ SSRF guard
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
  }
  return true;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Giao thức không được phép');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('Cổng không được phép');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Địa chỉ nội bộ bị chặn');
    return u;
  }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Địa chỉ nội bộ bị chặn');
  return u;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Đọc nội dung trang web công khai (có chống SSRF, giới hạn kích thước và thời gian). */
export async function readPage(url: string, maxChars = 5000): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const u = await assertPublicUrl(current);
    const res = await fetch(u, {
      redirect: 'manual',
      headers: { 'user-agent': 'BaochatBot/1.0 (+reader)', accept: 'text/html,text/plain;q=0.9' },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, u).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!/text\/(html|plain)|application\/xhtml/.test(ct)) throw new Error('Không phải trang văn bản');
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 1_000_000) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks).toString('utf8');
    return (ct.includes('plain') ? html : htmlToText(html)).slice(0, maxChars);
  }
  throw new Error('Quá nhiều chuyển hướng');
}

/** Tìm kiếm + đọc vài trang đầu. Trả về nguồn và đoạn ngữ cảnh đã đánh số [n]. */
export async function searchAndRead(query: string) {
  const results = await webSearch(query, 6);
  const top = results.slice(0, 3);
  const pages = await Promise.all(top.map((r) => readPage(r.url, 4000).catch(() => '')));
  const sources = results.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet }));
  const context = results
    .map((r, i) => {
      const body = pages[i] || '';
      return `[${i + 1}] ${r.title}\nURL: ${r.url}\nTóm tắt: ${r.snippet}${body ? `\nNội dung trang (cắt ngắn): ${body}` : ''}`;
    })
    .join('\n\n---\n\n');
  return { sources, context };
}
