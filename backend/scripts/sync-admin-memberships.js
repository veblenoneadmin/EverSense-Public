#!/usr/bin/env node

/**
 * Sync Admin Memberships
 * 
 * Finds all ADMIN and OWNER level users and ensures they have memberships
 * in the main organization
 */

import { prisma } from '../lib/prisma.js';

async function main() {
  try {
    console.log('🔄 Starting admin membership sync...\n');

    // Find the main organization (with most users)
    const orgs = await prisma.organization.findMany({
      include: {
        memberships: {
          select: { userId: true }
        }
      }
    });

    if (orgs.length === 0) {
      console.log('❌ No organizations found');
      return;
    }

    const mainOrg = orgs.reduce((a, b) =>
      a.memberships.length > b.memberships.length ? a : b
    );

    console.log(`📦 Main organization: ${mainOrg.name} (${mainOrg.memberships.length} members)`);
    console.log(`🆔 Org ID: ${mainOrg.id}\n`);

    // Find all users with ADMIN or OWNER role in any org
    const adminUsers = await prisma.membership.findMany({
      where: {
        role: { in: ['ADMIN', 'OWNER'] }
      },
      include: {
        user: true,
        org: { select: { name: true } }
      },
      distinct: ['userId']
    });

    console.log(`👥 Found ${adminUsers.length} admin-level users:\n`);

    // Check each admin user and add to main org if missing
    for (const admin of adminUsers) {
      const user = admin.user;
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_orgId: {
            userId: user.id,
            orgId: mainOrg.id
          }
        }
      });

      if (existingMembership) {
        console.log(`✅ ${user.email} - Already in ${mainOrg.name}`);
      } else {
        console.log(`➕ ${user.email} - Adding to ${mainOrg.name}...`);
        await prisma.membership.create({
          data: {
            userId: user.id,
            orgId: mainOrg.id,
            role: admin.role // Use their existing role
          }
        });
        console.log(`   ✅ Added as ${admin.role}`);
      }
    }

    console.log('\n✅ Admin membership sync complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
