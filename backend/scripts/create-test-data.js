import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating test user and organization...');
  
  try {
    // Create test user
    const user = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
      }
    });
    
    console.log('✅ Created test user:', user.email);
    
    // Create test organization
    const org = await prisma.organization.upsert({
      where: { slug: 'test-org' },
      update: {},
      create: {
        name: 'Test Organization',
        slug: 'test-org',
        createdById: 'test-creator-id', // Use a dummy ID to avoid foreign key issues
      }
    });
    
    console.log('✅ Created test organization:', org.name);
    
    // Create membership
    const membership = await prisma.membership.upsert({
      where: { 
        userId_orgId: {
          userId: user.id,
          orgId: org.id
        }
      },
      update: {},
      create: {
        userId: user.id,
        orgId: org.id,
        role: 'OWNER'
      }
    });
    
    console.log('✅ Created membership:', membership.role);
    
    // Create a test session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    const session = await prisma.session.create({
      data: {
        token: 'test-session-token',
        userId: user.id,
        expiresAt: expiresAt,
      }
    });
    
    console.log('✅ Created test session token:', session.token);
    
    console.log(`
🎉 Test data created successfully!

To use this in your app:
1. Go to http://localhost:5173
2. Use the session token: ${session.token}
3. Organization ID: ${org.id}
4. User ID: ${user.id}
    `);
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
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