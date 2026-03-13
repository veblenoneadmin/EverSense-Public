import { PrismaClient } from '@prisma/client';
import { INTERNAL_CONFIG } from '../config/internal.js';

const prisma = new PrismaClient();

async function resetInternalDatabase() {
  console.log('🔄 Starting internal database reset process...');
  console.log('⚠️  WARNING: This will WIPE ALL DATA and reset the database!');
  
  try {
    console.log('🗑️  Clearing all existing data...');
    
    // Clear all data in dependency order (foreign keys)
    await prisma.timeLog.deleteMany({});
    await prisma.calendarEvent.deleteMany({});
    await prisma.macroTask.deleteMany({});
    await prisma.brainDump.deleteMany({});
    await prisma.invite.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.verification.deleteMany({});
    await prisma.user.deleteMany({});
    
    console.log('✅ All existing data cleared');
    
    // Create the system owner user
    console.log('👤 Creating system owner user...');
    const ownerUser = await prisma.user.create({
      data: {
        id: INTERNAL_CONFIG.ORGANIZATION.ownerId,
        email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail,
        name: 'Tony (System Owner)',
        emailVerified: true
      }
    });
    console.log(`✅ Created owner user: ${ownerUser.email} (${ownerUser.id})`);
    
    // Create the Veblen organization
    console.log('🏢 Creating Veblen organization...');
    const organization = await prisma.organization.create({
      data: {
        name: INTERNAL_CONFIG.ORGANIZATION.name,
        slug: INTERNAL_CONFIG.ORGANIZATION.slug,
        createdById: ownerUser.id
      }
    });
    console.log(`✅ Created organization: ${organization.name} (${organization.id})`);
    
    // Create OWNER membership for Tony
    console.log('👑 Creating OWNER membership...');
    const membership = await prisma.membership.create({
      data: {
        userId: ownerUser.id,
        orgId: organization.id,
        role: 'OWNER'
      }
    });
    console.log(`✅ Created OWNER membership for ${ownerUser.email}`);
    
    // Create some sample staff members (optional - for testing)
    if (process.env.NODE_ENV !== 'production') {
      console.log('👥 Creating sample staff members...');
      
      // Sample admin user
      const adminUser = await prisma.user.create({
        data: {
          email: 'admin@veblen.com.au',
          name: 'Sample Admin',
          emailVerified: true
        }
      });
      
      await prisma.membership.create({
        data: {
          userId: adminUser.id,
          orgId: organization.id,
          role: 'ADMIN'
        }
      });
      console.log(`✅ Created admin user: ${adminUser.email}`);
      
      // Sample staff user
      const staffUser = await prisma.user.create({
        data: {
          email: 'staff@veblen.com.au',
          name: 'Sample Staff',
          emailVerified: true
        }
      });
      
      await prisma.membership.create({
        data: {
          userId: staffUser.id,
          orgId: organization.id,
          role: 'STAFF'
        }
      });
      console.log(`✅ Created staff user: ${staffUser.email}`);
      
      // Sample client user
      const clientUser = await prisma.user.create({
        data: {
          email: 'client@example.com',
          name: 'Sample Client',
          emailVerified: true
        }
      });
      
      await prisma.membership.create({
        data: {
          userId: clientUser.id,
          orgId: organization.id,
          role: 'CLIENT'
        }
      });
      console.log(`✅ Created client user: ${clientUser.email}`);
    }
    
    // Verify the setup
    console.log('🔍 Verifying internal system setup...');
    
    const finalStats = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.membership.count({ where: { role: 'OWNER' } }),
      prisma.membership.findFirst({ 
        where: { 
          user: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail },
          role: 'OWNER'
        },
        include: {
          user: { select: { email: true, name: true } },
          org: { select: { name: true, slug: true } }
        }
      })
    ]);
    
    console.log('\n📊 Final Setup Stats:');
    console.log(`  👥 Total users: ${finalStats[0]}`);
    console.log(`  🏢 Total organizations: ${finalStats[1]}`);
    console.log(`  👑 Owner memberships: ${finalStats[2]}`);
    
    const ownerMembership = finalStats[3];
    if (ownerMembership) {
      console.log('✅ System Owner Setup Verified:');
      console.log(`  📧 Email: ${ownerMembership.user.email}`);
      console.log(`  👤 Name: ${ownerMembership.user.name}`);
      console.log(`  🏢 Organization: ${ownerMembership.org.name} (${ownerMembership.org.slug})`);
      console.log(`  🔐 Role: ${ownerMembership.role}`);
    } else {
      throw new Error('❌ Failed to verify system owner setup');
    }
    
    console.log('\n🎉 Internal database reset completed successfully!');
    console.log('🚀 Tony should now have OWNER access to the Veblen organization');
    
  } catch (error) {
    console.error('❌ Fatal error during database reset:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();
  
  console.log('🚀 VebTask Internal Database Reset Script');
  console.log('=========================================');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏢 Target Organization: ${INTERNAL_CONFIG.ORGANIZATION.name}`);
  console.log(`👤 System Owner: ${INTERNAL_CONFIG.ORGANIZATION.ownerEmail}`);
  console.log('');

  // Confirmation prompt
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  PRODUCTION ENVIRONMENT DETECTED!');
    console.log('⚠️  This script will PERMANENTLY DELETE ALL DATA!');
    console.log('⚠️  Make sure you have a backup before proceeding.');
    console.log('');
  }

  try {
    await resetInternalDatabase();
    
    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Total execution time: ${duration}ms`);
    console.log('🎉 Database reset process completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your application server');
    console.log('2. Login with tony@opusautomations.com');
    console.log('3. You should now have full OWNER access');

  } catch (error) {
    console.error('\n💥 Database reset process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { resetInternalDatabase };