// Trích xuất văn bản từ tệp người dùng tải lên để đưa vào ngữ cảnh AI.
export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|yml|yaml|html|htm|css|js|jsx|ts|tsx|py|java|cs|lua|c|cpp|h|go|rs|php|rb|sql|sh|log|ini|toml)$/i;

export function isImage(mime: string) {
  return IMAGE_MIMES.includes(mime);
}

export async function extractText(name: string, mime: string, data: Buffer): Promise<string | null> {
  const MAX = 60_000;
  try {
    if (mime.startsWith('text/') || TEXT_EXT.test(name) || mime === 'application/json') {
      return data.toString('utf8').slice(0, MAX);
    }
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
      const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(data));
      const { text } = await pdfText(pdf, { mergePages: true });
      const t = String(text).trim();
      if (t.replace(/\s/g, '').length < 20) {
        return '[PDF này không có lớp chữ (có thể là bản scan/ảnh). Không đọc được nội dung; hãy nhờ người dùng gửi bản có thể chọn chữ hoặc chụp từng trang thành ảnh.]';
      }
      return t.slice(0, MAX);
    }
    if (/\.pptx$/i.test(name) || mime.includes('presentationml')) {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(data);
      const slideNames = Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
      const dec = (x: string) => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
      let out = '';
      let i = 0;
      for (const n of slideNames) {
        i++;
        const xml = await zip.files[n].async('string');
        const paras = xml.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => dec(m[1])).join('')).filter((x) => x.trim());
        out += `## Slide ${i}\n${paras.join('\n')}\n\n`;
      }
      return (out.trim() || '[PPTX không có chữ để đọc]').slice(0, MAX);
    }
    if (/\.docx$/i.test(name) || mime.includes('wordprocessingml')) {
      const mammoth = await import('mammoth');
      const r = await mammoth.extractRawText({ buffer: data });
      return r.value.slice(0, MAX);
    }
    if (/\.xlsx$/i.test(name) || mime.includes('spreadsheetml')) {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(data as any);
      let out = '';
      wb.eachSheet((ws) => {
        out += `# Sheet: ${ws.name}\n`;
        ws.eachRow((row) => {
          const vals = (row.values as any[]).slice(1).map((v) => (v && typeof v === 'object' && 'result' in v ? v.result : v ?? ''));
          out += vals.join('\t') + '\n';
        });
      });
      return out.slice(0, MAX);
    }
  } catch {
    return null;
  }
  return null;
}
