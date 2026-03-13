// Alternative approach - create an API endpoint to fix the membership
// This can be called from your production environment

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { INTERNAL_CONFIG } from '../config/internal.js';

const prisma = new PrismaClient();

// Temporary endpoint to fix Tony's membership
// You can add this to your server.js and call it once
export async function fixTonyMembership() {
  console.log('🔧 Fixing Tony\'s organization membership...');
  
  try {
    // Find Tony's user
    const tonyUser = await prisma.user.findUnique({
      where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail }
    });
    
    if (!tonyUser) {
      throw new Error(`Tony's user (${INTERNAL_CONFIG.ORGANIZATION.ownerEmail}) not found`);
    }
    
    console.log(`✅ Found Tony: ${tonyUser.email} (${tonyUser.id})`);
    
    // Find or create Veblen organization
    let veblenOrg = await prisma.organization.findUnique({
      where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug }
    });
    
    if (!veblenOrg) {
      console.log('🏢 Creating Veblen organization...');
      veblenOrg = await prisma.organization.create({
        data: {
          name: INTERNAL_CONFIG.ORGANIZATION.name,
          slug: INTERNAL_CONFIG.ORGANIZATION.slug,
          createdById: tonyUser.id
        }
      });
      console.log(`✅ Created organization: ${veblenOrg.name} (${veblenOrg.id})`);
    } else {
      console.log(`✅ Found organization: ${veblenOrg.name} (${veblenOrg.id})`);
    }
    
    // Check if membership already exists
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: tonyUser.id,
          orgId: veblenOrg.id
        }
      }
    });
    
    if (existingMembership) {
      if (existingMembership.role !== 'OWNER') {
        console.log(`🔄 Updating role from ${existingMembership.role} to OWNER...`);
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
    
    // Verify the fix
    const verification = await prisma.user.findUnique({
      where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail },
      include: {
        memberships: {
          include: {
            org: true
          }
        }
      }
    });
    
    console.log('\n🎯 Final Status:');
    console.log(`📧 Email: ${verification.email}`);
    console.log(`👤 Name: ${verification.name}`);
    verification.memberships.forEach(m => {
      console.log(`🏢 ${m.role} in "${m.org.name}" (${m.org.slug})`);
    });
    
    return {
      success: true,
      message: 'Tony\'s membership fixed successfully',
      user: verification.email,
      memberships: verification.memberships.length
    };
    
  } catch (error) {
    console.error('❌ Error fixing membership:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// If running this file directly
if (import.meta.url === `file://${process.argv[1]}`) {
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