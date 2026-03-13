import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillOrganizations() {
  console.log('🔄 Starting organization backfill process...');

  try {
    // Get all existing users from the old schema
    const existingUsers = await prisma.$queryRaw`
      SELECT id, email, name FROM user WHERE id NOT IN (
        SELECT DISTINCT createdById FROM organizations WHERE createdById IS NOT NULL
      )
    `;

    console.log(`📊 Found ${existingUsers.length} users without organizations`);

    if (existingUsers.length === 0) {
      console.log('✅ All users already have organizations. Nothing to backfill.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of existingUsers) {
      try {
        console.log(`👤 Processing user: ${user.email} (${user.id})`);

        // Generate organization name and slug
        const orgName = user.name 
          ? `${user.name}'s Organization` 
          : `${user.email.split('@')[0]}'s Organization`;
        
        let orgSlug = generateSlug(user.name || user.email.split('@')[0]);
        
        // Ensure slug is unique
        let counter = 1;
        let uniqueSlug = orgSlug;
        while (await prisma.organization.findUnique({ where: { slug: uniqueSlug } })) {
          uniqueSlug = `${orgSlug}-${counter}`;
          counter++;
        }
        orgSlug = uniqueSlug;

        // Create organization and membership in a transaction
        await prisma.$transaction(async (tx) => {
          // Create organization
          const org = await tx.organization.create({
            data: {
              name: orgName,
              slug: orgSlug,
              createdById: user.id
            }
          });

          console.log(`  📄 Created organization: ${orgName} (${org.id})`);

          // Create OWNER membership
          await tx.membership.create({
            data: {
              userId: user.id,
              orgId: org.id,
              role: 'OWNER'
            }
          });

          console.log(`  👑 Created OWNER membership for user`);

          // Migrate user's data to the organization
          const migrationStats = await migrateUserData(tx, user.id, org.id);
          console.log(`  📊 Migration stats:`, migrationStats);
        });

        successCount++;
        console.log(`  ✅ Successfully processed user ${user.email}`);

      } catch (error) {
        errorCount++;
        console.error(`  ❌ Failed to process user ${user.email}:`, error.message);
        
        // Continue with next user instead of failing completely
        continue;
      }
    }

    console.log('\n📈 Backfill Summary:');
    console.log(`✅ Successfully processed: ${successCount} users`);
    console.log(`❌ Failed to process: ${errorCount} users`);
    console.log(`📊 Total users: ${existingUsers.length}`);

    if (errorCount === 0) {
      console.log('\n🎉 Organization backfill completed successfully!');
    } else {
      console.log('\n⚠️  Organization backfill completed with some errors. Check logs above.');
    }

  } catch (error) {
    console.error('❌ Fatal error during backfill:', error);
    throw error;
  }
}

/**
 * Migrate user's existing data to an organization
 */
async function migrateUserData(tx, userId, orgId) {
  const stats = {
    brainDumps: 0,
    macroTasks: 0,
    timeLogs: 0,
    calendarEvents: 0
  };

  try {
    // Migrate brain dumps
    const brainDumpResult = await tx.$executeRaw`
      UPDATE brain_dumps 
      SET orgId = ${orgId} 
      WHERE userId = ${userId} AND (orgId IS NULL OR orgId = '')
    `;
    stats.brainDumps = brainDumpResult;

    // Migrate macro tasks
    const taskResult = await tx.$executeRaw`
      UPDATE macro_tasks 
      SET orgId = ${orgId} 
      WHERE userId = ${userId} AND (orgId IS NULL OR orgId = '')
    `;
    stats.macroTasks = taskResult;

    // Migrate time logs
    const timeLogResult = await tx.$executeRaw`
      UPDATE time_logs 
      SET orgId = ${orgId} 
      WHERE userId = ${userId} AND (orgId IS NULL OR orgId = '')
    `;
    stats.timeLogs = timeLogResult;


  } catch (error) {
    console.warn(`  ⚠️  Data migration warning for user ${userId}:`, error.message);
    // Don't throw - let the organization creation succeed even if data migration has issues
  }

  return stats;
}

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Verify the backfill results
 */
async function verifyBackfill() {
  console.log('\n🔍 Verifying backfill results...');

  try {
    // Check that all users have at least one organization
    const usersWithoutOrgs = await prisma.$queryRaw`
      SELECT u.id, u.email 
      FROM user u 
      LEFT JOIN memberships m ON u.id = m.userId 
      WHERE m.userId IS NULL
    `;

    if (usersWithoutOrgs.length > 0) {
      console.log('⚠️  Users without organizations:', usersWithoutOrgs);
    } else {
      console.log('✅ All users have organization memberships');
    }

    // Check organization and membership counts
    const stats = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.membership.count(),
      prisma.membership.count({ where: { role: 'OWNER' } })
    ]);

    console.log('📊 Final counts:');
    console.log(`  👥 Users: ${stats[0]}`);
    console.log(`  🏢 Organizations: ${stats[1]}`);
    console.log(`  🔗 Memberships: ${stats[2]}`);
    console.log(`  👑 Owner memberships: ${stats[3]}`);

    // Check data migration
    const dataMigrationStats = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as count FROM brain_dumps WHERE orgId IS NULL OR orgId = ''`,
      prisma.$queryRaw`SELECT COUNT(*) as count FROM macro_tasks WHERE orgId IS NULL OR orgId = ''`,
      prisma.$queryRaw`SELECT COUNT(*) as count FROM time_logs WHERE orgId IS NULL OR orgId = ''`
    ]);

    console.log('📋 Data without orgId:');
    console.log(`  🧠 Brain dumps: ${dataMigrationStats[0][0]?.count || 0}`);
    console.log(`  📋 Tasks: ${dataMigrationStats[1][0]?.count || 0}`);
    console.log(`  ⏰ Time logs: ${dataMigrationStats[2][0]?.count || 0}`);

  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

/**
 * Create sample test data for development
 */
async function createSampleData() {
  if (process.env.NODE_ENV === 'production') {
    console.log('🚫 Skipping sample data creation in production');
    return;
  }

  console.log('🎭 Creating sample test data...');

  try {
    // Create a test user if none exists
    const testUser = await prisma.user.upsert({
      where: { email: 'test@vebtask.com' },
      update: {},
      create: {
        email: 'test@vebtask.com',
        name: 'Test User'
      }
    });

    // Create test organization
    const testOrg = await prisma.organization.upsert({
      where: { slug: 'test-organization' },
      update: {},
      create: {
        name: 'Test Organization',
        slug: 'test-organization',
        createdById: testUser.id
      }
    });

    // Create test membership
    await prisma.membership.upsert({
      where: { 
        userId_orgId: { 
          userId: testUser.id, 
          orgId: testOrg.id 
        } 
      },
      update: {},
      create: {
        userId: testUser.id,
        orgId: testOrg.id,
        role: 'OWNER'
      }
    });

    console.log('✅ Sample test data created');
    console.log(`  👤 Test user: ${testUser.email}`);
    console.log(`  🏢 Test org: ${testOrg.name} (${testOrg.slug})`);

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();
  
  console.log('🚀 VebTask Organization Backfill Script');
  console.log('=====================================');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    // Run backfill
    await backfillOrganizations();
    
    // Verify results
    await verifyBackfill();
    
    // Create sample data for development
    if (process.env.NODE_ENV !== 'production') {
      await createSampleData();
    }

    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Total execution time: ${duration}ms`);
    console.log('🎉 Backfill process completed successfully!');

  } catch (error) {
    console.error('\n💥 Backfill process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { backfillOrganizations, verifyBackfill, createSampleData };