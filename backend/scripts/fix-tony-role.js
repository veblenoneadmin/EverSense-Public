import { PrismaClient } from '@prisma/client';
import { INTERNAL_CONFIG } from '../config/internal.js';

const prisma = new PrismaClient();

async function fixTonyRole() {
  console.log('🔧 Fixing Tony\'s role in the database...');
  
  try {
    // Find Tony's user
    const tonyUser = await prisma.user.findUnique({
      where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail },
      include: {
        memberships: {
          include: { org: true }
        }
      }
    });
    
    if (!tonyUser) {
      console.log('❌ Tony\'s user not found. Creating user...');
      
      // Create Tony's user
      const newUser = await prisma.user.create({
        data: {
          id: INTERNAL_CONFIG.ORGANIZATION.ownerId,
          email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail,
          name: 'Tony (System Owner)',
          emailVerified: true
        }
      });
      console.log(`✅ Created user: ${newUser.email}`);
      
      // Find or create Veblen organization
      let veblenOrg = await prisma.organization.findUnique({
        where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug }
      });
      
      if (!veblenOrg) {
        veblenOrg = await prisma.organization.create({
          data: {
            name: INTERNAL_CONFIG.ORGANIZATION.name,
            slug: INTERNAL_CONFIG.ORGANIZATION.slug,
            createdById: newUser.id
          }
        });
        console.log(`✅ Created organization: ${veblenOrg.name}`);
      }
      
      // Create OWNER membership
      await prisma.membership.create({
        data: {
          userId: newUser.id,
          orgId: veblenOrg.id,
          role: 'OWNER'
        }
      });
      console.log(`✅ Created OWNER membership`);
      
    } else {
      console.log(`👤 Found Tony: ${tonyUser.email} (${tonyUser.id})`);
      
      // Check current memberships
      if (tonyUser.memberships.length === 0) {
        console.log('❌ No memberships found. Creating membership...');
        
        // Find or create Veblen organization
        let veblenOrg = await prisma.organization.findUnique({
          where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug }
        });
        
        if (!veblenOrg) {
          veblenOrg = await prisma.organization.create({
            data: {
              name: INTERNAL_CONFIG.ORGANIZATION.name,
              slug: INTERNAL_CONFIG.ORGANIZATION.slug,
              createdById: tonyUser.id
            }
          });
          console.log(`✅ Created organization: ${veblenOrg.name}`);
        }
        
        await prisma.membership.create({
          data: {
            userId: tonyUser.id,
            orgId: veblenOrg.id,
            role: 'OWNER'
          }
        });
        console.log(`✅ Created OWNER membership`);
        
      } else {
        console.log('📋 Current memberships:');
        let needsUpdate = false;
        
        for (const membership of tonyUser.memberships) {
          console.log(`  - ${membership.role} in "${membership.org.name}"`);
          
          if (membership.org.slug === INTERNAL_CONFIG.ORGANIZATION.slug && membership.role !== 'OWNER') {
            console.log(`🔄 Updating role from ${membership.role} to OWNER...`);
            
            await prisma.membership.update({
              where: { id: membership.id },
              data: { role: 'OWNER' }
            });
            console.log(`✅ Updated to OWNER role`);
            needsUpdate = false;
          } else if (membership.org.slug === INTERNAL_CONFIG.ORGANIZATION.slug) {
            console.log(`✅ Already has OWNER role in ${membership.org.name}`);
          }
        }
        
        // If no membership in Veblen org, create one
        const hasVeblenMembership = tonyUser.memberships.some(m => m.org.slug === INTERNAL_CONFIG.ORGANIZATION.slug);
        if (!hasVeblenMembership) {
          let veblenOrg = await prisma.organization.findUnique({
            where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug }
          });
          
          if (!veblenOrg) {
            veblenOrg = await prisma.organization.create({
              data: {
                name: INTERNAL_CONFIG.ORGANIZATION.name,
                slug: INTERNAL_CONFIG.ORGANIZATION.slug,
                createdById: tonyUser.id
              }
            });
            console.log(`✅ Created organization: ${veblenOrg.name}`);
          }
          
          await prisma.membership.create({
            data: {
              userId: tonyUser.id,
              orgId: veblenOrg.id,
              role: 'OWNER'
            }
          });
          console.log(`✅ Added OWNER membership to Veblen organization`);
        }
      }
    }
    
    // Verify the fix
    const verifyUser = await prisma.user.findUnique({
      where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail },
      include: {
        memberships: {
          include: { org: true }
        }
      }
    });
    
    console.log('\n🎯 Final Status for Tony:');
    console.log(`  📧 Email: ${verifyUser.email}`);
    console.log(`  👤 Name: ${verifyUser.name}`);
    console.log(`  🆔 ID: ${verifyUser.id}`);
    
    if (verifyUser.memberships.length > 0) {
      verifyUser.memberships.forEach(m => {
        console.log(`  🏢 ${m.role} in "${m.org.name}" (${m.org.slug})`);
      });
      
      const ownerRole = verifyUser.memberships.find(m => m.role === 'OWNER' && m.org.slug === INTERNAL_CONFIG.ORGANIZATION.slug);
      if (ownerRole) {
        console.log('\n🎉 SUCCESS: Tony now has OWNER access to Veblen organization!');
      } else {
        console.log('\n❌ FAILED: Tony still doesn\'t have OWNER role');
      }
    } else {
      console.log('  ❌ Still no memberships found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixTonyRole();