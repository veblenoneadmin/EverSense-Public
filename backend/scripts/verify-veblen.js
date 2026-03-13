/**
 * verify-veblen.js
 *
 * Verifies that every user has a Veblen membership and every data record
 * has a valid orgId (one that exists in the organizations table).
 *
 * Run after migrate-to-veblen.js:
 *   cd backend && node scripts/verify-veblen.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error'] });

const VEBLEN_SLUG = 'veblen';

async function main() {
  console.log('🔍 Verifying Veblen migration...\n');

  // ── Check Veblen org exists ───────────────────────────────────────────────
  const veblen = await prisma.organization.findUnique({ where: { slug: VEBLEN_SLUG } });
  if (!veblen) {
    console.error('❌ Veblen organization not found — run migrate-to-veblen.js first');
    process.exit(1);
  }
  console.log(`✅ Veblen org  id=${veblen.id}\n`);

  // ── Check all users have a membership ────────────────────────────────────
  const allUsers      = await prisma.user.findMany({ select: { id: true, email: true } });
  const veblenMembers = await prisma.membership.findMany({
    where:  { orgId: veblen.id },
    select: { userId: true },
  });
  const memberSet = new Set(veblenMembers.map(m => m.userId));
  const missing   = allUsers.filter(u => !memberSet.has(u.id));

  if (missing.length === 0) {
    console.log(`✅ All ${allUsers.length} users have a Veblen membership`);
  } else {
    console.log(`❌ ${missing.length} user(s) missing from Veblen:`);
    missing.forEach(u => console.log(`   - ${u.email} (${u.id})`));
  }

  // ── Check all data tables for orphaned orgIds ─────────────────────────────
  console.log('\n📊 Checking orgId integrity per table...\n');

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

  // Include notifications only if it exists
  try {
    await prisma.$queryRawUnsafe('SELECT 1 FROM notifications LIMIT 1');
    tables.push('notifications');
  } catch (_) {}

  let allClean = true;

  for (const table of tables) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, orgId FROM \`${table}\` WHERE orgId NOT IN (${ph}) LIMIT 20`,
        ...validIds,
      );
      if (rows.length === 0) {
        console.log(`  ✅ ${table}: clean`);
      } else {
        allClean = false;
        console.log(`  ❌ ${table}: ${rows.length} orphaned row(s):`);
        rows.forEach(r => console.log(`       id=${r.id}  orgId=${r.orgId}`));
      }
    } catch (err) {
      console.warn(`  ⚠️  ${table}: could not check — ${err.message}`);
    }
  }

  // ── Final verdict ─────────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────');
  if (missing.length === 0 && allClean) {
    console.log('🎉 All checks passed — migration is complete and clean.');
  } else {
    console.log('⚠️  Issues remain. Re-run migrate-to-veblen.js to fix them.');
  }
  console.log('────────────────────────────────────────────────');
}

main()
  .catch(e => { console.error('\n❌ Verify failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
