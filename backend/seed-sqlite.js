import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedSQLite() {
  console.log('🌱 Seeding SQLite test data...');
  
  try {
    // Create test user
    const user = await prisma.user.create({
      data: {
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'OWNER'
      }
    });
    console.log('✅ Created test user:', user.email);

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        id: 'test-org-1',
        name: 'Test Organization',
        slug: 'test-org',
        createdById: user.id
      }
    });
    console.log('✅ Created test organization:', org.name);

    // Create organization membership
    await prisma.membership.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: 'OWNER'
      }
    });
    console.log('✅ Created organization membership');

    // Create test session for authentication
    const session = await prisma.session.create({
      data: {
        id: 'test-session-1',
        userId: user.id,
        token: 'test-session-token-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      }
    });
    console.log('✅ Created test session');

    console.log('\n🎉 SQLite test data seeded successfully!');
    console.log('📝 Test credentials:');
    console.log('  Email: test@example.com');
    console.log('  User ID:', user.id);
    console.log('  Org ID:', org.id);
    console.log('  Session Token:', session.token);
    
  } catch (error) {
    console.error('❌ Error seeding SQLite test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedSQLite();