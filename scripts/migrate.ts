import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL. Chạy: set -a; source .env.local; set +a; npm run db:migrate');
    process.exit(1);
  }
  const client = new Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  const sql = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await client.query(sql);
  await client.end();
  console.log('✔ Database đã sẵn sàng.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
