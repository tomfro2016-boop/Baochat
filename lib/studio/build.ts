// Tạo tệp THẬT bằng thư viện chuyên dụng (docx, pdfkit, pptxgenjs, exceljs, jszip).
import path from 'node:path';
import JSZip from 'jszip';
import { parseMarkdown, plainText, type Run, type Block } from './markdown';
import type { WebsitePayload, DocumentPayload, PresentationPayload, SpreadsheetPayload } from './schemas';

export type BuiltFile = { buffer: Buffer; mime: string; filename: string };

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 50) || 'baochat';

// ----------------------------------------------------------------------- ZIP
export async function buildZip(title: string, p: WebsitePayload): Promise<BuiltFile> {
  const zip = new JSZip();
  for (const f of p.files) zip.file(f.path, f.content);
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, mime: 'application/zip', filename: `${slug(title)}.zip` };
}

// ---------------------------------------------------------------------- TEXT
export function buildText(title: string, p: DocumentPayload, ext: 'txt' | 'md'): BuiltFile {
  let content = p.markdown;
  if (ext === 'txt') {
    content = parseMarkdown(p.markdown)
      .map((b) => {
        switch (b.t) {
          case 'h': return plainText(b.runs).toUpperCase() + '\n';
          case 'p': case 'quote': return plainText(b.runs);
          case 'ul': return b.items.map((i) => '• ' + plainText(i)).join('\n');
          case 'ol': return b.items.map((i, n) => `${n + 1}. ${plainText(i)}`).join('\n');
          case 'code': return b.text;
          case 'table': return b.rows.map((r) => r.map(plainText).join('\t')).join('\n');
          case 'hr': return '----------';
        }
      })
      .join('\n\n');
  }
  return { buffer: Buffer.from(content, 'utf8'), mime: ext === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8', filename: `${slug(title)}.${ext}` };
}

// ---------------------------------------------------------------------- DOCX
export async function buildDocx(title: string, p: DocumentPayload): Promise<BuiltFile> {
  const d = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, LevelFormat, ShadingType } = d;

  const runs = (rs: Run[], extra: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
    rs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold || extra.bold,
          italics: r.italic || extra.italics,
          font: r.code ? 'Consolas' : undefined,
          size: extra.size,
          shading: r.code ? { type: ShadingType.CLEAR, fill: 'EEEEF4', color: 'auto' } : undefined,
        }),
    );

  const headings = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];
  const children: any[] = [];
  let olInstance = 0;
  const blocks: Block[] = parseMarkdown(p.markdown);

  for (const b of blocks) {
    switch (b.t) {
      case 'h':
        children.push(new Paragraph({ heading: headings[b.level - 1], children: runs(b.runs), spacing: { before: 240, after: 120 } }));
        break;
      case 'p':
        children.push(new Paragraph({ children: runs(b.runs), spacing: { after: 140, line: 300 } }));
        break;
      case 'quote':
        children.push(new Paragraph({ children: runs(b.runs, { italics: true }), indent: { left: 480 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: '7867FF', space: 8 } }, spacing: { after: 140 } }));
        break;
      case 'ul':
        for (const it of b.items) children.push(new Paragraph({ children: runs(it), numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60 } }));
        break;
      case 'ol': {
        olInstance++;
        for (const it of b.items) children.push(new Paragraph({ children: runs(it), numbering: { reference: 'numbers', level: 0, instance: olInstance }, spacing: { after: 60 } }));
        break;
      }
      case 'code':
        for (const ln of b.text.split('\n')) {
          children.push(new Paragraph({ children: [new TextRun({ text: ln || ' ', font: 'Consolas', size: 20 })], shading: { type: ShadingType.CLEAR, fill: 'F1F1F6', color: 'auto' }, spacing: { after: 0 } }));
        }
        children.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        break;
      case 'table': {
        const cols = Math.max(...b.rows.map((r) => r.length));
        const border = { style: BorderStyle.SINGLE, size: 4, color: 'C9CBD6' };
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: b.rows.map(
              (r, ri) =>
                new TableRow({
                  tableHeader: ri === 0,
                  children: Array.from({ length: cols }).map(
                    (_, ci) =>
                      new TableCell({
                        borders: { top: border, bottom: border, left: border, right: border },
                        shading: ri === 0 ? { type: ShadingType.CLEAR, fill: 'EDEBFF', color: 'auto' } : undefined,
                        margins: { top: 60, bottom: 60, left: 100, right: 100 },
                        children: [new Paragraph({ children: runs(r[ci] || [{ text: '' }], { bold: ri === 0 }) })],
                      }),
                  ),
                }),
            ),
          }),
        );
        children.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        break;
      }
      case 'hr':
        children.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C9CBD6', space: 1 } }, spacing: { after: 160 } }));
        break;
    }
  }

  const doc = new Document({
    creator: 'Baochat',
    title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: 'left', style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: 'left', style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
      ],
    },
    sections: [{ children }],
  });
  const buffer = await Packer.toBuffer(doc);
  return { buffer: Buffer.from(buffer), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: `${slug(title)}.docx` };
}

// ----------------------------------------------------------------------- PDF
export async function buildPdf(title: string, p: DocumentPayload): Promise<BuiltFile> {
  const PDFDocument = (await import('pdfkit')).default;
  const fontDir = path.join(process.cwd(), 'assets', 'fonts');
  const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 60, right: 60 }, info: { Title: title, Creator: 'Baochat' } });
  doc.registerFont('R', path.join(fontDir, 'DejaVuSans.ttf'));
  doc.registerFont('B', path.join(fontDir, 'DejaVuSans-Bold.ttf'));
  doc.registerFont('I', path.join(fontDir, 'DejaVuSans-Oblique.ttf'));
  doc.registerFont('M', path.join(fontDir, 'DejaVuSansMono.ttf'));

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((res) => doc.on('end', () => res()));

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const fontFor = (r: Run, base: 'R' | 'B' | 'I' = 'R') => (r.code ? 'M' : r.bold || base === 'B' ? 'B' : r.italic || base === 'I' ? 'I' : 'R');
  const ensure = (h: number) => {
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
  };
  const writeRuns = (rs: Run[], size: number, opts: { indent?: number; base?: 'R' | 'B' | 'I'; width?: number; color?: string } = {}) => {
    const x = doc.page.margins.left + (opts.indent || 0);
    rs.forEach((r, i) => {
      doc.font(fontFor(r, opts.base)).fontSize(r.code ? size - 1 : size).fillColor(opts.color || '#1B1D27');
      const last = i === rs.length - 1;
      if (i === 0) doc.text(r.text, x, doc.y, { width: opts.width ?? W - (opts.indent || 0), continued: !last, lineGap: 3 });
      else doc.text(r.text, { continued: !last, lineGap: 3 });
    });
  };

  // Tiêu đề tài liệu
  doc.font('B').fontSize(22).fillColor('#5B4BDB').text(title, { width: W });
  doc.moveDown(0.3);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + W, doc.y).lineWidth(1.5).strokeColor('#A99CFF').stroke();
  doc.moveDown(0.8);

  for (const b of parseMarkdown(p.markdown)) {
    switch (b.t) {
      case 'h': {
        const size = [20, 16, 13.5, 12][b.level - 1];
        ensure(size * 3);
        doc.moveDown(0.5);
        writeRuns(b.runs, size, { base: 'B', color: b.level === 1 ? '#5B4BDB' : '#1B1D27' });
        doc.moveDown(0.3);
        break;
      }
      case 'p':
        ensure(40);
        writeRuns(b.runs, 10.5);
        doc.moveDown(0.6);
        break;
      case 'quote':
        ensure(40);
        writeRuns(b.runs, 10.5, { indent: 16, base: 'I', color: '#4A4D5E' });
        doc.moveDown(0.6);
        break;
      case 'ul':
      case 'ol':
        b.items.forEach((it, n) => {
          ensure(24);
          const y = doc.y;
          doc.font('R').fontSize(10.5).fillColor('#5B4BDB').text(b.t === 'ul' ? '•' : `${n + 1}.`, doc.page.margins.left + 4, y, { width: 20 });
          doc.y = y;
          writeRuns(it, 10.5, { indent: 26 });
          doc.moveDown(0.25);
        });
        doc.moveDown(0.4);
        break;
      case 'code': {
        const text = b.text || ' ';
        doc.font('M').fontSize(9);
        const h = doc.heightOfString(text, { width: W - 16 }) + 14;
        ensure(Math.min(h, 200));
        const y = doc.y;
        doc.roundedRect(doc.page.margins.left, y, W, h, 4).fill('#F1F1F6');
        doc.fillColor('#1B1D27').text(text, doc.page.margins.left + 8, y + 7, { width: W - 16 });
        doc.y = y + h + 8;
        break;
      }
      case 'table': {
        const cols = Math.max(...b.rows.map((r) => r.length));
        const cw = W / cols;
        b.rows.forEach((r, ri) => {
          doc.font(ri === 0 ? 'B' : 'R').fontSize(9.5);
          const heights = Array.from({ length: cols }).map((_, ci) => doc.heightOfString(plainText(r[ci] || []), { width: cw - 10 }));
          const rh = Math.max(...heights) + 10;
          ensure(rh);
          const y = doc.y;
          Array.from({ length: cols }).forEach((_, ci) => {
            const x = doc.page.margins.left + ci * cw;
            doc.rect(x, y, cw, rh).lineWidth(0.5).strokeColor('#C9CBD6').fillAndStroke(ri === 0 ? '#EDEBFF' : '#FFFFFF', '#C9CBD6');
            doc.fillColor('#1B1D27').text(plainText(r[ci] || []), x + 5, y + 5, { width: cw - 10 });
          });
          doc.y = y + rh;
        });
        doc.moveDown(0.8);
        break;
      }
      case 'hr':
        doc.moveDown(0.3);
        doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + W, doc.y).lineWidth(0.5).strokeColor('#C9CBD6').stroke();
        doc.moveDown(0.6);
        break;
    }
  }
  doc.end();
  await done;
  return { buffer: Buffer.concat(chunks), mime: 'application/pdf', filename: `${slug(title)}.pdf` };
}

// ---------------------------------------------------------------------- PPTX
export async function buildPptx(p: PresentationPayload, images: { mime: string; data: Buffer }[]): Promise<BuiltFile> {
  const PptxGenJS = (await import('pptxgenjs')).default as any;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  pptx.title = p.deck.title;
  pptx.author = 'Baochat';

  const DARK = '0B0D12';
  const PRIMARY = '7867FF';
  const ACCENT = 'A99CFF';

  // Slide tiêu đề
  const s0 = pptx.addSlide();
  s0.background = { color: DARK };
  s0.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: PRIMARY } });
  s0.addText(p.deck.title, { x: 0.9, y: 2.3, w: 11.5, h: 1.6, fontFace: 'Calibri', fontSize: 44, bold: true, color: 'FFFFFF', valign: 'bottom' });
  if (p.deck.subtitle) s0.addText(p.deck.subtitle, { x: 0.9, y: 4.05, w: 11.5, h: 0.9, fontFace: 'Calibri', fontSize: 22, color: ACCENT, valign: 'top' });
  s0.addText('Baochat', { x: 0.9, y: 6.7, w: 4, h: 0.4, fontSize: 12, color: '9298AA' });

  p.deck.slides.forEach((sl, idx) => {
    const s = pptx.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: PRIMARY } });
    s.addText(sl.title, { x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontFace: 'Calibri', fontSize: 30, bold: true, color: '1B1D27', valign: 'middle' });
    s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.3, w: 1.2, h: 0.06, fill: { color: ACCENT } });

    const img = images[idx];
    const textW = img ? 7.4 : 12.1;
    if (sl.bullets.length) {
      s.addText(
        sl.bullets.map((b) => ({ text: b, options: { bullet: { code: '25CF' }, breakLine: true, paraSpaceAfter: 10 } })),
        { x: 0.6, y: 1.6, w: textW, h: 5.0, fontFace: 'Calibri', fontSize: sl.bullets.length > 6 ? 18 : 22, color: '2A2D3A', valign: 'top', fit: 'shrink' },
      );
    }
    if (img) {
      s.addImage({ data: `${img.mime};base64,${img.data.toString('base64')}`, x: 8.4, y: 1.7, w: 4.3, h: 4.6, sizing: { type: 'contain', w: 4.3, h: 4.6 } });
    }
    s.addText(`${idx + 1}`, { x: 12.3, y: 6.95, w: 0.7, h: 0.3, fontSize: 11, color: '9298AA', align: 'right' });
    if (sl.notes) s.addNotes(sl.notes);
  });

  const out = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return { buffer: Buffer.from(out), mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', filename: `${slug(p.deck.title)}.pptx` };
}

// ---------------------------------------------------------------------- XLSX
export async function buildXlsx(p: SpreadsheetPayload): Promise<BuiltFile> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Baochat';
  const used = new Set<string>();
  for (const sh of p.book.sheets) {
    let name = sh.name.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Sheet';
    while (used.has(name.toLowerCase())) name = (name.slice(0, 28) + '_' + used.size).slice(0, 31);
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(sh.columns);
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7867FF' } };
    head.alignment = { vertical: 'middle' };
    for (const r of sh.rows) {
      ws.addRow(r.map((v) => (typeof v === 'string' && v.startsWith('=') && v.length > 1 ? { formula: v.slice(1) } : v)));
    }
    sh.columns.forEach((c, i) => {
      let max = c.length;
      for (const r of sh.rows.slice(0, 200)) max = Math.max(max, String(r[i] ?? '').length);
      ws.getColumn(i + 1).width = Math.min(60, Math.max(10, max + 2));
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sh.columns.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buf as ArrayBuffer), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${slug(p.book.title)}.xlsx` };
}

export function buildCsv(p: SpreadsheetPayload, sheetIndex = 0): BuiltFile {
  const sh = p.book.sheets[sheetIndex] ?? p.book.sheets[0];
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s; // chống CSV/formula injection
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [sh.columns, ...sh.rows].map((r) => r.map(esc).join(','));
  return { buffer: Buffer.from('﻿' + lines.join('\r\n'), 'utf8'), mime: 'text/csv; charset=utf-8', filename: `${slug(p.book.title)}.csv` };
}
