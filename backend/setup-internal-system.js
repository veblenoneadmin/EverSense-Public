import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function setupInternalSystem() {
  try {
    console.log('🚀 Setting up internal VebTask system...');
    
    console.log('👤 Setting up owner user: tony@opusautomations.com');
    const owner = await prisma.user.upsert({
      where: { email: 'tony@opusautomations.com' },
      update: {
        name: 'Tony Opus',
        emailVerified: true,
        completedWizards: 'welcome,organization,profile,team'
      },
      create: {
        email: 'tony@opusautomations.com',
        name: 'Tony Opus',
        emailVerified: true,
        completedWizards: 'welcome,organization,profile,team'
      }
    });
    
    console.log('✅ Owner user created/updated:', owner.email);
    
    // Create password account for owner
    const hashedPassword = await bcrypt.hash('VeblenAdmin2025!', 12);
    
    await prisma.account.upsert({
      where: {
        providerId_providerAccountId: {
          providerId: 'email-password',
          providerAccountId: owner.email
        }
      },
      update: {
        password: hashedPassword
      },
      create: {
        accountId: `${owner.id}-email-password`,
        userId: owner.id,
        providerId: 'email-password',
        providerAccountId: owner.email,
        type: 'credential',
        password: hashedPassword
      }
    });
    
    console.log('🔐 Owner password account created');
    
    console.log('🏢 Creating Veblen organization...');
    const organization = await prisma.organization.upsert({
      where: { slug: 'veblen' },
      update: {
        name: 'Veblen',
        createdById: owner.id
      },
      create: {
        name: 'Veblen',
        slug: 'veblen',
        createdById: owner.id
      }
    });
    
    console.log('✅ Veblen organization created/updated:', organization.name);
    
    // Create owner membership
    await prisma.membership.upsert({
      where: {
        userId_orgId: {
          userId: owner.id,
          orgId: organization.id
        }
      },
      update: {
        role: 'OWNER'
      },
      create: {
        userId: owner.id,
        orgId: organization.id,
        role: 'OWNER'
      }
    });
    
    console.log('👑 Owner membership created');
    
    console.log('🎉 Internal system setup completed!');
    console.log('');
    console.log('📋 Login Details:');
    console.log('   Email: tony@opusautomations.com');
    console.log('   Password: VeblenAdmin2025!');
    console.log('   Organization: Veblen');
    console.log('   Role: OWNER');
    console.log('');
    console.log('🌐 Access the system at: http://localhost:5174');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupInternalSystem();