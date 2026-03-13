import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Setting up test user with existing organization...');
  
  try {
    const testUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    });
    
    const existingOrg = await prisma.organization.findFirst({
      where: { slug: 'veblen' }
    });
    
    if (!testUser || !existingOrg) {
      console.error('❌ Test user or organization not found');
      return;
    }
    
    // Create membership for test user
    const membership = await prisma.membership.upsert({
      where: { 
        userId_orgId: {
          userId: testUser.id,
          orgId: existingOrg.id
        }
      },
      update: {},
      create: {
        userId: testUser.id,
        orgId: existingOrg.id,
        role: 'ADMIN'
      }
    });
    
    console.log('✅ Created membership for test user');
    
    // Create a test session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    const session = await prisma.session.upsert({
      where: { token: 'test-session-token' },
      update: { expiresAt },
      create: {
        token: 'test-session-token',
        userId: testUser.id,
        expiresAt: expiresAt,
      }
    });
    
    console.log('✅ Created test session token');
    
    console.log(`
🎉 Test setup completed!

Test Details:
- User: ${testUser.email} (ID: ${testUser.id})
- Organization: ${existingOrg.name} (ID: ${existingOrg.id})
- Session Token: ${session.token}
- Session expires: ${session.expiresAt}

You can now test project creation with these credentials.
    `);
    
  } catch (error) {
    console.error('❌ Error setting up test user:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });