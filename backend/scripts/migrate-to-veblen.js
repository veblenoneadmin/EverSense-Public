/**
 * migrate-to-veblen.js
 *
 * Silently assigns ALL existing users to the "Veblen" organization
 * and backfills every data table's orgId where it points to a
 * non-existent organization (orphaned records).
 *
 * Safe to run multiple times — every step is idempotent.
 * No schema changes required — Organization/orgId already exist everywhere.
 *
 * Run from project root:
 *   cd backend && node scripts/migrate-to-veblen.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error'] });

// ── Config ────────────────────────────────────────────────────────────────────
const VEBLEN_SLUG        = 'veblen';
const VEBLEN_NAME        = 'Veblen';
const OWNER_EMAIL        = 'admin@eversense.ai'; // real owner email
const DEFAULT_STAFF_ROLE = 'STAFF';
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Veblen org migration starting...\n');

  // ── STEP 1: Find or create the Veblen organization ────────────────────────
  let veblen = await prisma.organization.findUnique({ where: { slug: VEBLEN_SLUG } });

  if (veblen) {
    console.log(`✅ Veblen org found  id=${veblen.id}`);
  } else {
    const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
    if (!owner) {
      console.error(`❌ Owner user not found: ${OWNER_EMAIL}`);
      console.error('   Update OWNER_EMAIL in this script to match a real user email.');
      process.exit(1);
    }
    veblen = await prisma.organization.create({
      data: { name: VEBLEN_NAME, slug: VEBLEN_SLUG, createdById: owner.id },
    });
    console.log(`✅ Created Veblen org  id=${veblen.id}`);
  }

  const veblenId = veblen.id;

  // ── STEP 2: Ensure every user has a Veblen membership ────────────────────
  console.log('\n👥 Assigning users to Veblen...');
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  let added = 0, skipped = 0;

  for (const user of allUsers) {
    const exists = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: veblenId } },
    });
    if (exists) { skipped++; continue; }

    const role = user.email === OWNER_EMAIL ? 'OWNER' : DEFAULT_STAFF_ROLE;
    await prisma.membership.create({ data: { userId: user.id, orgId: veblenId, role } });
    console.log(`  ➕ ${user.email}  →  ${role}`);
    added++;
  }

  console.log(`\n✅ Memberships — added: ${added}, already existed: ${skipped}`);

  // ── STEP 3: Backfill orphaned orgIds in all data tables ───────────────────
  // Any row whose orgId doesn't match a real organization gets reassigned to Veblen.
  // Rows already on a valid org are never touched.
  console.log('\n🔄 Backfilling orphaned orgIds...');

  const validOrgs = await prisma.organization.findMany({ select: { id: true } });
  const validIds  = validOrgs.map(o => o.id);
  const ph        = validIds.map(() => '?').join(', ');

  const tables = [
    'macro_tasks',
    'time_logs',
    'projects',
    'clients',
    'reports',
    'skills',
    'staff_skills',
    'attendance_logs',
    'calendar_events',
    'calendar_event_attendees',
    'task_comments',
    'task_attachments',
    'invites',
  ];

  // Include notifications table only if it exists (created lazily by Fireflies)
  try {
    await prisma.$queryRawUnsafe('SELECT 1 FROM notifications LIMIT 1');
    tables.push('notifications');
  } catch (_) { /* not created yet — skip */ }

  for (const table of tables) {
    try {
      const count = await prisma.$executeRawUnsafe(
        `UPDATE \`${table}\` SET orgId = ? WHERE orgId NOT IN (${ph})`,
        veblenId, ...validIds,
      );
      const icon = count > 0 ? '✅' : '✔ ';
      const msg  = count > 0 ? `${count} orphaned row(s) reassigned` : 'no orphaned rows';
      console.log(`  ${icon} ${table}: ${msg}`);
    } catch (err) {
      console.warn(`  ⚠️  ${table}: skipped — ${err.message}`);
    }
  }

  // ── STEP 4: Summary ───────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────');
  console.log('🎉 Migration complete.');
  console.log(`   Veblen org ID : ${veblenId}`);
  console.log(`   Total users   : ${allUsers.length}`);
  console.log(`   New members   : ${added}`);
  console.log('────────────────────────────────────────────────');
  console.log('\nNext: run  node scripts/verify-veblen.js  to confirm everything is clean.');
}

main()
  .catch(e => { console.error('\n❌ Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
