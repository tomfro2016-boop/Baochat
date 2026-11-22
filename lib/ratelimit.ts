import { q1 } from './db';
import { ApiError } from './http';

/**
 * Rate limit cửa sổ cố định, lưu trong PostgreSQL nên đúng cả khi chạy nhiều instance.
 * Ném 429 khi vượt ngưỡng.
 */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const row = await q1<{ count: number; retry: number }>(
    `WITH w AS (SELECT to_timestamp(floor(extract(epoch from now()) / $2::int) * $2::int) AS start)
     INSERT INTO rate_limits (key, window_start, count)
     SELECT $1::text, w.start, 1 FROM w
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count, ceil(extract(epoch from (window_start + make_interval(secs => $2::int) - now())))::int AS retry`,
    [key, windowSec],
  );
  if (row && row.count > limit) {
    throw new ApiError(429, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', { retryAfter: row.retry });
  }
  // dọn dẹp ngẫu nhiên ~1% request
  if (Math.random() < 0.01) {
    q1(`DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'`).catch(() => {});
  }
}
