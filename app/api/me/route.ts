import { z } from 'zod';
import { handler, json, parseBody } from '@/lib/http';
import { q } from '@/lib/db';
import { requireUser, publicUser, getUser } from '@/lib/auth';
import { tokenSummary } from '@/lib/tokens';
import { env } from '@/lib/env';
import { listAvailableModels } from '@/lib/ai/providers';
import { getSettings } from '@/lib/settings';

export const GET = handler(async () => {
  const u = await getUser();
  if (!u) return json({ user: null }, { status: 401 });
  const [tokens, models, s] = await Promise.all([tokenSummary(u), listAvailableModels(), getSettings()]);
  const announcements = await q('SELECT id, title, body, created_at FROM announcements WHERE active ORDER BY created_at DESC LIMIT 3');
  return json({
    user: publicUser(u),
    tokens,
    announcements,
    features: {
      search: env.searchConfigured,
      google: env.googleConfigured,
      emailVerificationRequired: env.smtpConfigured,
      models: models.map((m) => ({ id: m.id, label: m.label, vision: m.vision })),
      defaultModel: s.default_model,
      maxUploadMb: s.max_upload_mb,
    },
  });
});

const patch = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  uiLang: z.enum(['vi', 'en']).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  defaultMode: z.enum(['serious', 'casual', 'funny', 'playful']).optional(),
  memoryEnabled: z.boolean().optional(),
  useHistory: z.boolean().optional(),
});

const COLS: Record<string, string> = {
  displayName: 'display_name',
  uiLang: 'ui_lang',
  theme: 'theme',
  accent: 'accent',
  defaultMode: 'default_mode',
  memoryEnabled: 'memory_enabled',
  useHistory: 'use_history',
};

export const PATCH = handler(async (req) => {
  const u = await requireUser();
  const b = await parseBody(req, patch);
  const sets: string[] = [];
  const vals: any[] = [u.id];
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    vals.push(v);
    sets.push(`${COLS[k]} = $${vals.length}`);
  }
  if (sets.length) await q(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, vals);
  return json({ ok: true });
});
