import { Pool, PoolClient, types } from 'pg';

// int8 (bigint) -> number. Số token luôn nhỏ hơn 2^53 nên an toàn.
types.setTypeParser(20, (v) => parseInt(v, 10));
// numeric -> number (hệ số multiplier)
types.setTypeParser(1700, (v) => parseFloat(v));

const g = globalThis as unknown as { __baochatPool?: Pool };

export const pool: Pool =
  g.__baochatPool ??
  (g.__baochatPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  }));

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function q1<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw e;
  } finally {
    client.release();
  }
}
