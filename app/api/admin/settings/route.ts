import { z } from 'zod';
import { handler, json, parseBody } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { getSettings, setSetting, type Settings } from '@/lib/settings';
import { logActivity } from '@/lib/log';

export const GET = handler(async () => {
  await requireAdmin();
  return json({ settings: await getSettings(true) });
});

const patch = z.object({
  token_reset_interval_hours: z.number().min(0.0167).max(24 * 90).optional(),
  token_grant_min: z.number().int().min(0).max(10_000_000).optional(),
  token_grant_max: z.number().int().min(0).max(10_000_000).optional(),
  registration_open: z.boolean().optional(),
  default_model: z.string().max(80).optional(),
  chat_rate_per_minute: z.number().int().min(1).max(600).optional(),
  max_upload_mb: z.number().int().min(1).max(25).optional(),
});

export const PATCH = handler(async (req) => {
  const admin = await requireAdmin();
  const b = await parseBody(req, patch);
  for (const [k, v] of Object.entries(b)) if (v !== undefined) await setSetting(k as keyof Settings, v);
  await logActivity(admin.id, 'admin_settings', b);
  return json({ ok: true, settings: await getSettings(true) });
});
