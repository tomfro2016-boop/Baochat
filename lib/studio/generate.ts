import { z } from 'zod';
import type { ChatMsg } from '../ai/providers';
import { presentationPayload, spreadsheetPayload, websitePayload, documentPayload, type Kind } from './schemas';

const LANG_RULE = 'Viết nội dung bằng ngôn ngữ của yêu cầu người dùng (mặc định tiếng Việt nếu yêu cầu bằng tiếng Việt).';

export function buildStudioMessages(kind: Kind, prompt: string, opts: { framework?: 'html' | 'react'; basePayload?: unknown; uiLang: string }): ChatMsg[] {
  let system = '';
  if (kind === 'website') {
    const fw =
      opts.framework === 'react'
        ? `Dùng React 18 + ReactDOM + Babel standalone nạp từ CDN (https://unpkg.com/react@18/umd/react.production.min.js, https://unpkg.com/react-dom@18/umd/react-dom.production.min.js, https://unpkg.com/@babel/standalone/babel.min.js) trong MỘT tệp index.html duy nhất với <script type="text/babel">. Không dùng import/export.`
        : `Dùng HTML, CSS, JavaScript thuần. Tách thành index.html, style.css, script.js (index.html phải liên kết tới style.css và script.js bằng đường dẫn tương đối).`;
    system =
      `Bạn là chuyên gia thiết kế và lập trình web. Tạo website hoàn chỉnh, đẹp, hiện đại, responsive, truy cập tốt, chạy được ngay khi mở index.html. ${fw}\n` +
      `Không dùng khóa API, không gọi backend giả. Không hotlink ảnh có bản quyền; dùng gradient/SVG/emoji. ${LANG_RULE}\n` +
      `ĐỊNH DẠNG TRẢ VỀ (bắt buộc, không thêm lời giải thích ngoài định dạng, không dùng khối \`\`\`):\n` +
      `===SUMMARY===\n(1-2 câu mô tả)\n===FILE: index.html===\n(nội dung)\n===FILE: style.css===\n(nội dung)\n===END===`;
  } else if (kind === 'document') {
    system =
      `Bạn là biên tập viên chuyên nghiệp. Viết tài liệu hoàn chỉnh, có cấu trúc rõ ràng bằng Markdown (tiêu đề #/##/###, danh sách, bảng, đoạn văn). ${LANG_RULE}\n` +
      `ĐỊNH DẠNG TRẢ VỀ (bắt buộc):\n===TITLE===\n(tiêu đề ngắn)\n===DOC===\n(nội dung Markdown; không dùng khối \`\`\` bao ngoài toàn bộ)\n===END===`;
  } else if (kind === 'presentation') {
    system =
      `Bạn là chuyên gia thiết kế bài thuyết trình. Tạo nội dung slide súc tích: mỗi slide 3-6 gạch đầu dòng ngắn (dưới 18 từ), có slide mở đầu ý chính, nội dung, và kết luận. Thêm "notes" là lời dẫn cho người thuyết trình. ${LANG_RULE}\n` +
      `CHỈ trả về một đối tượng JSON hợp lệ, không giải thích, theo mẫu: {"title":"...","subtitle":"...","slides":[{"title":"...","bullets":["..."],"notes":"..."}]}`;
  } else {
    system =
      `Bạn là chuyên gia dữ liệu. Tạo bảng tính hữu ích và chính xác. Có thể dùng công thức Excel bắt đầu bằng "=" (ví dụ "=SUM(B2:B10)") khi cần tổng hợp; số liệu dạng số để cột số là kiểu number. ${LANG_RULE}\n` +
      `Nếu người dùng cung cấp dữ liệu hãy giữ nguyên và bổ sung bảng thống kê (tổng, trung bình, nhóm...) ở sheet riêng. Không bịa số liệu thực tế; nếu cần dữ liệu mẫu hãy ghi rõ trong tên sheet hoặc cột "Ghi chú" rằng đó là dữ liệu minh họa.\n` +
      `CHỈ trả về JSON hợp lệ, không giải thích: {"title":"...","sheets":[{"name":"...","columns":["..."],"rows":[["...",1,"=SUM(B2:B3)"]]}]}`;
  }

  let user = prompt;
  if (opts.basePayload) {
    user =
      `Đây là phiên bản HIỆN TẠI:\n${JSON.stringify(opts.basePayload).slice(0, 60_000)}\n\n` +
      `Hãy chỉnh sửa theo yêu cầu sau và trả về TOÀN BỘ phiên bản mới theo đúng định dạng đã quy định:\n${prompt}`;
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function extractJson(text: string): unknown {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('Không tìm thấy JSON trong phản hồi AI');
  return JSON.parse(t.slice(a, b + 1));
}

export type ParsedOutput = { title: string; payload: any };

export function parseStudioOutput(kind: Kind, text: string, opts: { framework?: 'html' | 'react'; documentFormat?: string; imageFileIds?: string[] }): ParsedOutput {
  if (kind === 'website') {
    const summary = text.match(/===SUMMARY===\s*([\s\S]*?)\s*(?====FILE:)/)?.[1]?.trim() || '';
    const files: { path: string; content: string }[] = [];
    const re = /===FILE:\s*([^\n=]+?)\s*===\n([\s\S]*?)(?=\n===(?:FILE:|END===)|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      let content = m[2].replace(/^```[a-z]*\n/i, '').replace(/\n```\s*$/, '');
      files.push({ path: m[1].trim(), content });
    }
    if (!files.length) throw new Error('AI không trả về tệp nào theo đúng định dạng (có thể bị cắt do giới hạn độ dài).');
    if (!files.some((f) => f.path === 'index.html')) throw new Error('Thiếu index.html trong kết quả');
    const payload = websitePayload.parse({ framework: opts.framework || 'html', summary, files });
    const title = (payload.files.find((f) => f.path === 'index.html')!.content.match(/<title>([^<]{1,80})<\/title>/i)?.[1] || 'Website').trim();
    return { title, payload };
  }
  if (kind === 'document') {
    const title = text.match(/===TITLE===\s*([\s\S]*?)\s*===DOC===/)?.[1]?.trim() || 'Tài liệu';
    const body = text.match(/===DOC===\s*([\s\S]*?)\s*(?:===END===|$)/)?.[1]?.trim();
    if (!body) throw new Error('AI không trả về nội dung tài liệu theo đúng định dạng.');
    const payload = documentPayload.parse({ format: opts.documentFormat || 'docx', markdown: body });
    return { title: title.slice(0, 120), payload };
  }
  if (kind === 'presentation') {
    const j = extractJson(text) as any;
    const deck = z.object({ title: z.string(), subtitle: z.string().optional(), slides: z.array(z.any()) }).parse(j);
    const payload = presentationPayload.parse({
      deck: {
        title: deck.title,
        subtitle: deck.subtitle,
        slides: deck.slides.map((s: any) => ({ title: String(s.title ?? ''), bullets: (s.bullets ?? []).map(String), notes: s.notes ? String(s.notes) : undefined })),
      },
      imageFileIds: opts.imageFileIds ?? [],
    });
    return { title: deck.title.slice(0, 120), payload };
  }
  const j = extractJson(text) as any;
  const payload = spreadsheetPayload.parse({
    book: {
      title: String(j.title ?? 'Bảng tính'),
      sheets: (j.sheets ?? []).map((s: any) => ({
        name: String(s.name ?? 'Sheet'),
        columns: (s.columns ?? []).map(String),
        rows: (s.rows ?? []).map((r: any[]) => r.map((c) => (c === undefined ? null : typeof c === 'object' && c !== null ? JSON.stringify(c) : c))),
      })),
    },
  });
  return { title: payload.book.title.slice(0, 120), payload };
}
