import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking existing data...');
  
  try {
    const users = await prisma.user.findMany();
    console.log(`👥 Found ${users.length} users:`, users.map(u => ({ id: u.id, email: u.email })));
    
    const orgs = await prisma.organization.findMany();
    console.log(`🏢 Found ${orgs.length} organizations:`, orgs.map(o => ({ id: o.id, name: o.name, slug: o.slug })));
    
    const memberships = await prisma.membership.findMany();
    console.log(`🔗 Found ${memberships.length} memberships:`, memberships.map(m => ({ userId: m.userId, orgId: m.orgId, role: m.role })));
    
    const sessions = await prisma.session.findMany();
    console.log(`🎫 Found ${sessions.length} sessions:`, sessions.map(s => ({ id: s.id, userId: s.userId, token: s.token.substring(0, 10) + '...' })));
    
    const projects = await prisma.project.findMany();
    console.log(`📊 Found ${projects.length} projects:`, projects.map(p => ({ id: p.id, name: p.name, status: p.status })));
    
  } catch (error) {
    console.error('❌ Error checking data:', error);
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