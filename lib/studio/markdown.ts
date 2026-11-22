// Bộ phân tích Markdown tối giản dùng chung cho xuất DOCX và PDF.
export type Run = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type Block =
  | { t: 'h'; level: 1 | 2 | 3 | 4; runs: Run[] }
  | { t: 'p'; runs: Run[] }
  | { t: 'quote'; runs: Run[] }
  | { t: 'ul'; items: Run[][] }
  | { t: 'ol'; items: Run[][] }
  | { t: 'code'; text: string }
  | { t: 'table'; rows: Run[][][] }
  | { t: 'hr' };

export function parseInline(s: string): Run[] {
  const runs: Run[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) runs.push({ text: s.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**') || tok.startsWith('__')) runs.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith('`')) runs.push({ text: tok.slice(1, -1), code: true });
    else if (tok.startsWith('[')) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      runs.push({ text: `${mm[1]} (${mm[2]})` });
    } else runs.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < s.length) runs.push({ text: s.slice(last) });
  return runs.length ? runs : [{ text: '' }];
}

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^\s*```/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push({ t: 'code', text: buf.join('\n') });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push({ t: 'h', level: h[1].length as 1 | 2 | 3 | 4, runs: parseInline(h[2].trim()) }); i++; continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { out.push({ t: 'hr' }); i++; continue; }
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push({ t: 'quote', runs: parseInline(buf.join(' ')) });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows: Run[][][] = [];
      const split = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => parseInline(c.trim()));
      rows.push(split(line));
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(split(lines[i++]));
      out.push({ t: 'table', rows });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: Run[][] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(parseInline(lines[i++].replace(/^\s*[-*+]\s+/, '')));
      out.push({ t: 'ul', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: Run[][] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(parseInline(lines[i++].replace(/^\s*\d+[.)]\s+/, '')));
      out.push({ t: 'ol', items });
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{1,4}\s|\s*```|\s*>|\s*[-*+]\s+|\s*\d+[.)]\s+|\s*\|.*\|)/.test(lines[i])
    ) buf.push(lines[i++].trim());
    if (!buf.length) { buf.push(lines[i++].trim()); }
    out.push({ t: 'p', runs: parseInline(buf.join(' ')) });
  }
  return out;
}

export function plainText(runs: Run[]) {
  return runs.map((r) => r.text).join('');
}
