import { q } from './db';

export type Settings = {
  token_reset_interval_hours: number;
  token_exhausted_wait_hours: number;
  token_grant_min: number;
  token_grant_max: number;
  registration_open: boolean;
  default_model: string;
  chat_rate_per_minute: number;
  max_upload_mb: number;
};

const DEFAULTS: Settings = {
  token_reset_interval_hours: 24,
  token_exhausted_wait_hours: 7,
  token_grant_min: 1_000_000_000,
  token_grant_max: 1_000_000_000,
  registration_open: true,
  default_model: 'gpt-4o-mini',
  chat_rate_per_minute: 20,
  max_upload_mb: 10,
};

let cache: { at: number; value: Settings } | null = null;

export async function getSettings(force = false): Promise<Settings> {
  if (!force && cache && Date.now() - cache.at < 15_000) return cache.value;
  const rows = await q<{ key: string; value: unknown }>('SELECT key, value FROM system_settings');
  const merged: any = { ...DEFAULTS };
  for (const r of rows) if (r.key in DEFAULTS) merged[r.key] = r.value;
  cache = { at: Date.now(), value: merged };
  return merged;
}

export async function setSetting(key: keyof Settings, value: unknown) {
  await q(
    `INSERT INTO system_settings (key, value) VALUES ($1,$2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );
  cache = null;
}
