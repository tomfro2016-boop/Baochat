import { handler, json } from '@/lib/http';
import { q, q1 } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { listAllModelsWithStatus } from '@/lib/ai/providers';
import { env } from '@/lib/env';

export const GET = handler(async () => {
  await requireAdmin();
  const t0 = Date.now();
  await q('SELECT 1');
  const dbMs = Date.now() - t0;

  const totals = await q1(`
    SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM users WHERE last_seen_at > now() - interval '15 minutes') AS active_now,
      (SELECT count(*)::int FROM users WHERE last_seen_at > now() - interval '24 hours') AS active_24h,
      (SELECT count(*)::int FROM users WHERE created_at > now() - interval '24 hours') AS new_24h,
      (SELECT count(*)::int FROM users WHERE created_at > now() - interval '7 days') AS new_7d,
      (SELECT count(*)::int FROM users WHERE status = 'blocked') AS blocked,
      (SELECT count(*)::int FROM conversations) AS conversations,
      (SELECT count(*)::int FROM messages) AS messages,
      (SELECT coalesce(sum(token_used_total),0)::bigint FROM users) AS tokens_used,
      (SELECT count(*)::int FROM activity_logs WHERE action = 'ai_call') AS ai_calls,
      (SELECT count(*)::int FROM activity_logs WHERE action = 'ai_call' AND created_at > now() - interval '24 hours') AS ai_calls_24h,
      (SELECT count(*)::int FROM error_logs WHERE created_at > now() - interval '24 hours') AS errors_24h
  `);
  const daily = await q(`
    SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
           (SELECT count(*)::int FROM users u WHERE u.created_at::date = d::date) AS new_users,
           (SELECT coalesce(sum(-delta),0)::bigint FROM token_ledger l WHERE l.delta < 0 AND l.created_at::date = d::date) AS tokens
      FROM generate_series(now()::date - 13, now()::date, interval '1 day') d ORDER BY 1`);

  const models = await listAllModelsWithStatus();
  const providers = await q('SELECT id, label, kind, base_url, api_key_env, enabled FROM providers ORDER BY id');
  return json({
    totals,
    daily,
    health: {
      database: { ok: true, latencyMs: dbMs },
      search: { configured: env.searchConfigured },
      google: { configured: env.googleConfigured },
      smtp: { configured: env.smtpConfigured },
      providers: providers.map((p: any) => ({ id: p.id, label: p.label, enabled: p.enabled, keyPresent: !!process.env[p.api_key_env] })),
      activeModels: models.filter((m) => m.enabled && m.keyPresent).map((m) => ({ id: m.id, label: m.label })),
    },
  });
});
