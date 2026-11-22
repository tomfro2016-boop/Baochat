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
      return String(text).slice(0, MAX);
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
