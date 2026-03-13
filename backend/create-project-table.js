import 'dotenv/config';
import { prisma } from './lib/prisma.js';

async function createProjectTable() {
  try {
    console.log('🔧 Creating Project table if it doesn\'t exist...');
    
    // Execute raw SQL to create the projects table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`projects\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`orgId\` VARCHAR(191) NOT NULL,
        \`clientId\` VARCHAR(191) NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'planning',
        \`priority\` VARCHAR(20) NOT NULL DEFAULT 'medium',
        \`budget\` DECIMAL(10,2) NULL,
        \`spent\` DECIMAL(10,2) NOT NULL DEFAULT 0,
        \`progress\` INT NOT NULL DEFAULT 0,
        \`estimatedHours\` INT NOT NULL DEFAULT 0,
        \`hoursLogged\` INT NOT NULL DEFAULT 0,
        \`startDate\` DATETIME(3) NULL,
        \`endDate\` DATETIME(3) NULL,
        \`color\` VARCHAR(50) NOT NULL DEFAULT 'bg-primary',
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        
        PRIMARY KEY (\`id\`),
        INDEX \`projects_orgId_idx\`(\`orgId\`),
        INDEX \`projects_clientId_idx\`(\`clientId\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;
    
    console.log('✅ Project table created successfully!');
    
    // Verify the table exists by checking its structure
    const tableInfo = await prisma.$queryRaw`
      DESCRIBE \`projects\`
    `;
    
    console.log('📊 Project table structure:', tableInfo);
    
    // Test if we can query the projects table
    const projectCount = await prisma.project.count();
    console.log(`🔢 Current project count: ${projectCount}`);
    
  } catch (error) {
    console.error('❌ Error creating Project table:', error);
    
    // If the table already exists, that's fine
    if (error.message?.includes('already exists') || error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('✅ Project table already exists!');
      
      // Still verify we can query it
      try {
        const projectCount = await prisma.project.count();
        console.log(`🔢 Current project count: ${projectCount}`);
      } catch (queryError) {
        console.error('❌ Error querying projects table:', queryError);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

createProjectTable();