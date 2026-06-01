/**
 * run-rls.ts
 * Idempotently applies the RLS policy SQL files against the database using the
 * owner role (DIRECT_DATABASE_URL). Must be run after `prisma migrate dev`
 * creates the tables.
 *
 * Usage:
 *   npm run db:rls -w backend
 *   # or directly:
 *   ts-node -r tsconfig-paths/register src/db/run-rls.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import 'dotenv/config';

const RLS_DIR = path.resolve(__dirname, '../../prisma/rls');

const SQL_FILES = [
  '001_rls_policies.sql',
  '002_time_entry_trigger.sql',
] as const;

async function runRls(): Promise<void> {
  const connectionString =
    process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'];

  if (!connectionString) {
    console.error('[db:rls] Neither DIRECT_DATABASE_URL nor DATABASE_URL is set');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();
  console.log('[db:rls] Connected to database');

  try {
    for (const fileName of SQL_FILES) {
      const filePath = path.join(RLS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        console.warn(`[db:rls] Skipping missing file: ${fileName}`);
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf-8');
      console.log(`[db:rls] Applying ${fileName}...`);
      await client.query(sql);
      console.log(`[db:rls] Done: ${fileName}`);
    }
    console.log('[db:rls] All RLS policies applied successfully');
  } finally {
    await client.end();
  }
}

runRls().catch((err: unknown) => {
  console.error('[db:rls] Failed:', err);
  process.exit(1);
});
