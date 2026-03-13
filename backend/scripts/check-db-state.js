import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseState() {
  try {
    console.log('🔍 Checking Current Database State...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Present' : 'Missing');
    
    // Check users
    const users = await prisma.user.findMany({
      include: {
        memberships: {
          include: {
            org: true
          }
        },
        accounts: true,
        sessions: true
      }
    });
    
    console.log(`\n👥 Total Users: ${users.length}`);
    if (users.length > 0) {
      console.log('User Details:');
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} (${user.id})`);
        console.log(`     Name: ${user.name || 'No name'}`);
        console.log(`     Email Verified: ${user.emailVerified}`);
        console.log(`     Created: ${user.createdAt}`);
        
        if (user.memberships.length > 0) {
          console.log(`     Memberships:`);
          user.memberships.forEach(m => {
            console.log(`       - ${m.role} in "${m.org.name}" (${m.org.slug})`);
          });
        } else {
          console.log(`     No organization memberships`);
        }
        
        console.log(`     Auth Accounts: ${user.accounts.length}`);
        console.log(`     Active Sessions: ${user.sessions.length}`);
        console.log('');
      });
    }
    
    // Check organizations
    const orgs = await prisma.organization.findMany({
      include: {
        _count: {
          select: { memberships: true }
        }
      }
    });
    
    console.log(`🏢 Total Organizations: ${orgs.length}`);
    if (orgs.length > 0) {
      orgs.forEach((org, index) => {
        console.log(`  ${index + 1}. "${org.name}" (${org.slug})`);
        console.log(`     Created by: ${org.createdById}`);
        console.log(`     Members: ${org._count.memberships}`);
        console.log(`     Created: ${org.createdAt}`);
      });
    }
    
    // Check auth data
    const authStats = await Promise.all([
      prisma.account.count(),
      prisma.session.count(),
      prisma.membership.count(),
      prisma.membership.count({ where: { role: 'OWNER' } }),
      prisma.membership.count({ where: { role: 'ADMIN' } }),
      prisma.membership.count({ where: { role: 'STAFF' } }),
      prisma.membership.count({ where: { role: 'CLIENT' } })
    ]);
    
    console.log(`\n📊 Database Statistics:`);
    console.log(`  🔐 Auth Accounts: ${authStats[0]}`);
    console.log(`  📝 Active Sessions: ${authStats[1]}`);
    console.log(`  🔗 Total Memberships: ${authStats[2]}`);
    console.log(`  👑 OWNER roles: ${authStats[3]}`);
    console.log(`  🛡️  ADMIN roles: ${authStats[4]}`);
    console.log(`  👨‍💼 STAFF roles: ${authStats[5]}`);
    console.log(`  👤 CLIENT roles: ${authStats[6]}`);
    
    // Check for Tony specifically
    const tonyUser = await prisma.user.findUnique({
      where: { email: 'tony@opusautomations.com' },
      include: {
        memberships: {
          include: { org: true }
        }
      }
    });
    
    if (tonyUser) {
      console.log(`\n🎯 Tony's Current Status:`);
      console.log(`  📧 Email: ${tonyUser.email}`);
      console.log(`  👤 Name: ${tonyUser.name}`);
      console.log(`  🆔 ID: ${tonyUser.id}`);
      console.log(`  ✅ Verified: ${tonyUser.emailVerified}`);
      if (tonyUser.memberships.length > 0) {
        tonyUser.memberships.forEach(m => {
          console.log(`  🏢 Role: ${m.role} in "${m.org.name}"`);
        });
      } else {
        console.log(`  ❌ No memberships found!`);
      }
    } else {
      console.log(`\n❌ Tony's user record NOT FOUND in database!`);
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseState();