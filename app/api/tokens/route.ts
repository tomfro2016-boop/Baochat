import { handler, json } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { tokenSummary, ledgerFor } from '@/lib/tokens';
import { q } from '@/lib/db';

export const GET = handler(async () => {
  const u = await requireUser();
  const [summary, ledger, daily] = await Promise.all([
    tokenSummary(u),
    ledgerFor(u.id, 100),
    q(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, sum(-delta)::bigint AS used
         FROM token_ledger WHERE user_id = $1 AND delta < 0 AND created_at > now() - interval '14 days'
        GROUP BY 1 ORDER BY 1`,
      [u.id],
    ),
  ]);
  return json({ summary, ledger, daily });
});
