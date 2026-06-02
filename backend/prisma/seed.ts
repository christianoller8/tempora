/**
 * Database seed — inserts a test organization and admin user.
 *
 * Uses DIRECT_DATABASE_URL (owner role) so the insert runs outside RLS
 * and doesn't need an active tenant context.
 * Falls back to DATABASE_URL if DIRECT_DATABASE_URL is not set.
 *
 * Run:  npm run db:seed -w backend
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'];
if (!url) {
  console.error('Neither DIRECT_DATABASE_URL nor DATABASE_URL is set in .env');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const ORG_NAME  = 'Tempora Demo';
  const ADMIN_EMAIL    = 'admin@tempora.com';
  const ADMIN_PASSWORD = 'Admin1234!';

  // ── Organization ────────────────────────────────────────────────────────────
  let org = await prisma.organization.findFirst({ where: { name: ORG_NAME } });

  if (!org) {
    org = await prisma.organization.create({
      data: { name: ORG_NAME, cif: 'B00000001' },
    });
    console.log(`  ✓ Organization created  id=${org.id}`);
  } else {
    console.log(`  · Organization exists   id=${org.id}`);
  }

  // ── Admin user ───────────────────────────────────────────────────────────────
  const passwordHash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: {
      organizationId_email: { organizationId: org.id, email: ADMIN_EMAIL },
    },
    update: { passwordHash, role: 'ADMIN', isActive: true },
    create: {
      organizationId: org.id,
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`  ✓ Admin user ready       id=${user.id}  email=${user.email}`);
  console.log('');
  console.log('  Credentials:');
  console.log(`    email:    ${ADMIN_EMAIL}`);
  console.log(`    password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
