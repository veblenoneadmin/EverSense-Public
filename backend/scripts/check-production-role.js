import { PrismaClient } from '@prisma/client';
import { INTERNAL_CONFIG } from '../config/internal.js';

const prisma = new PrismaClient();

async function checkProductionRole() {
  console.log('🔍 Checking Tony\'s role in production database...');
  console.log(`📧 Looking for: ${INTERNAL_CONFIG.ORGANIZATION.ownerEmail}`);
  
  try {
    // Check if we can connect to the database
    await prisma.$connect();
    console.log('✅ Connected to database');
    
    // Find Tony's user
    const tonyUser = await prisma.user.findUnique({
      where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail },
      include: {
        memberships: {
          include: { 
            org: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });
    
    if (!tonyUser) {
      console.log('❌ Tony\'s user record not found in database');
      return;
    }
    
    console.log('\n👤 Tony\'s User Record:');
    console.log(`  📧 Email: ${tonyUser.email}`);
    console.log(`  👤 Name: ${tonyUser.name}`);
    console.log(`  🆔 ID: ${tonyUser.id}`);
    console.log(`  ✅ Email Verified: ${tonyUser.emailVerified}`);
    console.log(`  📅 Created: ${tonyUser.createdAt}`);
    
    console.log('\n🏢 Organization Memberships:');
    if (tonyUser.memberships.length === 0) {
      console.log('  ❌ NO MEMBERSHIPS FOUND - This is the problem!');
    } else {
      tonyUser.memberships.forEach((membership, index) => {
        console.log(`  ${index + 1}. ${membership.role} in "${membership.org.name}" (${membership.org.slug})`);
        
        if (membership.org.slug === INTERNAL_CONFIG.ORGANIZATION.slug) {
          if (membership.role === 'OWNER') {
            console.log('     ✅ CORRECT: Has OWNER role in Veblen org');
          } else {
            console.log(`     ❌ PROBLEM: Should be OWNER but is ${membership.role}`);
          }
        }
      });
    }
    
    // Check if Veblen organization exists
    const veblenOrg = await prisma.organization.findUnique({
      where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug },
      include: {
        _count: {
          select: { memberships: true }
        }
      }
    });
    
    console.log('\n🏢 Veblen Organization:');
    if (!veblenOrg) {
      console.log('  ❌ Veblen organization not found in database!');
    } else {
      console.log(`  ✅ Found: "${veblenOrg.name}" (${veblenOrg.slug})`);
      console.log(`  👥 Total members: ${veblenOrg._count.memberships}`);
      console.log(`  👤 Created by: ${veblenOrg.createdById}`);
      console.log(`  📅 Created: ${veblenOrg.createdAt}`);
      
      // Check if Tony is the creator
      if (veblenOrg.createdById === tonyUser.id) {
        console.log('  ✅ Tony is the creator of this organization');
      } else {
        console.log('  ⚠️  Tony is NOT the creator of this organization');
      }
    }
    
    // Summary
    const hasVeblenMembership = tonyUser.memberships.some(m => m.org.slug === INTERNAL_CONFIG.ORGANIZATION.slug);
    const hasOwnerRole = tonyUser.memberships.some(m => m.org.slug === INTERNAL_CONFIG.ORGANIZATION.slug && m.role === 'OWNER');
    
    console.log('\n📋 Summary:');
    console.log(`  👤 User exists: ✅`);
    console.log(`  🏢 Veblen org exists: ${veblenOrg ? '✅' : '❌'}`);
    console.log(`  🔗 Has membership in Veblen: ${hasVeblenMembership ? '✅' : '❌'}`);
    console.log(`  👑 Has OWNER role: ${hasOwnerRole ? '✅' : '❌'}`);
    
    if (hasOwnerRole) {
      console.log('\n🎉 SUCCESS: Tony has proper OWNER access!');
      console.log('💡 If the UI still shows CLIENT role, try:');
      console.log('   1. Clear browser cache/cookies');
      console.log('   2. Log out and log back in');
      console.log('   3. Check browser developer console for errors');
    } else {
      console.log('\n❌ PROBLEM: Tony does not have OWNER role');
      console.log('💡 Run: node scripts/fix-tony-role.js');
    }
    
  } catch (error) {
    console.error('❌ Error checking role:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionRole();