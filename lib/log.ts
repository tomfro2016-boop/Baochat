import { q } from './db';

/** Ghi nhật ký hoạt động. Không bao giờ ném lỗi ra ngoài. */
export async function logActivity(userId: string | null, action: string, detail: Record<string, unknown> = {}, ip?: string | null) {
  try {
    await q('INSERT INTO activity_logs (user_id, action, detail, ip) VALUES ($1,$2,$3,$4)', [userId, action, JSON.stringify(detail), ip ?? null]);
  } catch (e) {
    console.error('logActivity failed', e);
  }
}

export async function logError(source: string, message: string, detail: Record<string, unknown> = {}) {
  console.error(`[${source}]`, message);
  try {
    await q('INSERT INTO error_logs (source, message, detail) VALUES ($1,$2,$3)', [source, String(message).slice(0, 2000), JSON.stringify(detail)]);
  } catch (e) {
    console.error('logError failed', e);
  }
}
