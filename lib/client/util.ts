export function hexToTriple(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Từ màu nhấn người dùng chọn -> bộ biến CSS primary/accent phù hợp theme. */
export function accentVars(hex: string, theme: string) {
  const p = hexToTriple(/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#7867FF');
  const accent = theme === 'light' ? mix(p, [0, 0, 0], 0.18) : mix(p, [255, 255, 255], 0.35);
  return { primary: p.join(' '), accent: accent.join(' ') };
}

export function fmtCountdown(ms: number) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d > 0 ? d + 'd ' : ''}${p(h)}:${p(m)}:${p(sec)}`;
}

export function fmtNum(n: number | null | undefined) {
  return n === null || n === undefined ? '∞' : n.toLocaleString('vi-VN');
}

export function timeAgo(iso: string, lang: 'vi' | 'en') {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const vi = lang === 'vi';
  if (diff < 60) return vi ? 'vừa xong' : 'just now';
  if (diff < 3600) return vi ? `${Math.floor(diff / 60)} phút trước` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return vi ? `${Math.floor(diff / 3600)} giờ trước` : `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return vi ? `${Math.floor(diff / 86400)} ngày trước` : `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(vi ? 'vi-VN' : 'en-US');
}

/** Ghép index.html + style.css + script.js thành 1 tài liệu để xem trước trong iframe sandbox. */
export function buildPreviewHtml(files: { path: string; content: string }[]): string {
  const idx = files.find((f) => f.path === 'index.html');
  if (!idx) return '<p style="font-family:sans-serif;padding:2rem">Không có index.html</p>';
  const get = (p: string) => files.find((f) => f.path === p.replace(/^\.\//, ''))?.content;
  let html = idx.content;
  html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, (m, href) => {
    if (!/stylesheet/i.test(m)) return m;
    const css = get(href);
    return css !== undefined ? `<style>${css}</style>` : m;
  });
  html = html.replace(/<script([^>]*)\ssrc=["']([^"']+)["']([^>]*)><\/script>/gi, (m, a, src, b) => {
    const js = get(src);
    return js !== undefined ? `<script${a}${b}>${js.replace(/<\/script/gi, '<\\/script')}</script>` : m;
  });
  return html;
}
