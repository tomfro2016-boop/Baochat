import { z } from 'zod';
import { handler, json, parseBody } from '@/lib/http';
import { q } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { listAllModelsWithStatus } from '@/lib/ai/providers';
import { logActivity } from '@/lib/log';

export const GET = handler(async () => {
  await requireAdmin();
  const providers = await q('SELECT id, label, kind, base_url, api_key_env, enabled FROM providers ORDER BY id');
  return json({
    models: await listAllModelsWithStatus(),
    providers: providers.map((p: any) => ({ ...p, keyPresent: !!process.env[p.api_key_env] })), // chỉ báo có/không, không bao giờ trả về khóa
  });
});

const create = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,60}$/),
  provider_id: z.string().min(1).max(40),
  model_name: z.string().min(1).max(120),
  label: z.string().min(1).max(60),
  vision: z.boolean().default(false),
  max_output: z.number().int().min(64).max(64000).default(4096),
  multiplier: z.number().min(0.1).max(100).default(1),
  priority: z.number().int().min(0).max(10000).default(100),
});

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const b = await parseBody(req, create);
  await q(
    `INSERT INTO models (id, provider_id, model_name, label, vision, max_output, multiplier, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [b.id, b.provider_id, b.model_name, b.label, b.vision, b.max_output, b.multiplier, b.priority],
  );
  await logActivity(admin.id, 'admin_model_create', { id: b.id });
  return json({ ok: true });
});
