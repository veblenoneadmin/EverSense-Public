import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugSetup() {
  try {
    console.log('🔍 Debugging setup issues...');
    
    // Check user
    const user = await prisma.user.findUnique({
      where: { email: 'tony@opusautomations.com' }
    });
    console.log('👤 User found:', user ? { id: user.id, email: user.email } : 'NOT FOUND');
    
    if (!user) {
      console.log('❌ User not found, cannot create organization');
      return;
    }
    
    // Check if organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: 'veblen' }
    });
    console.log('🏢 Existing org:', existingOrg ? existingOrg.name : 'NOT FOUND');
    
    // Try creating organization with transaction
    console.log('🔄 Attempting to create organization...');
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: 'Veblen',
          slug: 'veblen',
          createdById: user.id
        }
      });
      
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: 'OWNER'
        }
      });
      
      return { org, membership };
    });
    
    console.log('✅ Organization created successfully!');
    console.log('Organization ID:', result.org.id);
    console.log('Membership role:', result.membership.role);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);
    console.error('Meta:', error.meta);
  } finally {
    await prisma.$disconnect();
  }
}

debugSetup();