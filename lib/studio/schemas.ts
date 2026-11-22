import { z } from 'zod';

export const KINDS = ['website', 'document', 'presentation', 'spreadsheet'] as const;
export type Kind = (typeof KINDS)[number];

const safePath = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[\w\-./]+$/, 'Đường dẫn tệp không hợp lệ')
  .refine((p) => !p.includes('..') && !p.startsWith('/'), 'Đường dẫn tệp không hợp lệ');

export const websitePayload = z.object({
  framework: z.enum(['html', 'react']).default('html'),
  summary: z.string().max(2000).default(''),
  files: z.array(z.object({ path: safePath, content: z.string().max(600_000) })).min(1).max(30),
});

export const documentPayload = z.object({
  format: z.enum(['docx', 'pdf', 'txt', 'md']).default('docx'),
  markdown: z.string().max(300_000),
});

export const slideSchema = z.object({
  title: z.string().max(200),
  bullets: z.array(z.string().max(500)).max(10).default([]),
  notes: z.string().max(2000).optional(),
});
export const presentationPayload = z.object({
  deck: z.object({
    title: z.string().max(200),
    subtitle: z.string().max(300).optional(),
    slides: z.array(slideSchema).min(1).max(40),
  }),
  imageFileIds: z.array(z.string().uuid()).max(20).default([]),
});

export const cell = z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]);
export const spreadsheetPayload = z.object({
  book: z.object({
    title: z.string().max(200),
    sheets: z
      .array(
        z.object({
          name: z.string().min(1).max(31),
          columns: z.array(z.string().max(100)).min(1).max(50),
          rows: z.array(z.array(cell).max(50)).max(5000),
        }),
      )
      .min(1)
      .max(10),
  }),
});

export const payloadSchemas = {
  website: websitePayload,
  document: documentPayload,
  presentation: presentationPayload,
  spreadsheet: spreadsheetPayload,
} as const;

export type WebsitePayload = z.infer<typeof websitePayload>;
export type DocumentPayload = z.infer<typeof documentPayload>;
export type PresentationPayload = z.infer<typeof presentationPayload>;
export type SpreadsheetPayload = z.infer<typeof spreadsheetPayload>;
