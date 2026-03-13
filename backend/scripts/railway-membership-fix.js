// Railway-specific membership fix script
// This script can be run directly on Railway to fix Tony's membership

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixTonyMembership() {
  try {
    console.log('🔧 Starting Tony\'s membership fix...');
    
    // Find Tony's user
    const tonyUser = await prisma.user.findUnique({
      where: { email: 'tony@opusautomations.com' },
      include: { memberships: { include: { org: true } } }
    });
    
    if (!tonyUser) {
      throw new Error('Tony\'s user not found');
    }
    
    console.log('✅ Found Tony:', tonyUser.email, 'ID:', tonyUser.id);
    console.log('📋 Current memberships:', tonyUser.memberships.length);
    
    // Find or create Veblen organization
    let veblenOrg = await prisma.organization.findUnique({
      where: { slug: 'veblen' }
    });
    
    if (!veblenOrg) {
      console.log('🏢 Creating Veblen organization...');
      veblenOrg = await prisma.organization.create({
        data: {
          name: 'Veblen',
          slug: 'veblen',
          createdById: tonyUser.id
        }
      });
      console.log('✅ Created organization:', veblenOrg.name, 'ID:', veblenOrg.id);
    } else {
      console.log('✅ Found organization:', veblenOrg.name, 'ID:', veblenOrg.id);
    }
    
    // Check if membership already exists
    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: tonyUser.id,
        orgId: veblenOrg.id
      }
    });
    
    if (existingMembership) {
      if (existingMembership.role !== 'OWNER') {
        console.log('🔄 Updating role from', existingMembership.role, 'to OWNER...');
        await prisma.membership.update({
          where: { id: existingMembership.id },
          data: { role: 'OWNER' }
        });
        console.log('✅ Role updated to OWNER');
      } else {
        console.log('✅ Already has OWNER role');
      }
    } else {
      console.log('👑 Creating OWNER membership...');
      await prisma.membership.create({
        data: {
          userId: tonyUser.id,
          orgId: veblenOrg.id,
          role: 'OWNER'
        }
      });
      console.log('✅ OWNER membership created');
    }
    
    // Final verification
    const verification = await prisma.user.findUnique({
      where: { email: 'tony@opusautomations.com' },
      include: {
        memberships: {
          include: { org: true }
        }
      }
    });
    
    console.log('\n🎯 Final Status:');
    console.log('📧 Email:', verification.email);
    console.log('👤 Name:', verification.name);
    verification.memberships.forEach(m => {
      console.log('🏢', m.role, 'in', m.org.name, '(' + m.org.slug + ')');
    });
    
    return {
      success: true,
      message: 'Tony\'s membership fixed successfully',
      memberships: verification.memberships.length
    };
    
  } catch (error) {
    console.error('❌ Error fixing membership:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Export for use as Railway script or API endpoint
module.exports = { fixTonyMembership };

// If running directly
if (require.main === module) {
  fixTonyMembership()
    .then(result => {
      console.log('\n🎉 Success:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Failed:', error);
      process.exit(1);
    });
}