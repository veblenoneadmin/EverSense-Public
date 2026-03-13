import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/vebtask'
});

async function checkDatabaseStructure() {
  try {
    console.log('🔍 Checking database structure...');
    
    // Check table names
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `;
    
    console.log('📊 Tables:', tables);
    
    // Check user table structure
    const userTableStructure = await prisma.$queryRaw`
      DESCRIBE user
    `;
    
    console.log('👤 User table structure:', userTableStructure);
    
    // Check organizations table structure if it exists
    let orgTableStructure = null;
    try {
      orgTableStructure = await prisma.$queryRaw`
        DESCRIBE organizations
      `;
      console.log('🏢 Organizations table structure:', orgTableStructure);
    } catch (e) {
      console.log('⚠️  Organizations table does not exist');
    }
    
    // Check foreign key constraints
    const foreignKeys = await prisma.$queryRaw`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('organizations', 'memberships')
    `;
    
    console.log('🔗 Foreign key constraints:', foreignKeys);
    
    // Check existing user data
    const users = await prisma.$queryRaw`
      SELECT id, email, name FROM user WHERE email = 'tony@opusautomations.com'
    `;
    
    console.log('👤 Tony\'s user data:', users);
    
  } catch (error) {
    console.error('❌ Error checking database structure:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStructure();